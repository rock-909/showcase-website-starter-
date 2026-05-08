# Deployment Notes

这份文档记录 starter 当前保留的部署链路和验证边界。  
它不记录旧项目的 preview URL、旧 worker 状态、旧 Durable Object cleanup 或旧上线流水账。

## Current Deployment Model

starter 默认保留 Cloudflare / OpenNext 能力，但不绑定任何真实账号、域名或 secret。

默认入口：

- 标准构建：`pnpm build`
- Cloudflare 构建：`pnpm website:build:cf`
- Cloudflare preview smoke：`node scripts/starter-checks.js cf-preview-smoke`
- Deployed smoke：`node scripts/starter-checks.js deployed-smoke --base-url <url>`
- Cloudflare deploy-artifact dry-run：`pnpm exec wrangler deploy --dry-run --env preview`

真实项目使用前必须替换：

- Cloudflare account
- worker name / route
- 正式域名
- Turnstile keys
- 邮件服务配置
- 表单接收配置
- production / preview secrets

## Current Technical Baseline

当前版本真相以 `package.json`、`.node-version`、`.nvmrc` 和 lockfile 为准。

核心栈：

- Node 24 baseline
- Next.js 16 App Router
- React 19
- TypeScript 6
- Tailwind CSS 4
- OpenNext Cloudflare
- Wrangler

如需核对具体版本，直接读 `package.json`，不要依赖这份文档里的人工摘要。

## Build Order

`pnpm build` 和 `pnpm website:build:cf` 都会使用 `.next` 这一类构建产物，不要并行运行。

推荐顺序：

```bash
pnpm build
pnpm website:build:cf
```

如果只需要普通 Next.js 构建证明，跑 `pnpm build` 即可。

如果改到 Cloudflare / OpenNext / middleware / deploy scripts，再补 `pnpm website:build:cf` 和对应 smoke。

## Cloudflare Topology

当前仓库使用官方 OpenNext Cloudflare CLI，不保留自定义 phase topology wrapper。默认命令：

```bash
pnpm website:build:cf
pnpm exec wrangler deploy --dry-run --env preview
```

真实发布前再根据项目需要选择 preview 或 production deploy：

```bash
pnpm exec opennextjs-cloudflare deploy --env preview
pnpm exec opennextjs-cloudflare deploy --env production
```

不要把 dry-run 当成真实上线证明。它只说明生成后的 Cloudflare worker artifact 能走到 Wrangler dry-run 阶段。

## Runtime Cache Policy

starter 默认不依赖 R2 / D1 / Durable Object 作为运行时内容缓存和内容失效机制。

内容、翻译、页面更新默认通过重新构建和重新部署发布。

如果未来项目需要 CMS 或运行时内容失效，需要重新做架构决策，并同步更新：

- `.claude/rules/cloudflare.md`
- `docs/technical/next16-cache-notes.md`
- `docs/guides/RELEASE-PROOF-RUNBOOK.md`
- 相关测试和部署脚本

## Environment Files

不入库：

- `.env.local`
- `.env`
- `.dev.vars`
- `.mcp.json`
- Cloudflare token
- email / Turnstile / Airtable / CRM secrets

只允许入库：

- `.dev.vars.example`
- `.mcp.example.json`
- 文档中的占位示例

## Launch Boundary

`pnpm build` 通过不等于 Cloudflare 可用。
`pnpm website:build:cf` 通过不等于页面可访问。
`node scripts/starter-checks.js deployed-smoke` 通过也不等于真实询盘链路已闭环。

正式上线前至少确认：

- 真实域名和 SSL 正常；
- preview / production secrets 已配置；
- Contact 表单在部署环境可提交；
- 邮件、CRM、表格或其他接收方收到测试线索；
- Turnstile 或反滥用配置符合实际环境；
- 关键页面 SEO metadata、canonical、hreflang、JSON-LD 基本正确。

## Starter Rule

本 starter 不携带旧项目的上线证据。  
派生项目上线后，应在派生项目里记录自己的 deployment notes，而不是把 starter 里的示例说明当成生产证明。
