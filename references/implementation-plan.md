# Implementation Plan

## Milestone 1: Planning Package

Status: drafted.

Deliverables:

- `SKILL.md`
- `references/mvp-spec.md`
- `references/video-plan-schema.md`
- `references/remotion-animation-rules.md`
- `references/caption-rules.md`
- `references/advanced-caption-rules.md`
- `references/audio-sync-rules.md`
- `references/media-diagnostics-rules.md`
- `references/asset-rules.md`
- `references/video-asset-rules.md`
- `references/text-layout-rules.md`
- `references/font-rules.md`
- `references/transition-rules.md`
- `references/chart-rules.md`
- `references/three-web-rules.md`
- `references/composition-rules.md`
- `examples/input.md`
- `evals/evals.json`

Purpose:

- Establish the product boundary.
- Define the JSON contract that Remotion will consume.
- Capture Remotion coding rules inside this skill so it remains independent from external skills.
- Make the skill usable by Claude Code, Codex, and OpenClaw without forcing an internal LLM API.

## Milestone 2: Remotion Template

Build a reusable Remotion project that reads `video-plan.json`.

Recommended files:

```text
remotion/
  package.json
  src/
    Root.tsx
    ShortVideo.tsx
    CoverStill.tsx
    components/
      SceneRenderer.tsx
      CaptionLayer.tsx
      AudioLayer.tsx
      MotionImage.tsx
      TextCard.tsx
      DataCard.tsx
    lib/
      loadVideoPlan.ts
      timing.ts
      validation.ts
  public/
```

Core behavior:

- Use `calculateMetadata` to set duration from `video-plan.json`.
- Use `<Sequence>` for scene timing.
- Use `<Audio>` from `@remotion/media`.
- Use `<Img>` and `staticFile()` for local assets.
- Render a separate `<Still>` for the default cover.
- Keep external image API covers as optional providers, not as the default path.
- Follow the local Remotion rule set in `references/*rules.md`.
- Keep optional heavy capabilities, such as 3D, Lottie, advanced captions, transitions, and font tooling, documented and installable on demand instead of forcing them into the base MVP.

## Milestone 3: Deterministic Scripts

Add scripts that do not rely on LLM reasoning:

```text
scripts/
  init-job.mjs
  install-job-plan.mjs
  validate-plan.mjs
  sync-local-audio.mjs
  sync-volcengine-tts.mjs
  generate-cover.mjs
  copy-assets.ts
  render-video.ts
  render-cover.ts
  package-output.mjs
```

These scripts should:

- Create the job folder.
- Validate `video-plan.json`.
- Install a generated job plan into the Remotion template.
- Copy local assets into Remotion `public/`.
- Run Remotion render commands.
- Generate a cover with Remotion, OpenAI Images, Nano Banana, or a generic HTTP image API.
- Export output package.

Cover provider interfaces:

- `remotion`: deterministic `<Still>` rendering, no API key required.
- `openai`: reads `OPENAI_API_KEY`; optional `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_SIZE`, `OPENAI_IMAGE_QUALITY`, `OPENAI_IMAGES_ENDPOINT`.
- `nano-banana`: reads `NANOBANANA_API_URL` and `NANOBANANA_API_KEY`.
- `http`: reads `COVER_API_URL`; optional `COVER_API_KEY` and `COVER_API_MODEL`.

Cover API rule:

- Use API-generated images primarily as background/focal material. Keep final title text in Remotion when thumbnail readability matters.

## Milestone 4: Audio and Captions

Add provider-configurable audio flow:

```text
voiceover text -> TTS -> voiceover.mp3 -> alignment/transcription -> captions.json + captions.srt
```

Provider interfaces:

- TTS provider.
- Caption alignment provider.
- Optional BGM provider.

Important rule:

- The generated audio timeline is the source of truth for scene and caption timing.

Current MVP scripts:

- `sync-local-audio.mjs`: uses macOS `say` and `ffmpeg` for offline smoke tests.
- `sync-volcengine-tts.mjs`: uses Volcengine HTTP V1 TTS and reads credentials from environment variables.
- Both scripts update `public/video-plan.json`, write `public/audio/voiceover.mp3`, and write `public/captions/captions.json` plus `public/captions/captions.srt`.

Volcengine implementation notes:

- It calls `https://openspeech.bytedance.com/api/v1/tts`.
- It uses `Authorization: Bearer;${token}`.
- It synthesizes each scene separately to avoid long-text request limits, then concatenates the MP3 segments with `ffmpeg`.
- It retimes scenes and captions from the resulting audio segment durations.

## Milestone 5: AI Planning Helpers

Add optional scripts or prompts to help the active agent produce:

- `analysis.json`
- `script.json`
- `storyboard.json`
- `video-plan.json`

Do not make LLM API mandatory. If API keys exist, standalone mode can use them. If not, the calling agent should produce the JSON.

## Milestone 6: Quality Checks

Add automated checks:

- Output files exist and are non-empty.
- Video duration is within target range.
- All referenced local assets exist.
- Caption times are valid and ordered.
- Scene times are valid and ordered.
- Cover title length is suitable.
- `publish.md` contains titles, body text, and tags.

## Milestone 7: Template Expansion

After the MVP works, add templates:

- `knowledge-explainer-v1`
- `opinion-analysis-v1`
- `storytelling-v1`
- `tutorial-steps-v1`
- `data-explainer-v1`

Keep each template compatible with the same `video-plan.json` contract.
