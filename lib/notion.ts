import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 通用重试函数，支持超时和重试
async function requestWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, timeout = 15000): Promise<T> {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('请求超时')), timeout)),
      ]);
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        // 可选：指数退避
        await new Promise(res => setTimeout(res, 300 * attempt));
      }
    }
  }
  throw lastError;
}

// 将 Notion rich_text 转换为 Markdown
function richTextToMarkdown(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';
  
  return richText.map((text: any) => {
    let result = text.plain_text || '';
    
    // 处理格式
    if (text.annotations) {
      const { bold, italic, strikethrough, underline, code, color } = text.annotations;
      
      // 处理代码格式
      if (code) {
        result = `\`${result}\``;
      }
      
      // 处理加粗
      if (bold) {
        result = `**${result}**`;
      }
      
      // 处理斜体
      if (italic) {
        result = `*${result}*`;
      }
      
      // 处理删除线
      if (strikethrough) {
        result = `~~${result}~~`;
      }
      
      // 处理下划线（Markdown 不支持，用 HTML 标签）
      if (underline) {
        result = `<u>${result}</u>`;
      }
      
      // 处理颜色（Markdown 不支持，用 HTML 标签）
      if (color && color !== 'default') {
        result = `<span style="color: ${color}">${result}</span>`;
      }
    }
    
    // 处理链接
    if (text.text?.link) {
      const url = text.text.link.url;
      result = `[${result}](${url})`;
    }
    
    return result;
  }).join('');
}

// 递归获取所有内容块，保留类型和子块（children），图片块只收集 image 字段
async function getAllBlocks(blockId: string): Promise<any[]> {
  let blocksArr: any[] = [];
  try {
    const blocks = await requestWithRetry(() => notion.blocks.children.list({ block_id: blockId }));
    for (const block of blocks.results as any[]) {
      let item: any = { type: block.type };
      
      // 处理不同类型块的内容，使用新的 richTextToMarkdown 函数
      if (block[block.type]?.rich_text) {
        item.text = richTextToMarkdown(block[block.type].rich_text);
      } else if (block.type === 'code' && block.code?.rich_text) {
        item.text = richTextToMarkdown(block.code.rich_text);
      } else if (block.type === 'paragraph' && block.paragraph?.rich_text) {
        item.text = richTextToMarkdown(block.paragraph.rich_text);
      } else if (block[block.type]?.text) {
        item.text = block[block.type].text;
      }
      if (block.type === 'image') {
        const imageUrl = block.image?.type === 'external' ? block.image.external.url : block.image?.file?.url;
        if (imageUrl) {
          item.image = imageUrl;
        }
      }
      
      // 处理视频块
      if (block.type === 'video') {
        const videoUrl = block.video?.type === 'external' 
          ? block.video.external.url 
          : block.video?.file?.url;
        if (videoUrl) {
          item.video = videoUrl;
          // 在 Markdown 中添加视频链接，对于B站视频特别处理
          if (videoUrl.includes('bilibili.com/video/')) {
            const bvMatch = videoUrl.match(/BV[0-9A-Za-z]+/);
            const videoId = bvMatch ? bvMatch[0] : '';
            item.text = `[B站视频: ${videoId}](https://www.bilibili.com/video/${videoId})`;
          } else {
            item.text = `[视频](${videoUrl})`;
          }
        }
      }
      
      if (block.has_children) {
        item.children = await getAllBlocks(block.id);
      }
      blocksArr.push(item);
    }
  } catch (e) {
    // 忽略错误
  }
  return blocksArr;
}

// 块树转 Markdown
function blocksToMarkdown(blocks: any[], depth = 0): string {
  let md = '';
  for (const block of blocks) {
    if (block.type === 'image') continue; // 图片不参与 content 拼接
    const text = block.text || '';
    switch (block.type) {
      case 'heading_1':
        md += `# ${text}\n\n`;
        break;
      case 'heading_2':
        md += `## ${text}\n\n`;
        break;
      case 'heading_3':
        md += `### ${text}\n\n`;
        break;
      case 'bulleted_list_item':
        md += `${'  '.repeat(depth)}- ${text}\n`;
        if (block.children) md += blocksToMarkdown(block.children, depth + 1);
        break;
      case 'numbered_list_item':
        md += `${'  '.repeat(depth)}1. ${text}\n`;
        if (block.children) md += blocksToMarkdown(block.children, depth + 1);
        break;
      case 'to_do':
        md += `${'  '.repeat(depth)}- [${block[block.type]?.checked ? 'x' : ' '}] ${text}\n`;
        if (block.children) md += blocksToMarkdown(block.children, depth + 1);
        break;
      case 'quote':
        md += `${'  '.repeat(depth)}> ${text}\n\n`;
        if (block.children) md += blocksToMarkdown(block.children, depth + 1);
        break;
      case 'code':
        md += `\n\`\`\`${block.code?.language || ''}\n${text}\n\`\`\`\n\n`;
        break;
      case 'callout':
        md += `> ${text}\n\n`;
        if (block.children) md += blocksToMarkdown(block.children, depth + 1);
        break;
      case 'paragraph':
      default:
        // 如果段落内容有多行，按行分割，每行都单独作为段落
        if (text.includes('\n')) {
          md += text.split(/\r?\n/).map(line => line.trim() ? `${line}\n\n` : '').join('');
        } else {
          md += `${text}\n\n`;
        }
        if (block.children) md += blocksToMarkdown(block.children, depth + 1);
        break;
    }
  }
  return md;
}

