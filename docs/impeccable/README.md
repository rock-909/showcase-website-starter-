# Impeccable Workspace

这个目录保留 starter 的设计治理工作盘。

它的目标不是保存旧项目的所有设计过程，而是给后续 AI 和人类协作者一个清楚的设计操作面：

- 怎么判断页面是否清楚、可信、好用；
- 怎么复用组件；
- 怎么使用 token；
- 怎么通过 Storybook 做视觉确认；
- 怎么避免 AI 随手造重复组件。

## 当前结构

- `design-workflow.md`：通用 DWF / Impeccable 设计工作流。
- `system/`：当前可复用设计系统与规范。
- `external/`：少量外部参考资料。

## 已移出主树的内容

旧项目页面研究、旧行业证据矩阵、旧 homepage shape brief、旧产品结构草案、旧 sitemap 快照，已经不作为 starter 当前真相源。

需要追溯时看 git 历史或本机 Trash 批次，不要把它们恢复为 starter baseline。

## 使用规则

- 做 UI/页面调整前，优先看 `DESIGN.md`、`docs/design-truth.md`、`system/COMPONENT-GOVERNANCE.md`。
- 新增组件前，先按组件治理决策树判断是否复用。
- 视觉规则要写成可复用规则，不要写成某个客户项目的专属偏好。
- 示例业务内容可以帮助预览，但不能成为未来项目的品牌真相。
