# 项目技术栈

这份文档只讲**当前正在用的技术栈真相**。  
版本和能力以 `package.json`、`engines`、现有脚本为准，不再复述历史升级过程。

升级边界和当前 hold 清单见 `docs/technical/dependency-upgrade-policy.md`。

## 1. 核心运行层

### 前端框架

- **Next.js 16.2.4**：主框架，使用 App Router
- **React 19.2.5**：UI 运行时
- **TypeScript 6.0.3**：类型系统
- **Tailwind CSS 4.2.4**：样式系统

### 当前页面与数据执行方式

- **App Router**：页面和路由主框架
- **Cache Components**：当前缓存架构的一部分
- **Server Actions**：表单提交和服务端写入主通道
- **Turbopack**：默认本地开发构建器（`pnpm dev`）
- **Webpack**：当前 Cloudflare 构建链主执行面（`pnpm build:cf`）

## 2. 内容、国际化与配置层

### 国际化

- **next-intl 4.11.0**：多语言框架
- 当前语言：**en / zh**
- 运行时翻译文件：`messages/{locale}/critical.json` + `messages/{locale}/deferred.json`
- 翻译同步与校验走仓库脚本，不依赖外部 CMS

### 内容管理

- **@next/mdx 16.2.4**
- **@mdx-js/loader 3.1.1**
- **@mdx-js/react 3.1.1**
- **gray-matter 4.0.3**
- 内容源以仓库内文件为主，不走 Headless CMS

### 环境与配置

- **@t3-oss/env-nextjs 0.13.11**：环境变量校验
- **Zod 4.3.6**：输入和配置校验
- 站点配置以 `src/config/**` 为主真相源

## 3. UI 与交互层

### 组件体系

- **shadcn/ui**：基础组件来源
- **Radix UI**
  - `@radix-ui/react-accordion 1.2.12`
  - `@radix-ui/react-dialog 1.1.15`
  - `@radix-ui/react-dropdown-menu 2.1.16`
  - `@radix-ui/react-label 2.1.8`
  - `@radix-ui/react-navigation-menu 1.2.14`
  - `@radix-ui/react-slot 1.2.4`
  - `@radix-ui/react-tabs 1.1.13`

### 样式与体验辅助

- **class-variance-authority 0.7.1**：变体样式管理
- **clsx 2.1.1**
- **tailwind-merge 3.5.0**
- **next-themes 0.4.6**：主题切换
- **lucide-react 1.12.0**：图标
- **nextjs-toploader 3.9.17**：页面切换进度条
- **tailwindcss-animate 1.0.7**：动画扩展
- **@tailwindcss/typography 0.5.19**：排版增强

## 4. 表单、线索与外部服务

### 线索与消息

- **Airtable 0.12.2**：线索数据落地
- **Resend 6.12.2**：邮件发送
- **react-email 6.0.5**：邮件组件、模板 render 与本地预览 CLI
- **@react-email/render 2.0.8**：Resend peer dependency 显式依赖
- **@react-email/ui 6.0.5**：本地邮件预览 UI

### 安全与防刷

- **@marsidev/react-turnstile 1.5.1**：Cloudflare Turnstile
- 表单提交以 **Server Actions + Zod + Turnstile** 为主组合

## 5. 测试与质量门禁

### 单元 / 集成测试

- **Vitest 4.1.5**
- **@vitest/coverage-v8 4.1.5**
- **Testing Library**
  - `@testing-library/react 16.3.2`
  - `@testing-library/dom 10.4.1`
  - `@testing-library/jest-dom 6.9.1`
  - `@testing-library/user-event 14.6.1`
- **jsdom 29.1.0**
- **happy-dom 20.3.7**
- **fast-check 4.7.0**

### E2E / 可访问性 / 性能

- **Playwright 1.59.1**
- **@axe-core/playwright 4.11.2**
- **axe-core 4.11.3**
- **Lighthouse CI**
  - `@lhci/cli 0.15.1`
  - `lighthouse 12.8.2`

### 静态质量工具

- **ESLint 10.2.1**
- **@eslint/js 10.0.1**
- **@eslint/compat 2.0.5**：兼容部分尚未正式声明 ESLint 10 支持的 Next/React ESLint 规则
- **typescript-eslint 8.59.1**
- **eslint-plugin-security 4.0.0**
- **eslint-plugin-react-you-might-not-need-an-effect 0.9.3**
- **Prettier 3.8.3**
- **prettier-plugin-tailwindcss 0.8.0**
- **@ianvs/prettier-plugin-sort-imports 4.7.1**
- **dependency-cruiser 17.3.10**：依赖边界检查
- **knip 6.7.0**：未使用代码扫描
- **Stryker 9.6.1**：变异测试工具，主要覆盖 lead/security/form-schema/idempotency 高风险逻辑
- **commitlint 20.5.2**
- **lefthook 2.1.6**

## 6. 构建、部署与运行环境

### 包管理与运行时

- **pnpm 10.13.1**
- **Node.js 支持范围**：`>=24 <25`
- 当前仓库的**proof baseline** 按 **Node 24.15.x LTS** 看
- **@types/node 24.12.2**：跟当前 Node 24 LTS 运行边界对齐，不跟随 Node 25 类型面

### Cloudflare 构建链

- **@opennextjs/cloudflare 1.19.4**
- **wrangler 4.86.0**
- `pnpm build`：标准 Next.js 构建
- `pnpm build:cf`：Cloudflare 构建
- `pnpm preview:cf`：本地 stock preview，仅用于页面级初筛
- `pnpm deploy:cf` / `pnpm deploy:cf:preview`：phase6 worker 拓扑部署入口
- `pnpm deploy:cf:phase6:dry-run`：不改远端状态的 phase6 部署证明

### 额外构建与诊断工具

- **@next/bundle-analyzer 16.2.4**
- **dotenv 17.4.2**
- **glob 13.0.6**
- **postcss 8.5.12**
- **@tailwindcss/postcss 4.2.4**
- **tsx 4.21.0**
- **react-grab 0.1.32 + @react-grab/mcp 0.1.32**：仅开发环境加载的页面上下文选取辅助
- **Babel AST 工具链**
  - `@babel/parser 7.29.2`
  - `@babel/traverse 7.29.0`
  - `@babel/generator 7.29.1`

## 7. 监控与分析

- **@vercel/analytics 2.0.1**
- **@vercel/speed-insights 2.0.0**
- **Google Analytics 4**：通过环境变量接入
- 仓库内另有质量、架构、边界泄漏、文档真相检查脚本，作为治理门禁的一部分

## 8. 一句话总结

这个项目不是普通展示站加一点样式。  
它现在的真实技术底座是：**Next.js 16 + React 19 + TypeScript + Tailwind 4 + next-intl + MDX + Server Actions + Cloudflare/OpenNext + 一整套 repo-level proof scripts**。
