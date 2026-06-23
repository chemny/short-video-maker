# Long-To-Short Rules

Use these rules when turning a long article, long narration, video podcast script, or `podcast.txt` into one or more vertical short videos.

## Scope

This skill remains short-video first. It should not become a long-form video podcast pipeline. Long-form production belongs to a dedicated long-video skill. This file only defines an adapter path into `video-plan.json`.

## Extraction Flow

1. Identify 3-7 candidate short-video angles.
2. Score each angle by hook strength, standalone clarity, evidence density, and platform fit.
3. Pick one angle unless the user asks for a batch.
4. Rewrite for a 90-130 second spoken script.
5. Keep one thesis, 2-4 support points, and a clear ending.
6. Generate normal `analysis.json`, `script.json`, `storyboard.json`, and `video-plan.json`.

## Candidate Shape

```json
{
  "source": "podcast.txt",
  "candidates": [
    {
      "title": "短视频角度",
      "source_sections": ["intro", "framework"],
      "hook": "开头 3 秒",
      "thesis": "核心观点",
      "platform_fit": ["douyin", "xiaohongshu"],
      "risk_notes": ["需要核对的数据"]
    }
  ]
}
```

## Do Not

- Do not compress a long video section-by-section into a rushed short.
- Do not keep long-form intros.
- Do not rely on chapter order if a later section has a stronger hook.
- Do not include references to "as mentioned earlier" or other long-form context.
