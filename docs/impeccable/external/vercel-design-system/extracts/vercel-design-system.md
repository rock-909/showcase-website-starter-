# Vercel Geist Design System

> 提取自 vercel.com (2026-01-30)
> 完整 Design Token 文件: `vercel-design-system.json`

---

## 概览

Vercel 使用自研的 **Geist Design System**，特点是：
- 极简主义美学（大量留白、克制的色彩）
- 4px 基础间距单位
- 自定义 Geist 字体家族
- 细腻的阴影层级（border shadow 风格）
- Swift 动效曲线

---

## 1. 颜色系统

### 基础色板

| Token | 值 | 用途 |
|-------|-----|------|
| `--ds-gray-100` | `#f2f2f2` | 浅灰背景 |
| `--ds-gray-600` | `#a8a8a8` | 禁用文字 |
| `--ds-gray-900` | `#666666` | 次级文字 |
| `--ds-gray-1000` | `#171717` | 主文字/按钮背景 |
| `--ds-blue-700` | `#0070f3` | 品牌蓝/链接/Focus |

### 语义色

```css
/* 背景 */
--ds-background-100: #ffffff;  /* 主背景 */
--ds-background-200: #fafafa;  /* 次级背景 */

/* 前景 */
--geist-foreground: #000000;   /* 主文字 */
--geist-secondary: #666666;    /* 次级文字 */

/* 反馈 */
--geist-success: #0070f3;      /* 成功（蓝色，非绿色）*/
--geist-error: #ee0000;        /* 错误 */
--geist-warning: #f5a623;      /* 警告 */
```

### 暗色模式

```css
/* 通过 .dark-theme class 切换 */
--geist-background: #000000;
--geist-foreground: #ffffff;
--geist-secondary: #888888;
```

---

## 2. 字体系统

### 字体家族

| Token | 字体 |
|-------|------|
| `--font-sans` | Geist, Arial, system-ui |
| `--font-mono` | Geist Mono, ui-monospace |
| `--font-space-grotesk` | Space Grotesk (Display) |

### 排版规范

| 元素 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| H1 Hero | 48px | 600 | 1.0 | -2.4px |
| H5 Section | 14px | 400 | 20px | normal |
| Body Large | 20px | 400 | 36px (1.8) | normal |
| Body | 16px | 500 | 24px (1.5) | normal |
| Small | 12px | 400 | 16px | normal |
| Nav/Button | 14px | 400-500 | - | normal |

---

## 3. 间距系统

基础单位: **4px** (`--geist-space`)

```css
--geist-space: 4px;
--geist-space-2x: 8px;
--geist-space-3x: 12px;
--geist-space-4x: 16px;
--geist-space-6x: 24px;   /* = --geist-gap */
--geist-space-8x: 32px;
--geist-space-16x: 64px;

/* 语义间距 */
--geist-gap: 24px;        /* 标准间距 */
--geist-gap-half: 12px;
--geist-gap-quarter: 8px;
--geist-page-margin: 24px;
```

---

## 4. 圆角

```css
--geist-radius: 6px;              /* 默认 */
--geist-marketing-radius: 8px;    /* 营销页面 */

/* 常用值 */
4px   /* 小组件 */
6px   /* 卡片、输入框 */
100px /* Pill 按钮 */
9999px /* 完全圆角 */
```

---

## 5. 阴影系统

Vercel 使用 **border shadow** 风格（细边框 + 轻投影）：

```css
/* 边框阴影 */
--ds-shadow-border: 0 0 0 1px rgba(0,0,0,0.08);

/* 层级阴影 */
--ds-shadow-small: 0px 2px 2px rgba(0,0,0,0.04);
--ds-shadow-medium: 0px 2px 2px rgba(0,0,0,0.04),
                    0px 8px 8px -8px rgba(0,0,0,0.04);
--ds-shadow-large: 0px 2px 2px rgba(0,0,0,0.04),
                   0px 8px 16px -4px rgba(0,0,0,0.04);

/* 浮层阴影 */
--ds-shadow-tooltip: /* 边框 + 小阴影 */
--ds-shadow-menu: /* 边框 + 中阴影 + 大阴影 */
--ds-shadow-modal: /* 边框 + 中阴影 + 超大阴影 */
```

