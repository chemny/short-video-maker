# Agent Generation Guide

Use this guide when the active agent needs to turn an article, idea, topic, or notes into a complete `video-plan.json`.

The agent should produce four intermediate files before rendering:

```text
analysis.json
script.json
storyboard.json
video-plan.json
```

The rendering pipeline only needs `video-plan.json`, but the intermediate files make review and repair easier.

## Research Rule

Research before scripting when the topic is:

- Current or news-like.
- About a changing company, product, person, regulation, price, market, or tool.
- Medical, legal, financial, or otherwise high-stakes.
- Based on claims that need verification.

If the topic is a timeless opinion, tutorial, or article transformation, research is optional unless the user asks for it.

## Long Input Rule

If the input is a long article, long narration, video podcast script, or `podcast.txt`, read `long-to-short-rules.md` before writing `analysis.json`. Extract one strong short-video angle instead of compressing the whole source.

## `analysis.json`

Produce this shape:

```json
{
  "topic": "主题",
  "input_type": "idea | article | topic | notes",
  "target_platforms": ["xiaohongshu", "douyin"],
  "target_audience": "目标受众",
  "content_type": "knowledge-explainer | opinion-analysis | story | tutorial",
  "main_angle": "切入角度",
  "core_thesis": "核心观点",
  "hook_strategy": "开头钩子策略",
  "supporting_points": [
    {
      "point": "观点",
      "evidence": "证据、案例或推理",
      "visual_hint": "画面提示"
    }
  ],
  "risk_notes": ["事实、版权、表达风险"],
  "source_notes": [
    {
      "title": "资料标题",
      "url": "https://example.com",
      "used_for": "用于哪个事实或背景"
    }
  ]
}
```

## `script.json`

Write for spoken Chinese, not article prose. A 90-130 second video usually needs about 350-520 Chinese characters depending on speaking speed.

```json
{
  "title": "视频标题",
  "cover_title": "封面大标题，8-14 个中文字优先",
  "cover_subtitle": "封面副标题",
  "voiceover_full_text": "完整旁白",
  "estimated_duration_seconds": 110,
  "scenes": [
    {
      "id": "scene-001",
      "type": "hook",
      "estimated_start": 0,
      "estimated_duration": 6,
      "voiceover": "旁白",
      "caption": "屏幕主字幕",
      "tone": "直接、有冲击力"
    }
  ]
}
```

Recommended structure:

```text
0-6s       Hook.
6-18s      Problem or conflict.
18-85s     Main explanation, 2-4 points.
85-110s    Example, contrast, or memorable insight.
110-130s   Summary and light call to action.
```

## `storyboard.json`

Turn the script into renderable scenes:

```json
{
  "visual_style": "知识解释类，克制、高对比、适合手机观看",
  "scenes": [
    {
      "id": "scene-001",
      "layout": "text-card",
      "visual_prompt": "vertical editorial AI product dashboard, high contrast, clean typography",
      "asset_strategy": "remotion-native | ai-image | sourced-image",
      "motion": "fade-up",
      "transition": "cut",
      "caption_keywords": ["关键词"]
    }
  ]
}
```

Supported MVP layouts:

- `full-image-title`
- `image-with-caption`
- `text-card`
- `quote-card`
- `data-card`
- `step-list`
- `ending-card`

Supported MVP motions:

- `none`
- `slow-zoom-in`
- `slow-zoom-out`
- `pan-left`
- `pan-right`
- `fade-up`

Recommended template and preset pairs:

- 通用方法论：`style.template = "clean-explainer"`, `style.preset = "warm-note"` or `"soft-product"`.
- AI 工具 / 工作流：`style.template = "app-workflow"`, `style.preset = "soft-product"` or `"mono-tech"`.
- 小红书收藏笔记：`style.template = "sketch-notes"`, `style.preset = "warm-note"`.
- 数据结论：`style.template = "data-punch"`, `style.preset = "dark-cinematic"`.
- 案例叙事带图：`style.template = "image-overlay"`, `style.preset = "dark-cinematic"`.

## `video-plan.json`

Generate the exact schema described in `video-plan-schema.md`.

Before filling `publish`, read `platform-rules.md`.

Before final TTS, read `pronunciation-rules.md` and create job-local pronunciation overrides when needed.

If `data/user_prefs.json` or a job-specific preference file exists, read `preference-rules.md` before applying it.

Before TTS, the scene timings can be estimates. After TTS, `sync-edge-tts.mjs`, `sync-local-audio.mjs`, or `sync-volcengine-tts.mjs` will retime scenes and captions from real audio duration.

Before TTS, use this convention:

- `meta.durationSeconds`: estimated duration.
- `audio`: empty object `{}`.
- `captions`: estimated sentence captions matching scene times.
- `scenes`: 5-9 scenes, normally no scene shorter than 3 seconds.

## Quality Rules

- Keep one core thesis.
- Use 2-4 supporting points.
- Avoid generic visuals like "technology background" unless paired with specific visual direction.
- Cover title should be short and readable.
- Do not invent facts. Use `risk_notes` when uncertain.
- Do not include secrets, API keys, or provider credentials in any generated file.

## Agent Execution Flow

1. Read user input.
2. Research if required.
3. Create or update `analysis.json`.
4. Create or update `script.json`.
5. Create or update `storyboard.json`.
6. Create or update `video-plan.json`.
7. Run `scripts/validate-plan.mjs <job>/video-plan.json`.
8. Run `scripts/audit-timing.mjs <job>/video-plan.json`.
9. Install the plan into Remotion with `scripts/install-job-plan.mjs <job>`.
10. Run TTS.
11. Run validation and timing audit again.
12. Generate first-frame preview.
13. Render cover and video only after user confirmation.
14. Package outputs and run `scripts/quality-check.mjs`.
