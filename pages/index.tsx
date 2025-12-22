import { GetStaticProps } from 'next';
import { getMoments } from '../lib/notion';
import { MOMENTS_CONFIG } from '../lib/config';
import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment } from '@fortawesome/free-solid-svg-icons';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ReactNode } from 'react';
import 'highlight.js/styles/github.css';
import 'highlight.js/styles/github-dark.css';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface Moment {
  id: string;
  title: string;
  username: string;
  image?: string;
  date: string;
  mood?: string;
  icon?: string;
  content?: string;
  images?: string[]; // 新增图片数组字段
  videos?: string[]; // 新增视频数组字段
}

interface MomentsPageProps {
  moments: Moment[];
}

const TWIKOO_URL = process.env.NEXT_PUBLIC_TWIKOO_URL || '';
const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL || 'https://blog.lusyoe.com';

// 回到顶部按钮组件
const BackToTopIcon: React.FC<{ onClick: () => void, show: boolean }> = ({ onClick, show }) => (
  <button
    onClick={onClick}
    style={{
      position: 'fixed',
      right: 20,
      bottom: 70,
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: 'none',
      background: '#0070f3',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      zIndex: 100,
      opacity: show ? 1 : 0,
      visibility: show ? 'visible' : 'hidden',
      transform: show ? 'scale(1)' : 'scale(0.8)'
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = show ? 'scale(1.1)' : 'scale(0.8)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = show ? 'scale(1)' : 'scale(0.8)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    }}
    aria-label="回到顶部"
  >
    ↑
  </button>
);

// 明暗模式切换图标组件
const ThemeToggleIcon: React.FC<{ theme: 'light' | 'dark' | null, onClick: () => void }> = ({ theme, onClick }) => {
  // 如果主题为null，显示一个占位符
  if (!theme) {
    return <div style={{
      position: 'fixed',
      right: 20,
      bottom: 20,
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: '#f0f0f0',
      zIndex: 100
    }} />;
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: theme === 'light' ? '#f0f0f0' : '#333',
        color: theme === 'light' ? '#666' : '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 100
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}
      aria-label="切换明暗模式"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};

