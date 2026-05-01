/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  
  theme: {
    /**
     * 响应式断点 (Vercel 风格)
     * 关键点：xl 设为 1150px，这是导航栏切换的断点
     */
    screens: {
      'xs': '375px',   // 小手机
      'sm': '640px',   // 大屏手机
      'md': '768px',   // 平板竖屏
      'lg': '1024px',  // 平板横屏/小桌面
      'xl': '1150px',  // 导航切换点 ← Vercel 自定义
      '2xl': '1400px', // 大桌面
    },
    
    extend: {
      /**
       * 容器最大宽度
       */
      maxWidth: {
        'container': '1080px',    // 标准容器
        'narrow': '860px',        // 窄容器 (文章)
        'form': '640px',          // 表单容器
        'wide': '1280px',         // 宽容器 (仪表盘)
      },
      
      /**
       * 间距系统 (8px 基准)
       * Tailwind 默认已是 4px 基准，这里补充常用值
       */
      spacing: {
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '30': '7.5rem',   // 120px
      },
      
      /**
       * 装饰性网格线颜色
       */
      colors: {
        'grid-line': {
          light: 'rgba(0, 0, 0, 0.05)',
          dark: 'rgba(255, 255, 255, 0.05)',
        },
      },
      
      /**
       * 边框颜色
       */
      borderColor: {
        'subtle': 'rgba(0, 0, 0, 0.05)',
        'subtle-dark': 'rgba(255, 255, 255, 0.05)',
      },
    },
  },
  
  plugins: [],
}
