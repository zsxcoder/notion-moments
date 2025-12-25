import { GetStaticProps } from 'next';
import { getMoments } from '../../lib/notion';
import { markdownToPlainText, getMarkdownSummary } from '../../lib/markdown-utils';

interface RenderedMoment {
  id: string;
  title: string;
  username: string;
  date: string;
  mood?: string;
  icon?: string;
  content?: {
    raw: string;           // 原始 Markdown
    plain: string;         // 纯文本
    summary: string;        // 摘要
    short: string;          // 短摘要
  };
  images?: string[];
  videos?: string[]; // 新增视频数组字段
}

interface RenderedMomentsData {
  success: boolean;
  data: RenderedMoment[];
  count: number;
  generatedAt: string;
  error?: string;
  message?: string;
}

export default function RenderedMomentsJSON({ data }: { data: RenderedMomentsData }) {
  return JSON.stringify(data, null, 2);
}

export const getStaticProps: GetStaticProps<{ data: RenderedMomentsData }> = async () => {
  try {
    const allMoments = await getMoments();

    // 为每个 moment 处理 Markdown 内容
    const processedMoments = allMoments.map(moment => {
      const { content } = moment;
      return {
        ...moment,
        content: content ? {
          raw: content,
          plain: markdownToPlainText(content),
          summary: markdownToPlainText(content).substring(0, 300),
          short: getMarkdownSummary(content, 100)
        } : undefined
      };
    });

    const data: RenderedMomentsData = {
      success: true,
      data: processedMoments,
      count: processedMoments.length,
      generatedAt: new Date().toISOString(),
    };

    return {
      props: { data },
    };
  } catch (err) {
    const data: RenderedMomentsData = {
      success: false,
      data: [],
      count: 0,
      generatedAt: new Date().toISOString(),
      error: '获取渲染的瞬间失败',
      message: err instanceof Error ? err.message : '未知错误',
    };
    return {
      props: { data },
    };
  }
};