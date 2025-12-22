import { GetStaticProps } from 'next';
import { getMoments } from '../lib/notion';
import { MOMENTS_CONFIG } from '../lib/config';

interface RecentMoment {
  logo: string;
  title: string;
  date: string;
  mood: string;
}

interface RecentMomentsData {
  success: boolean;
  data: RecentMoment[];
  count: number;
  generatedAt: string;
  error?: string;
  message?: string;
}

// 这个页面会生成静态JSON文件
export default function RecentMomentsJSON({ data }: { data: RecentMomentsData }) {
  // 返回纯JSON字符串，不包含任何HTML
  return JSON.stringify(data, null, 2);
}

export const getStaticProps: GetStaticProps<{ data: RecentMomentsData }> = async () => {
  try {
    // 获取所有瞬间
    const allMoments = await getMoments();
    
    // 默认取最近10条，并只返回需要的字段
    const recentMoments = allMoments
      .slice(0, 10)
      .map(moment => ({
        logo: MOMENTS_CONFIG.logo.type === 'emoji' ? MOMENTS_CONFIG.logo.value : MOMENTS_CONFIG.logo.value,
        title: moment.title,
        date: moment.date,
        mood: moment.mood
      }));

    const data: RecentMomentsData = {
      success: true,
      data: recentMoments,
      count: recentMoments.length,
      generatedAt: new Date().toISOString()
    };

    return {
      props: {
        data
      },
      // 添加重验证，每60秒重新生成页面
      revalidate: 60,
    };
  } catch (error) {
    console.error('[recent-moments] 静态生成错误:', error);
    
    const data: RecentMomentsData = {
      success: false,
      data: [],
      count: 0,
      generatedAt: new Date().toISOString(),
      error: '获取最近瞬间失败',
      message: error instanceof Error ? error.message : '未知错误'
    };

    return {
      props: {
        data
      },
      // 添加重验证，每60秒重新生成页面
      revalidate: 60,
    };
  }
}; 