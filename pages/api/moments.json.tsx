import { GetStaticProps } from 'next';
import { getMoments } from '../../lib/notion';
import { markdownToPlainText, getMarkdownSummary, hasMarkdownElements } from '../../lib/markdown-utils';

interface Moment {
  id: string;
  title: string;
  username: string;
  date: string;
  mood?: string;
  icon?: string;
  content?: string;         // Markdown 格式的完整内容
  contentSummary?: string;   // 纯文本摘要
  contentShort?: string;     // 短文本摘要（100字符）
  contentElements?: {        // 内容包含的 Markdown 元素
    headings?: boolean;
    lists?: boolean;
    code?: boolean;
    quotes?: boolean;
    links?: boolean;
    images?: boolean;
    videos?: boolean;
  };
  images?: string[];
  videos?: string[]; // 新增视频数组字段
}

interface AllMomentsData {
  success: boolean;
  data: Moment[];
  count: number;
  generatedAt: string;
  error?: string;
  message?: string;
}

export default function AllMomentsJSON({ data }: { data: AllMomentsData }) {
  // 直接返回纯 JSON
  return JSON.stringify(data, null, 2);
}

export const getStaticProps: GetStaticProps<{ data: AllMomentsData }> = async () => {
  try {
    const allMoments = await getMoments();

    // 为每个 moment 添加 Markdown 相关信息
    const processedMoments = allMoments.map(moment => {
      const { content } = moment;
      return {
        ...moment,
        contentSummary: content ? markdownToPlainText(content) : '',
        contentShort: content ? getMarkdownSummary(content, 100) : '',
        contentElements: content ? { ...hasMarkdownElements(content), videos: !!(moment.videos && moment.videos.length > 0) } : {}
      };
    });

    const data: AllMomentsData = {
      success: true,
      data: processedMoments,
      count: processedMoments.length,
      generatedAt: new Date().toISOString(),
    };

    return {
      props: { data },
    };
  } catch (err) {
    const data: AllMomentsData = {
      success: false,
      data: [],
      count: 0,
      generatedAt: new Date().toISOString(),
      error: '获取所有瞬间失败',
      message: err instanceof Error ? err.message : '未知错误',
    };
    return {
      props: { data },
    };
  }
};