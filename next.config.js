/** @type {import('next').NextConfig} */
const nextConfig = {
  // 移除 output: 'export'，这样才能支持 ISR
  turbopack: {
    root: __dirname,
  },
  // 添加重验证配置，默认每60秒重新获取数据
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 60,
    }
  }
};

module.exports = nextConfig; 