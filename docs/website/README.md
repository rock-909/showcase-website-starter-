# 网站起步项目说明

这个目录说明如何把本项目变成一个新的展示型网站。

本项目保留完整网站结构，不提供空白壳子。新项目应从这里开始替换品牌、页面内容、产品或服务信息、图片资产、表单接收方式和部署配置。

## 必读顺序

1. `新项目替换清单.md`
2. `品牌设置.md`
3. `内容设置.md`
4. `部署设置.md`
5. `AI工作流.md`

## 命名规则

- 项目名：`showcase-website-starter`
- 文档目录：`docs/website/`
- 网站配置：`src/config/website/`
- 命令前缀：`website:*`、`brand:*`、`content:*`、`component:*`、`release:*`

不要新增 `docs/template/` 或 `template:*` 命令。

## 工作流边界

- 保留 `.claude/commands/cwf.md` 和 `.claude/commands/dwf.md` 这种工作流能力。
- 不保留旧项目跑出来的 CWF 输出。
- 新的文案工作流产物放在 `docs/workflows/cwf/`。
- starter 首次交付时可以只有 workflow 说明，没有任何页面级 CWF 定稿。
