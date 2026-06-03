# Video Plan Schema

`video-plan.json` is the single input that Remotion should consume. It should be JSON-serializable and independent from the agent's reasoning trace.

## Top-Level Shape

```json
{
  "meta": {},
  "style": {},
  "audio": {},
  "cover": {},
  "captions": [],
  "scenes": [],
  "publish": {}
}
```

## `meta`

```json
{
  "title": "视频标题",
  "subtitle": "可选副标题",
  "topic": "主题",
  "platforms": ["xiaohongshu", "douyin"],
  "language": "zh-CN",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationSeconds": 120
}
```

Rules:

- `durationSeconds` should come from audio/caption timing after TTS generation.
- Use 1080x1920 unless the user requests another format.

## `style`

```json
{
  "template": "knowledge-explainer-v1",
  "fontFamily": "sans",
  "background": "#101014",
  "textPrimary": "#FFFFFF",
  "textSecondary": "#D7D7DF",
  "accent": "#F6C85F",
  "captionPosition": "bottom",
  "captionMode": "sentence",
  "motionIntensity": "medium"
}
```

Rules:

- Keep caption text large enough for mobile.
- Avoid visual palettes that are dominated by one hue.
- Use safe areas for bottom captions because platform UI may cover edges.

## `audio`

```json
{
  "voiceover": "audio/voiceover.mp3",
  "bgm": "audio/bgm.mp3",
  "voiceVolume": 1,
  "bgmVolume": 0.12,
  "duckBgm": true
}
```

Rules:

- Voiceover is the master timeline.
- BGM is optional.
- Paths should be relative to the job folder or copied into the Remotion `public/` folder before rendering.

## `cover`

```json
{
  "title": "封面大标题",
  "subtitle": "封面副标题",
  "label": "AI / 商业 / 认知",
  "backgroundAsset": "assets/cover.png",
  "layout": "bold-title"
}
```

Rules:

- Cover title should be readable as a small thumbnail.
- Prefer 8-14 Chinese characters for the main cover title.

## `captions`

Sentence-level captions for MVP:

```json
[
  {
    "id": "cap-001",
    "start": 0.2,
    "end": 3.8,
    "text": "很多 AI 产品，其实输在第一步。",
    "keywords": ["AI 产品", "第一步"]
  }
]
```

Rules:

- Times are seconds.
- `start` must be less than `end`.
- Captions should be short enough to fit two lines on mobile.
- `keywords` are optional and used for highlight styling.

## `scenes`

```json
[
  {
    "id": "scene-001",
    "start": 0,
    "end": 6,
    "type": "hook",
    "layout": "full-image-title",
    "voiceover": "你有没有发现，很多人做 AI 产品，其实输在第一步。",
    "caption": "很多 AI 产品，输在第一步",
    "visual": {
      "asset": "assets/scene-001.png",
      "prompt": "modern AI product dashboard, frustrated founder, cinematic vertical composition",
      "alt": "AI 产品仪表盘和焦虑的创业者"
    },
    "motion": {
      "type": "slow-zoom-in",
      "intensity": 0.08
    },
    "transition": "cut"
  }
]
```

Supported `layout` values for MVP:

- `full-image-title`
- `image-with-caption`
- `text-card`
- `quote-card`
- `data-card`
- `step-list`
- `ending-card`

Supported `motion.type` values for MVP:

- `none`
- `slow-zoom-in`
- `slow-zoom-out`
- `pan-left`
- `pan-right`
- `fade-up`

Rules:

- Scene timing should align with the audio/caption timeline.
- Each scene should have either a visual asset, a text-driven layout, or a Remotion-native graphic.
- Avoid scenes shorter than 3 seconds unless used for a hook or transition beat.

## `publish`

```json
{
  "xiaohongshu": {
    "title": "小红书标题",
    "body": "正文",
    "tags": ["AI", "产品思维", "创业"]
  },
  "douyin": {
    "title": "抖音标题",
    "body": "正文",
    "tags": ["AI", "产品", "认知"]
  }
}
```

Rules:

- Titles should be platform-friendly but not misleading.
- Tags should match the actual topic.
- Include a light comment prompt only if it fits the content.

## Minimal Example

```json
{
  "meta": {
    "title": "AI 产品为什么难做",
    "topic": "AI 产品方法论",
    "platforms": ["xiaohongshu", "douyin"],
    "language": "zh-CN",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationSeconds": 18
  },
  "style": {
    "template": "knowledge-explainer-v1",
    "background": "#101014",
    "textPrimary": "#FFFFFF",
    "accent": "#F6C85F",
    "captionPosition": "bottom",
    "captionMode": "sentence",
    "motionIntensity": "medium"
  },
  "audio": {
    "voiceover": "audio/voiceover.mp3",
    "voiceVolume": 1
  },
  "cover": {
    "title": "AI 产品别这样做",
    "subtitle": "第一步就决定成败",
    "label": "AI 产品",
    "layout": "bold-title"
  },
  "captions": [
    {
      "id": "cap-001",
      "start": 0,
      "end": 4,
      "text": "很多 AI 产品，其实输在第一步。",
      "keywords": ["AI 产品", "第一步"]
    }
  ],
  "scenes": [
    {
      "id": "scene-001",
      "start": 0,
      "end": 6,
      "type": "hook",
      "layout": "text-card",
      "voiceover": "很多 AI 产品，其实输在第一步。",
      "caption": "很多 AI 产品，输在第一步",
      "visual": {
        "prompt": "minimal product dashboard, Chinese vertical video aesthetic",
        "alt": "产品仪表盘"
      },
      "motion": {
        "type": "fade-up",
        "intensity": 0.06
      },
      "transition": "cut"
    }
  ],
  "publish": {
    "xiaohongshu": {
      "title": "AI 产品为什么第一步就错了？",
      "body": "一个常见但容易被忽略的问题。",
      "tags": ["AI", "产品思维"]
    },
    "douyin": {
      "title": "AI 产品别一开始就做错",
      "body": "真正重要的是第一步。",
      "tags": ["AI", "产品"]
    }
  }
}
```
