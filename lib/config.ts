// 全局配置
export const MOMENTS_CONFIG = {
  // Logo 配置
  logo: {
    // 可以选择 emoji 或图片 URL
    type: 'image', // 'emoji' 或 'image'
    value: 'https://imgbed.mcyzsx.top/file/avatar/1765626136745_zsxcoder.jpg', // 如果 type 是 emoji，这里是 emoji 字符；如果 type 是 image，这里是图片 URL
    // 如果使用图片，可以在这里设置图片样式
    imageStyle: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      objectFit: 'cover' as const, // 使用 as const 明确类型
      background: '#f5f5f5',
      marginRight: 6
    }
  },
  // Markdown 配置
  markdown: {
    // 摘要长度
    summaryLength: 300,
    // 短摘要长度
    shortLength: 100,
    // 是否在 JSON 中包含渲染后的文本
    includeRendered: true,
    // 是否检测 Markdown 元素
    detectElements: true,
    // 是否保留原始 Markdown
    keepRaw: true
  }
};