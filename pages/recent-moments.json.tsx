// pages/recent-moments.json.tsx
import { GetStaticProps } from 'next';
import { getMoments } from '../lib/notion';

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

/* 这个页面会被 Next.js 打成
 *   ├─ .next/server/pages/recent-moments.json
 *   └─ 访问路径 /recent-moments.json
 * 由于用了 ISR，60 秒内第一次访问会触发重新生成
 */
export default function RecentMomentsJSON({ data }: { data: RecentMomentsData }) {
  // 直接返回纯 JSON，不包裹任何 HTML
  return JSON.stringify(data, null, 2);
}

export const getStaticProps: GetStaticProps<{ data: RecentMomentsData }> = async () => {
  try {
    const allMoments = await getMoments();

    const recentMoments = allMoments.slice(0, 10).map((m) => ({
      logo: m.icon,
      title: m.title,
      date: m.date,
      mood: m.mood,
    }));

    const data: RecentMomentsData = {
      success: true,
      data: recentMoments,
      count: recentMoments.length,
      generatedAt: new Date().toISOString(),
    };

    return {
      props: { data },
      revalidate: 60, // ← ISR：每 60 秒重新生成一次（被动触发）
    };
  } catch (err) {
    const data: RecentMomentsData = {
      success: false,
      data: [],
      count: 0,
      generatedAt: new Date().toISOString(),
      error: '获取最近瞬间失败',
      message: err instanceof Error ? err.message : '未知错误',
    };
    return {
      props: { data },
      revalidate: 60,
    };
  }
};
