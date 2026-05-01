# Dependency Upgrade Policy

这份文档记录**当前技术栈升级时哪些能升、哪些不能顺手升**。
目标不是阻止升级，而是避免每次看到 `pnpm outdated` 都重新靠记忆判断。

## 当前原则

1. 安全补丁优先；如果 `pnpm audit --prod --audit-level moderate` 报漏洞，不能用 hold 掩盖。
2. patch / minor 可以进入同一条小升级线，但必须跑对应证明。
3. major 升级、`0.x` minor 升级、编译器/格式化/部署工具升级要拆成独立 lane。
4. 生产运行链和 Cloudflare 构建链优先于“npm latest 好看”。
5. `pnpm tech:check` 会把已确认的 hold 项列成 `held_updates`，但不再把它们当成失败项；真正未处理的升级仍会出现在 `needs_update` 并阻塞。

## 当前 hold 清单

| Package | Current reason | Safe next step |
| --- | --- | --- |
| `@types/node` | 项目 runtime 支持范围是 `>=24 <25`，Node 25 types 不匹配 | 只有当 runtime baseline 扩到 Node 25 时再升 |

## 这次升级经验

### react-grab

`react-grab` 不是简单改版本号：旧 companion `@react-grab/claude-code` 已经不适合继续作为当前入口。当前仓库改为：

- `react-grab 0.1.32`
- `@react-grab/mcp 0.1.32`
- 本地 helper 使用 `@react-grab/mcp/server` 的 `startMcpServer()`
- 浏览器侧 CDN bridge 使用 `@react-grab/mcp@0.1.32/dist/client.global.js`

验证重点：

- helper 能 import 到 `startMcpServer`
- `src/app/[locale]/layout.tsx` 只在 development 且未禁用 dev tools 时加载这些脚本
- paired test 断言具体 CDN URL，而不是只数 `<Script>` 个数

### React Email 6

`react-email` 6 迁移不是单纯改版本号。当前仓库采用：

- `react-email 6.0.5` 作为邮件组件和 render 的统一入口
- `@react-email/ui 6.0.5` 支撑本地 email preview
- 移除已 deprecated 的 `@react-email/components` 和 `@react-email/preview-server`
- 保留 `@react-email/render 2.0.8` 作为 `resend` peer dependency 的显式依赖
- `pnpm.overrides["@react-email/ui>next"] = "$next"`，避免预览工具链带入旧 Next patch
- `react-email 6.0.5` 当前会经由 `glob` 带入 vulnerable `brace-expansion 5.0.4`，因此用 `pnpm.overrides["brace-expansion@>=5.0.0 <5.0.5"] = "5.0.5"` 固定到 patched patch

验证重点：

- 管理员通知、客户确认、产品询盘三类模板都能 HTML render
- 三类模板都能 plain text render
- `email:dev` 能启动 React Email 6 preview
- Resend 发送路径继续生成 plain text 内容
- `pnpm deps:check` 不再出现 React Email 5 hold 项

### prettier-plugin-tailwindcss 0.8

`prettier-plugin-tailwindcss` 仍在 `0.x`，因此 minor 升级按独立 formatting lane 处理。
本次 `0.7.2 -> 0.8.0` 没有触发全仓格式化 churn。

验证重点：

- `pnpm format:check` 通过
- 不和业务代码或其它依赖升级混在同一个提交里

### ESLint 10

ESLint 10 不能只改版本号。当前仓库采用：

- `eslint 10.2.1`
- `@eslint/js 10.0.1`
- `eslint-plugin-security 4.0.0`
- `eslint-plugin-react-you-might-not-need-an-effect 0.9.3`
- `@eslint/compat 2.0.5`

这次升级的关键点：

- `eslint-plugin-react`、`eslint-plugin-import`、`eslint-plugin-jsx-a11y` 的 latest 仍未完全声明 ESLint 10 peer 范围，其中一部分由 `eslint-config-next` 间接带入。
- 旧 React ESLint rule API 在 ESLint 10 下会触发 `contextOrFilename.getFilename is not a function`，因此 Next 官方配置通过 `@eslint/compat` 的 `fixupConfigRules()` 包一层，而不是关闭规则。
- `pnpm.peerDependencyRules.allowedVersions` 只用于记录这批已验证的 ESLint 10 peer 噪声；如果后续插件 release 正式支持 ESLint 10，应优先移除这段兼容声明。
- ESLint 10 暴露了 `preserve-caught-error`、`no-useless-assignment` 相关问题，本次已把丢失的原始错误挂到 `cause`，并去掉无意义初始赋值。

验证重点：

