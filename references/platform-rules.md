# Platform Rules

Use these rules when generating `publish` copy, cover text, CTA text, and output checks for Chinese vertical short videos.

## Shared Rules

- Titles must match the actual video claim. Do not use misleading shock claims.
- Tags must describe the real topic, not generic traffic bait.
- Prefer one light comment prompt only when it fits the content.
- Keep platform copy separate. Do not reuse Xiaohongshu copy verbatim for Douyin.

## Xiaohongshu

- Title: 8-20 Chinese characters is preferred.
- Body: 200-500 Chinese characters when the topic needs context; shorter is acceptable for direct opinion videos.
- Tags: 5-10 tags.
- Tag format in exported copy: `#话题#`.
- Cover: 3:4 feed preview matters. The main title should be readable as a small thumbnail.
- CTA: "点赞收藏" and "关注" can be used, but avoid shouting.

## Douyin

- Title: short, direct, conversational.
- Body: 100-200 Chinese characters.
- Tags: 3-8 tags.
- Tag format in exported copy: `#话题`.
- Format: vertical 9:16 only.
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
