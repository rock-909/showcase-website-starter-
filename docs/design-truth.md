# Design Truth

这份文档只记录 starter 当前已经确认的设计真相。  
它不是某个客户项目的最终品牌规范。

## 当前设计定位

`showcase-website-starter` 的默认设计方向是：

- 清晰
- 可信
- 现代
- 克制
- 易替换
- 便于 AI 复用和维护

默认避免两种偏差：

1. 过度装饰，导致内容和行动路径不清楚。
2. 组件随手新增，导致后续 AI 难以复用和维护。

## 当前品牌表达

当前视觉只是 starter 基线，不是派生项目的最终品牌。

设计上要做到：

- 示例内容看起来完整可运行；
- 新品牌替换时不需要逐个组件改颜色；
- 组件状态、表单、卡片、导航等有统一规则；
- Storybook 可以作为组件预览和审核面。

## 当前视觉基线

现有 token、圆角、阴影、网格和布局节奏可以继续作为当前控制面板。  
但派生项目确认真实品牌后，可以替换 token 值和视觉风格。

### 色彩

- Current truth: starter uses a replaceable role-based color system.
- Stable interface: semantic roles and token architecture.
- Provisional value: current blue/neutral palette.

规则：

- 生产组件不直接写品牌 hex。
- 改品牌色先改 token。
- 如果 token 角色变化，需要同步 `docs/impeccable/system/COLOR-SYSTEM.md` 和相关测试。

### 字体

- 当前主字体基线：Figtree + 中英文混排回退策略。
- 排版优先清晰、稳定、可读。

### 形状与阴影

- 默认圆角和阴影保持克制。
- 阴影用于区分层级或表达交互，不用于填充空白。

## 当前交互与动效原则

- 动画服务于理解，不服务于表演。
- 默认使用 restraint + speed + purposeful motion。
- 常规交互动效应保持短促。
- 尊重 reduced motion。

## 当前组件治理原则

- 先复用，再新增。
- 低层 UI 组件不能塞业务文案。
- 可复用组件要有清晰 variants。
- 视觉上容易漂移的组件应补 Storybook story。
- 新组件如果只是现有组件的轻微变体，优先扩展现有组件。

## 当前不采用的方向

- 把 starter 做成某个具体行业的固定品牌。
- 每个页面随手新建一套按钮、卡片、表单。
- 大量硬编码颜色。
- 用 fake proof、fake logo、fake 客户来制造信任。

## 真相来源

当前设计真相主要来自：

- `src/app/globals.css`
- `docs/impeccable/system/COLOR-SYSTEM.md`
- `docs/impeccable/system/COMPONENT-GOVERNANCE.md`
- `DESIGN.md`

`docs/impeccable/system/DESIGN-TOKENS.md` 可作为历史背景或设计系统参考，但当前颜色 contract 以 `COLOR-SYSTEM.md` 为准。
