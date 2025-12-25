import { GetStaticProps } from 'next';
import { getMoments } from '../../lib/notion';

interface Moment {
  id: string;
  title: string;
  username: string;
  date: string;
  mood?: string;
  icon?: string;
  content?: string;
  images?: string[];
  videos?: string[]; // 新增视频数组字段
}

interface RecentMomentsData {
  success: boolean;
  data: Moment[];
  count: number;
  generatedAt: string;
  error?: string;
  message?: string;
}

// 这个页面返回最近7天的瞬间
export default function RecentWeekMomentsJSON({ data }: { data: RecentMomentsData }) {
  return JSON.stringify(data, null, 2);
}

export const getStaticProps: GetStaticProps<{ data: RecentMomentsData }> = async () => {
  try {
    const allMoments = await getMoments();

    // 获取最近7天的数据
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentMoments = allMoments
      .filter(moment => new Date(moment.date) > weekAgo)
      .map(({ id, title, username, date, mood, icon, content, images, videos }) => ({
        id,
        title,
        username,
        date,
        mood,
        icon,
        content,
        images,
        videos
      }));

    const data: RecentMomentsData = {
      success: true,
      data: recentMoments,
      count: recentMoments.length,
      generatedAt: new Date().toISOString(),
    };

    return {
      props: { data },
    };
  } catch (err) {
    const data: RecentMomentsData = {
      success: false,
      data: [],
      count: 0,
      generatedAt: new Date().toISOString(),
      error: '获取最近7天瞬间失败',
      message: err instanceof Error ? err.message : '未知错误',
    };
    return {
      props: { data },
    };
  }
};