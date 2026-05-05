# 结构共改簇清单

## 目的

这份文档记录仓库里那些**经常一起变、应该一起审**的文件簇。  
目的是防止只盯着一个文件改，结果把整条结构链改歪了。

来源：

- `reports/architecture/structural-hotspots-latest.md`

## Cluster 1：翻译运行时与兼容副本

### Files

- `messages/en/critical.json`
- `messages/en/deferred.json`
- `messages/zh/critical.json`
- `messages/zh/deferred.json`
- `messages/en.json`
- `messages/zh.json`

### 为什么重要

- `critical.json` / `deferred.json` 是 runtime 翻译真相
- flat `messages/en.json` / `messages/zh.json` 是测试、脚本和兼容视图使用的派生副本
- 这组文件不只是存内容，还直接影响 runtime 用户可见语义

### Review rule

- runtime split source 只要改了一个，对应 locale 的 split + flat 兼容副本都要一起看
- 如果影响 runtime-facing copy 或 error semantics，至少走 `local-full proof`
- 执行命令：

```bash
pnpm review:translation-quartet
```

## Cluster 2：线索提交通道

### Files

- `src/lib/actions/contact.ts`
- `src/app/api/inquiry/route.ts`
- `src/app/api/subscribe/route.ts`
- `src/lib/api/lead-route-response.ts`

### 为什么重要

- 这几个入口历史上就是一起动的
- 只要动到错误处理、校验、防滥用、响应语义，就不能只审一个点

### Review rule

- 一个 submission surface 发生实质变化时，其他 family member 也要一起看，防 contract drift
- 涉及 validation、rate limit、abuse logic，就要走 security-aware review
- 当前 lead-family proof 分两层看：`lead-family-contract.test.ts` 是 auxiliary contract proof，只看响应外壳和 observability；`lead-family-protection.test.ts`、route tests 和 subscribe tests 是 route-level protection proof。
- 当前 live contract surface 就是这些文件本身 + `pnpm review:lead-family`
- 执行命令：

```bash
pnpm review:lead-family
```

## Cluster 3：首页分区簇

### Files

- `src/components/sections/hero-section.tsx`
- `src/components/sections/products-section.tsx`
- `src/components/sections/final-cta.tsx`
- `src/components/sections/sample-cta.tsx`
- `src/components/sections/resources-section.tsx`
- `src/components/sections/scenarios-section.tsx`

### 为什么重要

- 这几个 section 历史上高频共改
- 一个区域的局部 polish，常常会把整页层级、proof 节奏、CTA 顺序带歪

### Review rule

- 只要改到首页 section，默认把它当一组来审
- 当前 live contract surface 是这些 section 文件 + `pnpm review:homepage-sections`
- 执行命令：

```bash
pnpm review:homepage-sections
```

## Cluster 4：Locale Runtime Surface

### Files

- `src/middleware.ts`
- `src/i18n/request.ts`
- `src/i18n/locale-utils.ts`
- `src/i18n/locale-presentation.ts`
- `src/lib/load-messages.ts`
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/head.tsx`
- `src/app/global-error.tsx`
- `src/lib/seo-metadata.ts`
- `src/lib/content-utils.ts`

### Review rule

- 这个簇优先按 [`.claude/rules/i18n.md`](../../.claude/rules/i18n.md) 来看
- 执行命令：

```bash
pnpm review:locale-runtime
```

## Cluster 5：健康信号 + 缓存标签工具

### Files

- `src/lib/cache/cache-tags.ts`
- `src/app/api/health/route.ts`
- `src/lib/api/cache-health-response.ts`
- `tests/integration/api/health.test.ts`
- `src/__tests__/middleware-locale-cookie.test.ts`

### Review rule

- 当前 live contract surface 是 health route、health response helper、cache tag utilities + `pnpm review:health`
- 执行命令：

```bash
pnpm review:health
```

## 使用方式

- staged diff 碰到 Tier A 路径时，先跑：

```bash
pnpm review:tier-a:staged
```

- 默认的 staged 结构审查入口是：

```bash
pnpm review:clusters:staged
```

- 如果你已经很清楚只碰到一个簇，就跑：

```bash
pnpm review:cluster <name> --staged
```

## 配套文档

- [`docs/guides/TIER-A-OWNER-MAP.md`](./TIER-A-OWNER-MAP.md)
- [`docs/guides/QUALITY-PROOF-LEVELS.md`](./QUALITY-PROOF-LEVELS.md)
- [`.claude/rules/i18n.md`](../../.claude/rules/i18n.md)
