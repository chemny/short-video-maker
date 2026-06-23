# Templates & Effects Catalog

This file is the **selection menu** for the video generation step. When building
`video-plan.json` (Core Workflow step 7), the agent MUST consult this file to:

1. Pick `style.template` based on content type.
2. Fill the per-scene fields that each template needs to activate its effects.
3. Choose per-scene `transition`.

If a template's required fields are missing, its signature effects simply won't
render — the content falls back to plain text. So filling these fields is what
"turns on" the animations and components.

---

## 1. Template Selection

Set `style.template` to one of these. Pick by the **dominant nature of the content**:

| Content signal | `template` | Why |
|---|---|---|
| 通用知识解释 / 方法论 / 观点拆解 | `clean-explainer` | 清爽信息层级、强标题、关键词条，适合多数可发布短视频 |
| AI 工具 / 工作流 / 操作流程 / SOP | `app-workflow` | 模拟应用窗口 + 流程节点，适合讲工具如何进入日常动作 |
| 小红书收藏型 / 笔记感 / 框架总结 | `sketch-notes` | 纸张网格、手绘边框、荧光标记，适合收藏转发 |
| 知识科普 / 概念解释 / 观点陈述，**无配图** | `dark-card` | 深色卡片 + 旋转线框球背景，关键词随旁白逐个点亮 |
| 结构化要点 / 产品介绍 / 步骤流程 / 框架拆解 | `apple-text-video` | 高级文字视频，按场景类型自动配色，渐变标题 + 玻璃卡 + 16:9 图框 |
| 数据驱动 / 效果对比 / 增长 / ROI / 量化结论 | `data-punch` | 大数字计数动画 + 前后对比条 + 三列指标卡 |
| 强视觉 / 情绪化 / 案例叙事，**有真实配图** | `image-overlay` | 全屏图 + 底部渐变蒙层 + Ken Burns 缓动 |
| 不确定 / 通用 | `clean-explainer` | 安全默认 |

A single video uses **one** template across all scenes (consistent visual
identity). Mixing templates per-scene is not supported.

## 1.1 Visual Preset Selection

`style.preset` controls colors, surface treatment, line weight, and overall feel. It is separate from `style.template`.

| Content/brand signal | `preset` | Why |
|---|---|---|
| 小红书知识笔记 / 收藏型内容 / 亲和但不幼稚 | `warm-note` | 暖纸色、深灰字、黄色标记，适合笔记感 |
| 工具、代码、系统、SOP、技术说明 | `mono-tech` | 黑白灰 + 少量青色，克制、理性、扫描友好 |
| SaaS、工作流、效率工具、产品方法 | `soft-product` | 浅色产品感、柔和绿青、适合 app-workflow |
| 强观点、案例、情绪叙事、暗色品牌 | `dark-cinematic` | 深色高对比、金色 accent，适合更戏剧化内容 |

Recommended combinations:

- `clean-explainer + warm-note`
- `app-workflow + soft-product`
- `sketch-notes + warm-note`
- `data-punch + dark-cinematic`
- `image-overlay + dark-cinematic`

---

## 2. Per-Scene Fields Each Template Needs

All scenes always need: `id`, `start`, `end`, `type`, `layout`, `voiceover`,
`caption`. Beyond that:

### `clean-explainer`
- `caption` — 一屏主观点，尽量 ≤16 字。
- `body` — 解释句，≤34 字。
- `tags` — 1-3 个关键词，会显示为底部条。

### `app-workflow`
- `steps` — 2-3 个视觉流程节点，按顺序显示在模拟应用窗口内；这是首选字段。
- `tags` — 旁白里的 1-3 个关键词，用于同步标签；当 `steps` 缺省时才回退为流程节点。
- `body` — 这一屏的方法解释，避免复述旁白。
- Best with `style.preset = "soft-product"` or `"mono-tech"`.

### `sketch-notes`
- `caption` — 笔记标题，尽量 ≤15 字。
- `body` — 手写卡片正文，≤40 字。
- `tags` — 1-3 个便签条。
- Best with `style.preset = "warm-note"`.

### `dark-card`
卡片有四层文字，各司其职、互不重复（见 §7 写作规范）：
- `caption` — **金句标题**：一句高度浓缩的观点，≤14 字，能独立成立，不与正文/旁白重复。
- `body` — **支撑句**：一句补充/延伸（为什么/怎么做/对比/公式），≤30 字，不要复述旁白。
  缺省时回退到旁白摘要。
