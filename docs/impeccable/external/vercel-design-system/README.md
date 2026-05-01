# Vercel 风格设计系统

从 Vercel 官网提取的布局设计规范，可直接迁移到其他项目使用。

## 📁 文件结构

```
vercel-design-system/
├── README.md                    # 本文件
├── LAYOUT-SPEC.md               # 详细设计规范文档
├── tailwind.config.js           # Tailwind 配置
├── layout.css                   # CSS 变量和工具类
└── components/
    ├── Layout.tsx               # React 组件
    └── examples.tsx             # 使用示例
```

## 🚀 快速开始

### 1. 复制 Tailwind 配置

将 `tailwind.config.js` 中的配置合并到你的项目：

```javascript
// 你的 tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1150px',   // ← 导航切换点
      '2xl': '1400px',
    },
    extend: {
      maxWidth: {
        'container': '1080px',
        'narrow': '860px',
      },
    },
  },
}
```

### 2. 导入 CSS 变量

```css
/* 在你的全局 CSS 中 */
@import './vercel-design-system/layout.css';
```

### 3. 使用 React 组件

```tsx
import { Container, DecorativeGrid } from './vercel-design-system/components/Layout';

export default function Page() {
  return (
    <DecorativeGrid columns={12} rows={6}>
      <Container>
        <h1>Hello World</h1>
      </Container>
    </DecorativeGrid>
  );
}
```

## 📐 核心规范

### 容器宽度

| 变体 | 宽度 | 用途 |
|------|------|------|
| `default` | 1080px | 标准页面 |
| `narrow` | 860px | 文章、博客 |
| `form` | 640px | 登录、表单 |
| `wide` | 1280px | 仪表盘 |

### 响应式断点

| 断点 | 宽度 | 说明 |
|------|------|------|
| `sm` | 640px | 大屏手机 |
| `md` | 768px | 平板竖屏 |
| `lg` | 1024px | 小桌面 |
| `xl` | **1150px** | 导航切换点 ⭐ |
| `2xl` | 1400px | 大桌面 |

### 网格线颜色

| 模式 | 颜色值 |
|------|--------|
| 浅色 | `rgba(0, 0, 0, 0.05)` |
| 深色 | `rgba(255, 255, 255, 0.05)` |

## 📖 详细文档

查看 [LAYOUT-SPEC.md](./LAYOUT-SPEC.md) 获取完整的设计规范说明。

## 🎨 设计原则

1. **极度克制** - 装饰元素只有 5% 不透明度
2. **8px 基准** - 所有间距遵循 8px 网格
3. **内容优先** - 装饰不干扰内容阅读
4. **响应式** - 1150px 是关键切换点