const MomentsPage: React.FC<MomentsPageProps> = ({ moments }) => {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const twikooInitedRef = useRef<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  // 删除缩略图url、原图url状态
  // const [zoomImgThumb, setZoomImgThumb] = useState<string | null>(null);
  // const [zoomImgOrigin, setZoomImgOrigin] = useState<string | null>(null);
  const [zoomImgIndex, setZoomImgIndex] = useState<number>(-1);
  const [zoomImgList, setZoomImgList] = useState<string[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  // 主题状态 - 初始值设为null，避免hydration不匹配
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const [now, setNow] = useState(null);
  // 视频错误状态
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  // 使用useEffect避免服务器渲染时不匹配
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 删除 getThumbUrl 函数

  // 批量获取评论数
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function fetchCounts() {
      if ((window as any).twikoo && typeof (window as any).twikoo.getCommentsCount === 'function') {
        (window as any).twikoo.getCommentsCount({
          envId: TWIKOO_URL,
          urls: moments.map(m => m.id),
        }).then((res: { url: string; count: number }[]) => {
          const map: Record<string, number> = {};
          res.forEach(item => {
            map[item.url] = item.count;
          });
          setCommentCounts(map);
        });
      }
    }
    if ((window as any).twikoo) {
      fetchCounts();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s4.zstatic.net/npm/twikoo@1.6.44/dist/twikoo.min.js';
      script.async = true;
      script.onload = () => {
        fetchCounts();
      };
      document.body.appendChild(script);
    }
  }, [moments]);

  useEffect(() => {
    if (!activeCommentId) return;
    const elId = `twikoo-moment-${activeCommentId}`;
    // 销毁上一个评论区内容
    if (twikooInitedRef.current && twikooInitedRef.current !== activeCommentId) {
      const prevEl = document.getElementById(`twikoo-moment-${twikooInitedRef.current}`);
      if (prevEl) prevEl.innerHTML = '';
    }
    function initTwikoo() {
      if ((window as any).twikoo && typeof (window as any).twikoo.init === 'function') {
        (window as any).twikoo.init({
          el: `#${elId}`,
          envId: TWIKOO_URL,
          path: activeCommentId,
        });
        twikooInitedRef.current = activeCommentId;
      }
    }
    if (typeof window !== 'undefined' && (window as any).twikoo) {
      initTwikoo();
    } else if (typeof window !== 'undefined' && !(window as any).twikoo) {
      const script = document.createElement('script');
      script.src = 'https://s4.zstatic.net/npm/twikoo@1.6.44/dist/twikoo.min.js';
      script.async = true;
      script.onload = () => {
        initTwikoo();
      };
      document.body.appendChild(script);
    }
  }, [activeCommentId]);

  const [showBackToTop, setShowBackToTop] = useState(false);

  // 手动切换主题
  const toggleTheme = () => {
    // 只在客户端执行，避免hydration不匹配
    if (typeof window !== 'undefined') {
      setTheme(prevTheme => {
        // 处理null值的情况
        const currentTheme = prevTheme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        // 保存用户偏好到localStorage
        localStorage.setItem('theme-preference', newTheme);
        return newTheme;
      });
    }
  };

  // 回到顶部功能
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 监听滚动事件，控制回到顶部按钮显示
  useEffect(() => {
    const handleScroll = () => {
      if (window.pageYOffset > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 初始化主题：优先使用用户偏好，其次根据时间
  useEffect(() => {
    // 只在客户端执行，避免hydration不匹配
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme-preference');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      } else {
        const hour = new Date().getHours();
        if (hour >= 18 || hour < 6) {
          setTheme('dark');
        } else {
          setTheme('light');
        }
      }
    }
  }, []);

  useEffect(() => {
    // 只在客户端执行，且主题已确定时才更新样式
    if (typeof window !== 'undefined' && theme) {
      document.body.classList.toggle('dark-theme', theme === 'dark');
      document.body.classList.toggle('light-theme', theme === 'light');
    }
  }, [theme]);

  // 如果主题还未确定，先渲染一个简单的占位符
  if (!theme) {
    return (
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className={`main-container ${theme}-theme`}>
      <ThemeToggleIcon theme={theme} onClick={toggleTheme} />
      <BackToTopIcon onClick={scrollToTop} show={showBackToTop} />
      <h1 style={{ textAlign: 'center' }} className="main-title">日常瞬间</h1>
      <div>
        {moments.map(moment => {
          const divId = `twikoo-moment-${moment.id}`;
          const isActive = activeCommentId === moment.id;
          return (
            <div key={moment.id} className="moment-card">
              <div className="moment-header">
                <div className="moment-user">
                  {MOMENTS_CONFIG.logo.type === 'emoji' ? (
                    <span style={{ fontSize: 28, marginRight: 6 }}>{MOMENTS_CONFIG.logo.value}</span>
                  ) : (
                    <img
                      src={MOMENTS_CONFIG.logo.value}
                      alt="logo"
                      style={MOMENTS_CONFIG.logo.imageStyle}
                    />
                  )}
                  { <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, color: '#0070f3', textDecoration: 'none' }}>{moment.username}</a> }
                </div>
                <div className="moment-date">{dayjs(moment.date).fromNow()}</div>
              </div>
              {moment.image && <img src={moment.image} alt={moment.title} style={{ width: '100%', borderRadius: 8, margin: '12px 0' }} />}
              <div style={{ fontWeight: 'bold', fontSize: 16 }} className="moment-title">{moment.title}</div>
              {moment.mood && (
                <div style={{
                  display: 'inline-block',
                  background: '#f0f0f0',
                  borderRadius: '12px',
                  padding: '2px 10px',
                  fontSize: 14,
                  color: '#666',
                  margin: '8px 0',
                  marginBottom: 4,
                }}>{moment.mood}</div>
              )}
              {moment.content && (
                <div style={{ margin: '8px 0', color: '#444', fontSize: 15 }} className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeSanitize]}
                    components={{
                      // 自定义组件渲染
                      // @ts-ignore - 忽略 inline 属性的类型错误
                      code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <pre>
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      // 自定义表格渲染
                      table: ({ children }) => (
                        <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th
                          style={{
                            border: '1px solid #ddd',
                            padding: '8px 12px',
                            textAlign: 'left',
                            backgroundColor: '#f6f8fa',
                          }}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td
                          style={{
                            border: '1px solid #ddd',
                            padding: '8px 12px',
                          }}
                        >
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {moment.content}
                  </ReactMarkdown>
                  {/* 新增：渲染图片数组，每行4张 */}
                  {moment.images && moment.images.length > 0 && (
                    <div style={{ margin: '12px 0' }}>
                      {Array.from({ length: Math.ceil(moment.images.length / 4) }).map((_, rowIdx) => (
                        <div key={rowIdx} style={{ display: 'flex', gap: '2%', marginBottom: 8 }}>
                          {moment.images!.slice(rowIdx * 4, rowIdx * 4 + 4).map((url, idx) => (
                            <img
                              key={url}
                              src={url}
                              alt={`图片${rowIdx * 4 + idx + 1}`}
                              style={{
                                width: '24%',
                                borderRadius: 8,
                                cursor: 'pointer',
                                objectFit: 'cover',
                                boxShadow: zoomImg === url ? '0 4px 24px rgba(0,0,0,0.18)' : undefined,
                                zIndex: zoomImg === url ? 1001 : undefined,
                                display: zoomImg === url ? 'none' : undefined, // 放大时隐藏原图
                              }}
                              onClick={() => {
                                setZoomImg(url);
                                setZoomImgList(moment.images!);
                                setZoomImgIndex(rowIdx * 4 + idx);
                                setShowOriginal(false);
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 渲染视频数组 */}
                  {moment.videos && moment.videos.length > 0 && (
                    <div style={{ margin: '12px 0' }}>
                      {moment.videos.map((url, idx) => {
                        // 检查是否是B站视频链接
                        const isBilibili = url.includes('bilibili.com/video/');
                        let videoId = '';
                        
                        if (isBilibili) {
                          // 提取B站视频ID (BV号)
                          const bvMatch = url.match(/BV[0-9A-Za-z]+/);
                          videoId = bvMatch ? bvMatch[0] : '';
                        }
                        
                        return (
                          <div key={url} style={{ marginBottom: 12 }}>
                            {isBilibili && videoId ? (
                              // B站视频使用iframe嵌入
                              <div style={{ position: 'relative' }}>
                                <iframe
                                  src={`https://player.bilibili.com/player.html?bvid=${videoId}&autoplay=false`}
                                  scrolling="no"
                                  frameBorder="no"
                                  allowFullScreen={true}
                                  style={{
                                    width: '100%',
                                    height: '480px',
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                  }}
                                  onError={(e) => {
                                    console.error('B站视频加载失败:', url, e);
                                    setVideoErrors(prev => ({ ...prev, [url]: true }));
                                  }}
                                />
                                {videoErrors[url] && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '480px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    borderRadius: 8,
                                    flexDirection: 'column',
                                    gap: 10
                                  }}>
                                    <div>视频加载失败</div>
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: '#0070f3', textDecoration: 'underline' }}
                                    >
                                      在新窗口中打开
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // 其他视频使用原生video标签
                              <div style={{ position: 'relative' }}>
                                <video
                                  key={url}
                                  src={url}
                                  controls={true}
                                  preload="metadata" // 只加载元数据，减少网络请求
                                  onError={(e) => {
                                    console.error('视频加载失败:', url, e);
                                    setVideoErrors(prev => ({ ...prev, [url]: true }));
                                  }}
                                  style={{
                                    width: '100%',
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                  }}
                                >
                                  您的浏览器不支持视频播放
                                </video>
                                {videoErrors[url] && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    borderRadius: 8,
                                    flexDirection: 'column',
                                    gap: 10
                                  }}>
                                    <div>视频加载失败</div>
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: '#0070f3', textDecoration: 'underline' }}
                                    >
                                      在新窗口中打开
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* 遮罩层和放大图片 */}
                  {zoomImg && (
                    <div
                      onClick={() => setZoomImg(null)}
                      style={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'zoom-out',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                        {/* 左侧半圆弧按钮 */}
                        {zoomImgList.length > 1 && zoomImgIndex > 0 && (
                          <button
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 32,
                              height: '60%',
                              minHeight: 48,
                              maxHeight: 320,
                              background: 'rgba(0,0,0,0.10)',
                              border: 'none',
                              borderRadius: '0 999px 999px 0',
                              color: '#fff',
                              fontSize: 22,
                              cursor: 'pointer',
                              zIndex: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              outline: 'none',
                              transition: 'background 0.2s',
                              boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
                              opacity: 0.7,
                            }}
                            onClick={e => {
                              e.stopPropagation();
                              if (zoomImgIndex > 0) {
                                const nextIdx = zoomImgIndex - 1;
                                setShowOriginal(false);
                                setZoomImg(zoomImgList[nextIdx]);
                                setZoomImgIndex(nextIdx);
                              }
                            }}
                            aria-label="上一张"
                            onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.18)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                          >
                            <span style={{fontSize: 22, fontWeight: 'bold', userSelect: 'none'}}>{'<'}</span>
                          </button>
                        )}
                        {/* 右侧半圆弧按钮 */}
                        {zoomImgList.length > 1 && zoomImgIndex < zoomImgList.length - 1 && (
                          <button
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 32,
                              height: '60%',
                              minHeight: 48,
                              maxHeight: 320,
                              background: 'rgba(0,0,0,0.10)',
                              border: 'none',
                              borderRadius: '999px 0 0 999px',
                              color: '#fff',
                              fontSize: 22,
                              cursor: 'pointer',
                              zIndex: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              outline: 'none',
                              transition: 'background 0.2s',
                              boxShadow: '-2px 0 8px rgba(0,0,0,0.08)',
                              opacity: 0.7,
                            }}
                            onClick={e => {
                              e.stopPropagation();
                              if (zoomImgIndex < zoomImgList.length - 1) {
                                const nextIdx = zoomImgIndex + 1;
                                setShowOriginal(false);
                                setZoomImg(zoomImgList[nextIdx]);
                                setZoomImgIndex(nextIdx);
                              }
                            }}
                            aria-label="下一张"
                            onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.18)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                          >
                            <span style={{fontSize: 22, fontWeight: 'bold', userSelect: 'none'}}>{'>'}</span>
                          </button>
                        )}
                        {/* 图片本体 */}
                        {!showOriginal && zoomImg && (
                          <img
                            src={zoomImg}
                            alt="放大图片"
                            style={{
                              maxWidth: '90vw',
                              maxHeight: '90vh',
                              width: 'auto',
                              height: 'auto',
                              display: 'block',
                              margin: 'auto',
                              borderRadius: 12,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                              background: '#fff',
                              cursor: 'zoom-out',
                            }}
                            onClick={() => setZoomImg(null)}
                          />
                        )}
                        {showOriginal && zoomImg && (
                          <img
                            src={zoomImg}
                            alt="原图"
                            style={{
                              maxWidth: 'none',
                              maxHeight: 'none',
                              width: 'auto',
                              height: 'auto',
                              display: loadingOriginal ? 'none' : 'block',
                              margin: 'auto',
                              borderRadius: 12,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                              background: '#fff',
                              cursor: 'zoom-out',
                            }}
                            onClick={() => setZoomImg(null)}
                            onLoad={() => setLoadingOriginal(false)}
                          />
                        )}
                        {showOriginal && loadingOriginal && (
                          <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0070f3', fontSize: 18, background: 'rgba(255,255,255,0.7)', borderRadius: 12 }}>
                            原图加载中...
                          </div>
                        )}
                        {/* 底部小圆点 */}
                        {zoomImgList.length > 1 && (
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 12,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 8,
                            zIndex: 2,
                          }}>
                            {zoomImgList.map((img, idx) => (
                              <span
                                key={img + idx}
                                onClick={e => {
                                  e.stopPropagation();
                                  setShowOriginal(false);
                                  setZoomImg(img);
                                  setZoomImgIndex(idx);
                                }}
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: idx === zoomImgIndex ? '#0070f3' : 'rgba(255,255,255,0.7)',
                                  border: idx === zoomImgIndex ? '1.5px solid #0070f3' : '1px solid #ccc',
                                  display: 'inline-block',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                style={{ marginTop: 8, padding: '4px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fafbfc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setActiveCommentId(isActive ? null : moment.id)}
              >
                <FontAwesomeIcon icon={faComment as IconProp} style={{ color: isActive ? '#0070f3' : '#888', fontSize: 14 }} />
                <span style={{ color: '#888', fontSize: 14 }}>
                  {typeof commentCounts[moment.id] === 'number' ? commentCounts[moment.id] : '-'}
                </span>
                {isActive ? '' : ''}
              </button>
              <div
                className="twikoo-comment-area"
                style={{
                  marginTop: 16,
                  display: isActive ? 'block' : 'none',
                }}
              >
                <div id={divId}></div>
              </div>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css');
        body, .main-container, html {
          font-family: 'LXGW WenKai', '霞鹜文楷', 'WenKai', 'STKaiti', 'KaiTi', serif !important;
        }
        body, .main-container {
          background: #fff;
          transition: background 0.3s, color 0.3s;
        }
        .main-container {
          max-width: 820px;
          margin: 0 auto;
          min-height: 100vh;
          position: relative;
          padding-top: 80px;
        }
        .moment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .moment-user {
          display: flex;
          align-items: center;
        }
        .moment-date {
          color: #888;
          font-size: 14px;
          margin-left: 12px;
          white-space: nowrap;
        }
        body.dark-theme, .main-container.dark-theme {
          background: #181818 !important;
          color: #e0e0e0 !important;
        }
        body.light-theme, .main-container.light-theme {
          background: #fff !important;
          color: #333 !important;
        }
        .moment-user a {
          color: #0070f3;
          text-decoration: none;
          transition: color 0.3s;
        }
        .moment-user a:hover {
          color: #0051b3;
          text-decoration: underline;
        }
        body.dark-theme .moment-user a,
        .main-container.dark-theme .moment-user a {
          color: #4da6ff;
        }
        body.dark-theme .moment-user a:hover,
        .main-container.dark-theme .moment-user a:hover {
          color: #80bfff;
        }
        .markdown-content {
        }
        .markdown-content > img {
          width: calc((100% - 3 * 2%) / 4);
          margin: 0;
          border-radius: 8px;
          cursor: pointer;
          height: auto;
          box-sizing: border-box;
          object-fit: cover;
        }
        .markdown-content > img:nth-child(4n) {
          margin-right: 0;
        }
        /* 隐藏全局滚动条，兼容主流浏览器 */
        html, body, .main-container {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none;    /* Firefox */
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar, .main-container::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none;
          background: transparent;
        }
        .markdown-content > img {
          display: inline-block;
          width: 23%;
          margin: 1%;
          border-radius: 8px;
          cursor: pointer;
          height: auto;
          box-sizing: border-box;
          object-fit: cover;
        }
        .markdown-content p {
          margin-bottom: 0.1em;
        }
        .markdown-content blockquote,
        .markdown-content pre,
        .markdown-content ul,
        .markdown-content ol,
        .markdown-content hr {
          margin-bottom: 0.4em;
        }
        /* Markdown 代码高亮样式 */
        .markdown-content pre {
          background: #f6f8fa;
          border-radius: 6px;
          padding: 12px;
          overflow: auto;
          margin-bottom: 1em;
        }
        .markdown-content code {
          background: rgba(175, 184, 193, 0.2);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 85%;
        }
        .markdown-content pre code {
          background: transparent;
          padding: 0;
          font-size: 100%;
        }
        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1em;
        }
        .markdown-content th,
        .markdown-content td {
          border: 1px solid #ddd;
          padding: 8px 12px;
        }
        .markdown-content th {
          background-color: #f6f8fa;
        }
        /* 暗色模式下的 Markdown 样式 */
        body.dark-theme .markdown-content pre,
        .main-container.dark-theme .markdown-content pre {
          background: #2d2d2d;
        }
        body.dark-theme .markdown-content code,
        .main-container.dark-theme .markdown-content code {
          background: rgba(110, 118, 129, 0.4);
          color: #e6edf3;
        }
        body.dark-theme .markdown-content th,
        .main-container.dark-theme .markdown-content th {
          background-color: #2d3748;
        }
        body.dark-theme .markdown-content th,
        body.dark-theme .markdown-content td,
        .main-container.dark-theme .markdown-content th,
        .main-container.dark-theme .markdown-content td {
          border-color: #4a5568;
        }
        body.dark-theme .markdown-content blockquote,
        .main-container.dark-theme .markdown-content blockquote {
          color: #a0aec0;
          border-left-color: #4a5568;
        }
        @media (max-width: 600px) {
          .main-container {
            max-width: 100%;
            margin: 0;
            padding: 0 4vw;
          }
          h1 {
            font-size: 1.3rem;
          }
          .markdown-content {
            flex-direction: column;
            gap: 0;
          }
          .markdown-content > img {
            width: 100%;
            margin: 8px 0;
            border-radius: 6px;
            display: block;
          }
          .main-container > div > div {
            padding: 10px 6px;
            margin-bottom: 14px;
            border-radius: 6px;
          }
          /* 保证头像、名称和时间同一行 */
          .moment-header {
            flex-direction: row !important;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .moment-user {
            flex-direction: row;
            align-items: center;
          }
          .moment-date {
            margin-left: 8px;
            font-size: 13px;
          }
          .main-container button {
            font-size: 13px;
            padding: 4px 10px;
            border-radius: 5px;
          }
          .main-container img {
            max-width: 100%;
            height: auto;
          }
          .main-container span, .main-container div {
            font-size: 15px;
          }
        }
        /* 横线到底提示 */
        .bottom-line {
          width: 100%;
          text-align: center;
          border: none;
          border-top: 1.5px solid #e0e0e0;
          color: #888;
          font-size: 15px;
          margin: 36px 0 18px 0;
          position: relative;
          background: transparent;
        }
        .bottom-line span {
          position: relative;
          top: -0.9em;
          background: #fff;
          padding: 0 18px;
          color: #888;
          font-size: 15px;
        }
        body.dark-theme .bottom-line,
        .main-container.dark-theme .bottom-line {
          border-top: 1.5px solid #333;
          color: #bbbbbb;
        }
        body.dark-theme .bottom-line span,
        .main-container.dark-theme .bottom-line span {
          background: #181818;
          color: #bbbbbb;
        }
        /* 滚动条样式适配 */
        html::-webkit-scrollbar-thumb,
        body::-webkit-scrollbar-thumb,
        .main-container::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 4px;
        }
        html.dark-theme::-webkit-scrollbar-thumb,
        body.dark-theme::-webkit-scrollbar-thumb,
        .main-container.dark-theme::-webkit-scrollbar-thumb {
          background: #555;
        }
        html::-webkit-scrollbar-track,
        body::-webkit-scrollbar-track,
        .main-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        html.dark-theme::-webkit-scrollbar-track,
        body.dark-theme::-webkit-scrollbar-track,
        .main-container.dark-theme::-webkit-scrollbar-track {
          background: #2a2a2a;
        }
        .moment-title {
          font-weight: bold;
          font-size: 16px;
        }
        .main-title {
          text-align: center;
        }
        .main-container button {
          background: #fafbfc;
        }
        body.dark-theme .main-container button,
        .main-container.dark-theme button {
          background: #232323 !important;
          border-color: #444 !important;
          color: #e0e0e0 !important;
        }
        body.dark-theme .main-container button:hover,
        .main-container.dark-theme button:hover {
          background: #333 !important;
          border-color: #666 !important;
        }
        .main-container button {
          transition: all 0.3s ease;
        }
        .moment-date {
          transition: color 0.3s;
        }
        body.dark-theme .moment-mood,
        .main-container.dark-theme .moment-mood {
          background: #333 !important;
          color: #bbbbbb !important;
        }
        body.dark-theme .moment-title,
        .main-container.dark-theme .moment-title {
          color: #bbbbbb !important;
        }
        body.dark-theme .markdown-content,
        .main-container.dark-theme .markdown-content {
          color: #bbbbbb !important;
        }
        body.dark-theme .main-title,
        .main-container.dark-theme .main-title {
          color: #bbbbbb !important;
        }
        .moment-card {
          border: 1px solid #eee;
          border-radius: 12px;
          margin-bottom: 32px;
          padding: 32px;
        }
        body.dark-theme .moment-card,
        .main-container.dark-theme .moment-card {
          border-color: #333 !important;
        }
        .twikoo-comment-area {
          background: #fafbfc;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          padding: 16px;
        }
        body.dark-theme .twikoo-comment-area,
        .main-container.dark-theme .twikoo-comment-area {
          background: #23232a !important;
          border-color: #333 !important;
          color: #bbbbbb !important;
        }
      `}</style>
      {/* 底部横线提示 */}
      <div className="bottom-line">
        <span>已经到底啦</span>
      </div>
    </div>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  const moments = await getMoments();
  return {
    props: {
      moments,
    },
    // 添加重验证，每60秒重新生成页面
    revalidate: 60,
  };
};

export default MomentsPage; 