- `tags` — **标签**：`string[]`，2-3 个关键词，**必须是旁白里实际说到的词**。
  TTS 步骤会用词级时间戳把它们富集成 `{text, at}`，标签在被念到的那一刻点亮（真同步）。
  缺省时回退到从 `caption`/`visual.alt` 自动提取（均匀分布、无真同步）。

### `apple-text-video`
- `visual.asset` — path to a 16:9 image (optional). If absent, shows a styled
  placeholder reading `AI IMAGE · PENDING` (when `visual.prompt` is set) or `16 : 9`.
- Color is chosen automatically from `scene.type` (see §4). No color field needed.

### `data-punch`  ← REQUIRES a `data` object, otherwise it degrades to plain caption
```json
"data": {
  "metric":     { "value": 300, "unit": "%", "label": "整体效率提升" },
  "comparison": { "before": 12, "after": 40, "label": "每周节省时间(小时)" },
  "stats": [
    { "value": "40h", "label": "每周节省时间" },
    { "value": "98%", "label": "用户满意度" },
    { "value": "3×",  "label": "内容产出倍增" }
  ]
}
```
- `metric` → drives the big CountUp animation (number rolls 0 → value, then pulses).
- `comparison` → drives the before/after bar pair.
- `stats` → drives the 3-column StatCard row.
- All three are optional individually, but include **at least `metric` or `stats`**.

### `image-overlay`
- `visual.asset` — strongly recommended (the template is built around a photo).
  Without it, a per-scene gradient fallback is used.
- `visual.bare: true` — **裸图模式**：图片已是成品整图（自带文字的设计卡片，如复用的
  小红书 sketch-notes 卡），满屏显示 + 极轻微缓动，**不叠加标题/正文/标签/蒙层**。
  用 `objectFit: contain` + `style.background` 同色补边，避免裁掉图上已有文字。
  底部跟读字幕仍由全局 `CaptionLayer` 渲染。
  浅色画面（奶油底卡片）务必配 `style.captionBackdrop: true` 给字幕加深色毛玻璃底衬，
  否则白字看不清。预合成卡片到 1080×1920：
  `ffmpeg -i card.png -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xF5F0E8" out.png`

---

## 3. Scene Transitions

Set each scene's `transition` to control how it gives way to the **next** scene.
The transition plays at the boundary, default duration 12 frames (~0.4s).

| `transition` | Effect |
|---|---|
| `fade` | 交叉淡入淡出（默认，最稳妥） |
| `slide` | 新场景推走旧场景 |
| `wipe` | 新场景擦过旧场景 |
| `clock-wipe` | 圆形钟摆式擦除 |
| `cut` / `none` | 硬切，无过渡 |

Guidance:
- Default to `fade` for explainer content.
- Use `slide`/`wipe` sparingly for emphasis beats (e.g. entering a data reveal).
- Use `cut` for fast, punchy rhythm sections.

---

## 4. Scene Types (drives labels & auto-color)

`scene.type` is shown as a label and, in `apple-text-video`/`data-punch`, picks the accent
color. Use the type that matches the narrative beat:

`hook` 开场 · `definition` 定义 · `explain` 解析 · `example` 案例 ·
`benefits` 价值 · `howto` 步骤 · `risk` 风险 · `ending` 总结 ·
`thesis` 核心 · `analysis` 分析 · `process` 流程 · `framework` 框架 ·
`step` 步骤 · `mistake` 避坑

---

## 5. Reusable Primitives (internal — not selected directly)

Templates are built from a shared primitive library in `remotion/src/primitives/`.
You do **not** reference these in `video-plan.json`; they activate automatically
inside the template you choose. Listed here so you know what each template can do.

| Group | Primitive | Used by |
|---|---|---|
| Motion | `FadeUp` `ScaleIn` `SlideIn` `StaggerIn` | all |
| Text | `GradientText` `CountUp` `TextReveal` | apple-text-video, data-punch |
| Data | `ProgressRing` `AnimatedBar` `StatCard` `CompareBar` | data-punch |
| Layout | `SceneHeader` `SceneFooter` `GlassCard` `Chip` `Divider` | all |
| FX (official) | `CinematicBlur` (motion-blur) `TrailEffect` (motion-blur) `NoiseField` (noise) `ShapeDecor` (shapes) | opt-in inside templates |
| Transitions (official) | `fade` `slide` `wipe` `clockWipe` `flip` | scene boundaries |

