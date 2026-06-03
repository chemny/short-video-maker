# MVP Specification

## Goal

Build the first usable version of a skill that turns a Chinese article, idea, or topic into a Xiaohongshu/Douyin-ready vertical short video package.

The MVP should prove the pipeline end to end:

```text
input -> analysis -> script -> storyboard -> audio -> captions -> assets -> video-plan -> Remotion render -> cover -> publish package
```

## Scope

Include:

- One default vertical format: 1080x1920, 30 FPS.
- One default content type: knowledge explainer or opinion analysis.
- One default length target: 90-130 seconds.
- One Remotion template with title opening, content scenes, caption layer, visual layer, and ending card.
- AI or manually provided still images with animated camera movement.
- TTS voiceover.
- Caption timing generated from TTS audio.
- Cover still generated from title, background, and topic label.
- Publish copy for Xiaohongshu and Douyin.

Exclude from MVP:

- Digital human/avatar video.
- AI-generated moving video clips.
- Automatic platform publishing.
- Complex multi-template style selection.
- Batch production.
- Full editorial approval workflow.

## Inputs

The user may provide:

- Full article.
- Rough idea.
- Topic sentence.
- Research notes.
- Preferred platform, style, or duration.

If the user does not provide platform/style/duration, use the default target from `SKILL.md`.

## Outputs

Each job should produce:

```text
video.mp4       Final vertical video.
cover.png       Thumbnail cover.
script.md       Human-readable script.
captions.srt    Caption file.
publish.md      Xiaohongshu/Douyin titles, body copy, tags.
metadata.json   Machine-readable summary of the render.
```

## Pipeline Logic

### 1. Analysis

Produce:

- Topic.
- Target audience.
- Platform fit.
- Main angle.
- Core thesis.
- Supporting points.
- Useful examples/data.
- Risk notes.
- Recommended narrative structure.

### 2. Script

Use this timing structure as the default:

```text
0-6s       Hook.
6-18s      Problem or conflict.
18-85s     Main explanation, 2-4 points.
85-110s    Example, contrast, or memorable insight.
110-130s   Summary and light call to action.
```

### 3. Storyboard

Each scene should include:

- Start estimate.
- Duration estimate.
- Voiceover.
- Caption text.
- Visual description.
- Asset prompt or source instruction.
- Layout type.
- Motion style.
- Transition.

### 4. Audio and Captions

The generated voiceover audio is the timeline source of truth.

Recommended flow:

```text
voiceover text -> TTS audio -> transcription/alignment -> captions -> scene timing
```

Use sentence-level timing for MVP. Use word-level timing later for karaoke-style keyword highlighting.

### 5. Visuals

MVP visual options:

- Static image with slow zoom.
- Full-screen title card.
- Text-and-image split.
- Quote card.
- Data card.
- Step list.
- Timeline card.
- Ending card.

Avoid complex generated video in the MVP because it raises cost, latency, and quality risk.

### 6. Rendering

Remotion reads `video-plan.json`.

The Remotion composition should:

- Use dynamic duration from audio/caption timing.
- Render scenes with `<Sequence>`.
- Use `<Audio>` for voiceover and optional BGM.
- Use a caption layer with safe-area positioning.
- Use `<Still>` for cover export.

### 7. Quality Check

Before considering the job done:

- Confirm `video.mp4` exists and is non-empty.
- Confirm `cover.png` exists and is non-empty.
- Confirm duration matches the target range.
- Confirm audio file is present.
- Confirm all referenced assets exist or are remote URLs.
- Confirm captions do not exceed safe visual bounds.
- Confirm `publish.md` includes titles, description, and tags.

## Provider Strategy

The MVP should not lock to one provider.

Use configuration fields such as:

```text
TTS_PROVIDER
IMAGE_PROVIDER
SEARCH_PROVIDER
LLM_PROVIDER
```

LLM provider is optional when the skill runs inside an agent that can perform reasoning and writing directly.

Current TTS providers:

- Default Edge TTS provider: `scripts/sync-edge-tts.mjs`.
- Local macOS provider: `scripts/sync-local-audio.mjs`.
- Volcengine provider: `scripts/sync-volcengine-tts.mjs`.

The Volcengine provider requires environment variables and must not store secrets in repo files:

```text
VOLCENGINE_TTS_APPID
VOLCENGINE_TTS_ACCESS_TOKEN
VOLCENGINE_TTS_VOICE_TYPE
```

## First Implementation Milestone

Create a Remotion template that can render a manually written `video-plan.json`. This is the foundation. After that works, add AI generation for the plan.
