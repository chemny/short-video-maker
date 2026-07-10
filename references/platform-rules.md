# Platform Rules

Use these rules when generating `publish` copy, cover text, CTA text, and output checks for Chinese vertical short videos.

## Shared Rules

- Titles must match the actual video claim. Do not use misleading shock claims.
- Tags must describe the real topic, not generic traffic bait.
- Prefer one light comment prompt only when it fits the content.
- Keep platform copy separate. Do not reuse Xiaohongshu copy verbatim for Douyin.
- Treat platform UI as part of the layout, not an afterthought. Critical text,
  cards, diagrams, and captions must stay outside device and platform danger
  zones.

## Video Safe Areas

Use these safe-area profiles when generating previews, stills, and final videos.
The exact numbers can be tuned by template, but the layout must reserve these
zones before placing title, cards, diagrams, and captions.

| Aspect | Main risk | Minimum safe behavior |
|---|---|---|
| 9:16 | iPhone notch/status bar, bottom title/comment/share UI, bottom gesture bar | Keep core content below the top safe zone, use symmetric left/right margins, and keep captions above the bottom UI rather than at the physical bottom. |
| 3:4 | feed crop, bottom captions, app chrome, thumbnail readability | Keep a conservative top/bottom margin and do not put key claims at the extreme edges. Captions remain secondary and must not cover designed content. |
| 16:9 | player controls, TV/web overscan, subtitle collision | Preserve wider left/right margins and keep subtitles inside a stable lower-safe band. |

Default pixel guidance for 1080-wide outputs:

- 9:16: top 150-170px, bottom caption baseline 300-360px, symmetric
  left/right margins 70-90px.
- 3:4: top 70-90px, bottom caption baseline 120-160px, left/right margin
  70-100px.
- 16:9: top 60-90px, bottom caption baseline 70-110px, left/right margin
  110-150px.

Preview requirements:

- Generate a normal contact sheet for visual judgment.
- Generate a safe-area overlay contact sheet when adapting a template to a new
  aspect ratio or platform.
- Draw the overlay with symmetric base margins. Do not add an extra right-side
  rail unless the user explicitly requests a platform-specific button-column
  avoidance profile.
- Layout content should avoid the base unsafe margins and bottom caption/platform
  UI zones. Background decoration may enter danger zones only when it carries no
  information.
- If any title, label, card, diagram, or caption enters a danger zone, fix the
  layout before rendering video.

## Xiaohongshu

- Title: 8-20 Chinese characters is preferred.
- Body: 200-500 Chinese characters when the topic needs context; shorter is acceptable for direct opinion videos.
- Tags: 5-10 tags.
- Tag format in exported copy: `#话题#`.
- Cover: 3:4 feed preview matters. The main title should be readable as a small thumbnail.
- Video frames can be 3:4, 9:16, or 16:9 depending on publishing context, but
  title, captions, and key cards still need platform-safe margins.
- CTA: "点赞收藏" and "关注" can be used, but avoid shouting.

## Douyin

- Title: short, direct, conversational.
- Body: 100-200 Chinese characters.
- Tags: 3-8 tags.
- Tag format in exported copy: `#话题`.
- Format: vertical 9:16 only.
- Reserve the bottom title/action area. Use symmetric left/right margins unless
  the user explicitly asks for a right-side interaction-rail avoidance profile.
- CTA: text-only CTA is safer than elaborate animation.

## Publish Object Shape

```json
{
  "publish": {
    "xiaohongshu": {
      "title": "20 字以内标题",
      "body": "正文",
      "tags": ["AI", "产品思维", "效率"]
    },
    "douyin": {
      "title": "短标题",
      "body": "正文",
      "tags": ["AI", "产品", "效率"]
    }
  }
}
```

Keep `tags` as raw tag text in `video-plan.json`. Formatting with `#` is handled when packaging.