Preview them all live: Remotion Studio → `PrimitiveCatalog` composition.

---

## 6. Worked Example: choosing for a real topic

Topic: *"我们用 AI 工作流，把内容生产效率提升了 3 倍"*

- Dominant nature = **数据 / 效果对比** → `style.template = "data-punch"`.
- Hook scene `type: "hook"`, caption "效率提升 3×".
- Reveal scene `type: "analysis"`, fill `data.metric = {value:300, unit:"%", label:"整体效率提升"}`
  and `data.stats` with 3 supporting numbers.
- Transition into the reveal scene: `"slide"` for emphasis; others `"fade"`.

Result: the number counts up, the stat cards stagger in, and the slide transition
punctuates the reveal — all driven by the JSON, no code edits.

---

## 7. 卡片文字写作规范（caption / body / tags）

卡片上的标题、正文、标签是**编辑内容**，由脚本步骤精写，不要让它们互相重复、
也不要重复底部字幕（字幕是实时旁白）。四层信息各司其职：

| 层 | 字段 | 定位 | 约束 |
|---|---|---|---|
| 标题 | `caption` | 这一屏的**金句**：一个观点、落地、能独立成立 | ≤14 字，不复述旁白 |
| 正文 | `body` | **支撑句**：为什么 / 怎么做 / 一个对比 / 一个公式 | ≤30 字，不复述旁白 |
| 标签 | `tags` | 2-3 个**关键词**，点出核心概念 | **必须是旁白里逐字说到的词** |
| 字幕 | （自动） | 实时旁白转写 | 由 TTS 词时间戳生成 |

**标签为什么必须是口播词**：TTS 步骤用词级时间戳给每个标签算出"被念到的时刻"
（写回 `tags: [{text, at}]`），标签在那一刻点亮 → 真同步。若标签是提炼/概括词、
旁白里没逐字出现，则匹配不到时刻（`at=null`），退化为均匀分布的假同步，且相关性差。
所以**从旁白里挑词当标签**，一举解决"同步"和"相关性"两个问题。

写作示例（hook 场景）：
- 旁白：「很多人做 AI 产品，一上来就想做一个无所不能的大 Agent…」
- `caption`（金句）：「一上来就想做全能，是第一个坑」
- `body`（支撑）：「全能，往往意味着没有一处足够锋利」
- `tags`（口播词）：`["无所不能", "大 Agent"]` → 各自在被念到时点亮

---

## 8. 配图提示词写作规范（imageContext / visual.prompt）

每张图的最终 prompt 按**主体打头**的顺序拼成（`scripts/generate-images.mjs` 自动组装）：

```
[① 本场景主体 visual.prompt] + [② 世界观锚点 imageContext] + [③ 画风 styleHint] + [负面约束]
```

| 顺序 | 层 | 来源 | 作用 | 写作要点 |
|---|---|---|---|---|
| ① | 场景主体 | `scene.visual.prompt`（逐场景写） | 这一屏要画什么（**最重要，放最前**，模型更重视靠前的词） | 真实产品语境（人/界面/用户）的具体事物/动作/对比，别飞到奇幻隐喻 |
| ② | 世界观锚点 | `style.imageContext`（全片写一次） | 让每张图接住全文上下文、六张成一套 | **只写统一的主体/场景/世界观**（如"独立开发者在暗色现代工位做软件产品"）；**不要写抽象论点**——模型只画看得见的名词 |
| ③ | 画风 | `styleHint`（代码内置） | 全片一致的"长什么样"+负面 | **只描述画风/光线/质感/负面**，**不要重复 ② 里的主体名词**（否则同一串词说两遍，浪费预算、过度偏置） |

**三条铁律（从"图与内容不匹配"踩坑总结）**：
1. **主体打头**——先告诉模型画什么，世界观和画风垫后。
2. **`imageContext` 只写世界观、不写论点**——"这是一条论证 XX 的视频"对生图是噪声。
3. **`imageContext` 与 `styleHint` 不重叠**——前者管"是谁/在哪"，后者管"长什么样"，各说各的，不互抄名词。

**先预览再生图**：`node scripts/generate-images.mjs <plan.json> --dry-run` 只打印拼好的
prompt、不调 API，可先检查三层是否到位，再正式生成（生图有 API 成本）。

**局限**：文生图逐张独立调用，难保证"同一个人脸"跨图一致；`imageContext` 统一的是
世界观/场景/画风，不强求同一主角（要严格同人需参考图条件生成，暂不做）。