- `pnpm lint:check` 能完整跑完
- `pnpm type-check` / `pnpm type-check:tests` 通过
- 受影响的 SEO、Resend、Airtable 错误处理测试通过
- `pnpm deps:check` 不再出现 ESLint 10 hold 项

### TypeScript 6

`typescript` 6 迁移不是只改版本号。当前仓库采用：

- `typescript 6.0.3`
- 移除 `tsconfig.json` 里的 `baseUrl`，保留显式 `paths` alias
- 移除旧的 `ignoreDeprecations: 5.0`，不再靠静默配置掩盖编译器弃用项
- 补齐 `tsconfig.typecheck-source.json`，让已有 `pnpm type-check:source` 脚本可执行

这次升级的关键点：

- TypeScript 6 会把 `baseUrl` 作为弃用错误处理；当前项目没有依赖裸的 `src/...`、`components/...` 等 baseUrl import，因此可以直接移除。
- `@/*`、`@messages/*`、`@content/*` 继续通过 `paths` 工作。
- 新版 DOM 类型要求 `IntersectionObserver.scrollMargin`，测试 mock 需要补齐这个只读字段。

验证重点：

- `pnpm type-check:source` 通过
- `pnpm type-check:tests` 通过
- `pnpm type-check` 通过
- 与 Turnstile / IntersectionObserver 相关测试通过
- `pnpm build` 和 `pnpm build:cf` 都要跑，因为 Next 文档明确生产构建会执行类型检查
- `pnpm deps:check` 不再出现 TypeScript hold 项

### `@types/node` / Node runtime

`@types/node` 不能按 npm latest 直接升。当前结论：

- 使用 `@types/node 24.x`
- 不把 `@types/node` 升到 `25.x`
- 项目 runtime baseline 已迁到 Node `24.15.0` LTS

原因：

- 当前 `package.json` 运行时范围是 `>=24 <25`
- GitHub Actions 和本地 `ci:local` 都以 Node `24.15.0` 作为 proof baseline
- Node 官方说明生产应用应使用 Active LTS 或 Maintenance LTS；Node 25 是 Current，不是 LTS
- Vercel 当前可用 Node major 是 `24.x`、`22.x`、`20.x`，没有 Node 25
- Cloudflare Wrangler 可以在 Current / Active / Maintenance Node 上运行，但 Worker 最终运行在 `workerd`，这不能证明应用代码可以安全使用 Node 25 API

参考来源：

- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- Vercel supported Node.js versions: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- Cloudflare Wrangler install/update: https://developers.cloudflare.com/workers/wrangler/install-and-update/

所以这条不是“忘了升”，而是类型定义必须和真实运行时对齐。否则 TypeScript 会允许 Node 25 API，但 CI / Vercel / Node 24 proof baseline 实际不可用。

Node 24 迁移验证重点：

1. `pnpm install --frozen-lockfile` 必须在 Node 24 下通过，验证 native/binary 依赖能安装。
2. `pnpm type-check`、`pnpm type-check:tests`、`pnpm lint:check` 必须通过。
3. `pnpm build` 和 `pnpm build:cf` 必须通过。
4. `pnpm ci:local:quick` 或完整 CI 必须在 Node 24 下通过。
5. Vercel Project Settings 的 Node.js Version 建议同步切到 `24.x`；`package.json > engines.node` 也会约束 Vercel 使用 Node 24，但最终以部署日志中的实际 Node major 为准。
6. 只有当 Vercel、CI 和项目运行时都明确支持 Node 25 时，才考虑 `@types/node 25.x`。

### `critters`

`critters` 已从仓库移除，不替换成 `beasties`。

原因：

- `critters` 只在 Next.js 的 `experimental.optimizeCss` 路径里被动态 `require("critters")`
- 当前仓库没有开启 `experimental.optimizeCss`
- 当前仓库还明确关闭 `experimental.inlineCss`，因为它会引入 FOUC 和首屏性能回退
- `beasties` 是 `critters` 的维护 fork，但 Next.js 16.2.4 当前并不会自动 `require("beasties")`
- 因此直接新增 `beasties` 会变成新的未使用依赖，不是稳定升级

验证重点：

- `pnpm build` 通过
- `pnpm build:cf` 通过
- `pnpm unused:check` 通过
- `pnpm deps:check` 不再出现 deprecated `critters`

### tech check

`pnpm tech:check` 的目标是指出真正需要处理的问题。
当前策略是：

- 有可行动升级：`needs_update` 非空，命令失败
- 只有已确认 hold：`held_updates` 非空但 `needs_update` 为空，命令通过
- 有安全漏洞：不能 hold，必须失败