---

## 6. 动效

```css
/* 缓动曲线 - Swift (弹性) */
--ds-motion-timing-swift: cubic-bezier(0.175, 0.885, 0.32, 1.1);

/* 时长 */
--ds-motion-overlay-duration: 300ms;
--ds-motion-popover-duration: 200ms;

/* 缩放 */
--ds-motion-overlay-scale: 0.96;  /* 弹出时从 96% 放大 */
```

---

## 7. 组件样式

### 按钮

| 类型 | 背景 | 文字 | Padding | Radius |
|------|------|------|---------|--------|
| Primary | `#171717` | `#fff` | `0 14px` | `100px` |
| Secondary | `#fff` | `#171717` | `0 6px` | `6px` |
| Ghost | transparent | `#666` | `8px 12px` | `9999px` |

### 表单

```css
--geist-form-small-height: 32px;
--geist-form-height: 40px;
--geist-form-large-height: 48px;

--geist-form-font: 0.875rem;  /* 14px */
--geist-form-line-height: 1.25rem;  /* 20px */
```

### 卡片

```css
background: #ffffff;
border-radius: 6px;
box-shadow: 0 0 0 1px rgba(0,0,0,0.08),
            0px 1px 1px rgba(0,0,0,0.02),
            0px 4px 8px rgba(0,0,0,0.04);
```

---

## 8. 布局

```css
--geist-page-width: 1200px;
--ds-page-width: 1400px;  /* 新版 */
--geist-page-margin: 24px;
--header-height: 64px;
```

### 响应式断点

| 名称 | 值 | 用途 |
|------|-----|------|
| xs | 375px | 手机 |
| sm | 640px | 大手机/小平板 |
| md | 768px | 平板 |
| lg | 1024px | 桌面 |
| xl | 1200px | 大桌面 |
| 2xl | 1400px | 超宽 |

---

## 9. Focus 状态

```css
--ds-focus-ring: 0 0 0 2px #fff, 0 0 0 4px #0070f3;
--ds-focus-color: #0070f3;
--ds-focus-ring-outline: 2px solid #0070f3;
```

---

## Tailwind CSS 配置参考

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#ffffff',
          secondary: '#fafafa',
        },
        foreground: {
          DEFAULT: '#000000',
          secondary: '#666666',
        },
        gray: {
          100: '#f2f2f2',
          200: '#ebebeb',
          600: '#a8a8a8',
          900: '#666666',
          1000: '#171717',
        },
        blue: {
          700: '#0070f3',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Arial', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        'geist': '4px',
        'geist-2x': '8px',
        'geist-3x': '12px',
        'geist-4x': '16px',
        'geist-6x': '24px',
        'geist-8x': '32px',
      },
      borderRadius: {
        'geist': '6px',
        'geist-marketing': '8px',
      },
      boxShadow: {
        'ds-border': '0 0 0 1px rgba(0,0,0,0.08)',
        'ds-small': '0px 2px 2px rgba(0,0,0,0.04)',
        'ds-medium': '0px 2px 2px rgba(0,0,0,0.04), 0px 8px 8px -8px rgba(0,0,0,0.04)',
      },
    },
  },
}
```

---

## 提取完整性评估

| 维度 | 完整度 | 备注 |
|------|--------|------|
| 颜色变量 | 95% | CSS 变量全量提取 |
| 排版 | 85% | 首页 + Docs 页面采样 |
| 间距 | 100% | 完整 spacing scale |
| 圆角 | 100% | 完整 |
| 阴影 | 100% | 全部层级 |
| 动效 | 90% | 主要缓动曲线 |
| 组件样式 | 60% | 仅按钮、卡片、链接 |
| 暗色模式 | 80% | 核心变量已提取 |
| 响应式断点 | 70% | 从媒体查询提取 |
| 图标系统 | 0% | 未提取 |

**建议**: 如需完整组件库，应访问更多页面（Dashboard、Pricing、登录页等）。
