import React from 'react';
import { Container, DecorativeGrid, GridBackground, Divider } from './Layout';

/**
 * 布局组件使用示例
 */

// ============================================================
// 示例 1: 基础容器使用
// ============================================================

export const BasicContainerExample = () => (
  <Container>
    <h1>标准容器 (1080px)</h1>
    <p>内容会被限制在 1080px 宽度内，并水平居中</p>
  </Container>
);

export const NarrowContainerExample = () => (
  <Container variant="narrow">
    <article>
      <h1>文章标题</h1>
      <p>窄容器 (860px) 适合阅读长文本内容</p>
    </article>
  </Container>
);

export const FormContainerExample = () => (
  <Container variant="form">
    <form>
      <h2>登录表单</h2>
      <p>表单容器 (640px) 适合登录、注册等表单页面</p>
    </form>
  </Container>
);

// ============================================================
// 示例 2: 装饰网格线
// ============================================================

export const DecorativeGridExample = () => (
  <DecorativeGrid columns={12} rows={6} showCrosshairs>
    <Container className="py-20">
      <h1 className="text-4xl font-bold">Hero Section</h1>
      <p className="mt-4 text-lg text-gray-600">
        背景有装饰性网格线，增加科技感
      </p>
    </Container>
  </DecorativeGrid>
);

export const SimpleGridBackgroundExample = () => (
  <GridBackground cellSize={60} className="min-h-[400px]">
    <Container className="py-16">
      <h2>简单网格背景</h2>
      <p>使用 CSS 背景实现，性能更好</p>
    </Container>
  </GridBackground>
);

// ============================================================
// 示例 3: 响应式布局
// ============================================================

export const ResponsiveLayoutExample = () => (
  <Container>
    {/* 移动端单列，桌面端多列 */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div className="p-6 border rounded-lg">卡片 1</div>
      <div className="p-6 border rounded-lg">卡片 2</div>
      <div className="p-6 border rounded-lg">卡片 3</div>
    </div>
    
    {/* 分割线 */}
    <Divider className="my-12" />
    
    {/* 移动端堆叠，桌面端并排 */}
    <div className="flex flex-col xl:flex-row gap-8">
      <aside className="xl:w-64 shrink-0">
        <p>侧边栏 (xl 断点后显示)</p>
      </aside>
      <main className="flex-1">
        <p>主内容区</p>
      </main>
    </div>
  </Container>
);

// ============================================================
// 示例 4: 完整页面布局
// ============================================================

export const FullPageExample = () => (
  <div className="min-h-screen">
    {/* Header */}
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <Container className="h-16 flex items-center justify-between">
        <div className="font-bold">Logo</div>
        {/* xl 以上显示完整导航，以下显示汉堡菜单 */}
        <nav className="hidden xl:flex gap-6">
          <a href="#">Products</a>
          <a href="#">Solutions</a>
          <a href="#">Docs</a>
        </nav>
        <button className="xl:hidden">☰</button>
      </Container>
    </header>
    
    {/* Hero with decorative grid */}
    <DecorativeGrid columns={12} rows={8}>
      <Container className="py-24 text-center">
        <h1 className="text-5xl font-bold">Welcome</h1>
        <p className="mt-4 text-xl text-gray-600">
          Vercel 风格页面布局示例
        </p>
      </Container>
    </DecorativeGrid>
    
    {/* Content sections */}
    <section className="py-16">
      <Container>
        <h2 className="text-3xl font-bold mb-8">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-6 border border-black/[0.05] rounded-lg">
              <h3 className="font-semibold">Feature {i}</h3>
              <p className="mt-2 text-gray-600">Description</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
    
    <Divider />
    
    {/* Footer */}
    <footer className="py-12">
      <Container>
        <p className="text-center text-gray-500">© 2024 Your Company</p>
      </Container>
    </footer>
  </div>
);

// ============================================================
// 示例 5: 使用 Hook
// ============================================================

import { useBreakpoint, useIsMobileNav } from './Layout';

export const ResponsiveHookExample = () => {
  const breakpoint = useBreakpoint();
  const isMobileNav = useIsMobileNav();
  
  return (
    <Container>
      <p>当前断点: {breakpoint}</p>
      <p>是否移动导航模式: {isMobileNav ? '是' : '否'}</p>
      
      {isMobileNav ? (
        <button>打开菜单</button>
      ) : (
        <nav className="flex gap-4">
          <a href="#">链接 1</a>
          <a href="#">链接 2</a>
          <a href="#">链接 3</a>
        </nav>
      )}
    </Container>
  );
};