export async function getMoments(retry = 10) {
  const databaseId = process.env.NOTION_DATABASE_ID!;
  // 从环境变量获取天数范围，默认为90天
  const dayRange = parseInt(process.env.NOTION_DAY_RANGE || '90', 10);
  const rangeDate = new Date();
  rangeDate.setDate(rangeDate.getDate() - dayRange);

  try {
    const response = await requestWithRetry(() => notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: '日期',
            date: {
              on_or_after: rangeDate.toISOString().split('T')[0],
            },
          },
          {
            property: '状态',
            select: {
              equals: '发布',
            },
          },
        ],
      },
      sorts: [{ property: '日期', direction: 'descending' }]
    }));

    return await Promise.all(response.results.map(async (page: any, index: number) => {
      // 计算相对时间
      const dateStr = page.properties['日期']?.date?.start || '';
      let relativeDate = '';
      if (dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) {
          relativeDate = `${diff}秒前`;
        } else if (diff < 3600) {
          relativeDate = `${Math.floor(diff / 60)}分钟前`;
        } else if (diff < 86400) {
          relativeDate = `${Math.floor(diff / 3600)}小时前`;
        } else if (diff < 2592000) {
          relativeDate = `${Math.floor(diff / 86400)}天前`;
        } else {
          relativeDate = date.toLocaleDateString('zh-CN');
        }
      }

      // 获取页面内容块（递归，包括图片和视频）
      let content = '';
      let images: string[] = [];
      let videos: string[] = [];
      try {
        // 添加延迟，避免 API 请求过于频繁
        if (index > 0 && index % 5 === 0) {
          await new Promise(res => setTimeout(res, 500));
        }
        
        const blocks = await getAllBlocks(page.id);
        // content 用 Markdown 格式化，图片和视频单独收集
        content = blocksToMarkdown(blocks).trim();
        
        // 收集图片
        images = [];
        const collectImages = (blks: any[]) => {
          for (const b of blks) {
            if (b.type === 'image' && b.image) images.push(b.image);
            if (b.children) collectImages(b.children);
          }
        };
        collectImages(blocks);
        
        // 收集视频
        videos = [];
        const collectVideos = (blks: any[]) => {
          for (const b of blks) {
            if (b.type === 'video' && b.video) videos.push(b.video);
            if (b.children) collectVideos(b.children);
          }
        };
        collectVideos(blocks);
      } catch (e) {
        console.warn(`[getMoments] Failed to fetch blocks for page ${page.id}:`, e);
        content = '';
        images = [];
        videos = [];
      }

      return {
        id: page.id,
        icon:
          page.icon?.type === 'emoji' ? page.icon.emoji :
          page.icon?.type === 'file' ? page.icon.file?.url :
          page.icon?.type === 'external' ? page.icon.external?.url :
          '',
        username: page.properties['姓名']?.rich_text?.[0]?.plain_text || '',
        title: page.properties['名称']?.title?.[0]?.plain_text || '',
        date: dateStr, // 直接返回原始时间字符串
        mood: (page.properties['心情']?.multi_select || []).map((m: any) => m.name).join(' '),
        content,
        images, // 返回图片数组
        videos, // 返回视频数组
      };
    }));
  } catch (err) {
    if (retry > 0) {
      console.warn(`[getMoments] fetch failed, retrying... (${retry} attempts remaining)`);
      await new Promise(res => setTimeout(res, 2000));
      return getMoments(retry - 1);
    }
    console.error('[getMoments] fetch failed after retries, throw error:', err);
    throw err; // 这里抛出异常，不返回 []
  }
} 