---
name: short-video-maker
description: Turn an article, idea, topic, or research brief into a Xiaohongshu/Douyin-ready vertical short video using a structured AI-to-Remotion workflow. Use this skill whenever the user asks to create, plan, script, storyboard, synthesize, render, or package a short-form video with narration, captions, cover image, and publish copy, especially for 90-130 second Chinese social videos.
metadata:
  version: "0.1.1"
  tags: remotion, short-video, xiaohongshu, douyin, script, storyboard, tts, captions
---

# Short Video Maker Skill

Use this skill to convert user-provided articles, ideas, or topics into a publish-ready vertical short video package. The skill should keep creative reasoning and deterministic rendering separate:

- The active agent handles understanding, research, scripting, storyboarding, and quality judgment.
- The bundled workflow and Remotion project handle structured files, media assets, timing, rendering, cover export, and packaging.

This separation lets the skill run inside Claude Code, Codex, OpenClaw, or another agent without requiring an internal LLM API. If an LLM API is available, it can be used as an optional backend for standalone or batch runs.

## Default Target

Unless the user specifies otherwise, use these defaults:

- Platform: Xiaohongshu and Douyin compatible
- Format: vertical video, 1080x1920
- Duration: 90-130 seconds
- FPS: 30
- Language: Chinese
- Style: knowledge explainer or opinion analysis
- Visual approach: AI images or sourced stills, animated typography, simple data graphics, keyword-highlight captions
- Outputs: `video.mp4`, `cover.png`, `script.md`, `captions.srt`, `publish.md`, `metadata.json`

## Core Workflow

Follow this sequence:

1. Parse the input.
   - Identify whether the user gave an article, a rough idea, a topic, or a partial script.
   - Extract topic, audience, platform, tone, expected duration, and constraints.
   - Ask only if the missing information materially changes the output; otherwise use the defaults.

2. Research and analyze.
   - For current, factual, financial, legal, medical, technical, or news-like topics, verify with reliable sources before writing the script.
   - Capture the angle, audience pain point, core claim, supporting evidence, risk notes, and recommended narrative structure.
   - Save or produce an `analysis.json`-compatible structure.
   - If the input is a long article, long narration, video podcast script, or `podcast.txt`, read `references/long-to-short-rules.md` and extract one short-video angle before scripting.

3. Plan the narrative.
   - Read `references/narrative-planning-rules.md` before turning a topic, one-sentence idea, or rough opinion into scenes.
   - Do not jump from a one-line topic directly to `video-plan.json`.
   - Create a narrative brief: subject, audience, occasion, thesis, context gap, proof shape, and takeaway.
   - Use the default arc when the user has not supplied a stronger structure: Hook -> Context -> Core -> Shift -> Takeaway.
   - For every scene, identify one `narrative_action` and one `content_shape` before selecting a visual layout.
   - Keep the layer boundary clear: narrative planning decides what each scene says; template governance decides how it is visually structured; video production handles TTS, captions, timing, transitions, and render.

4. Write the short-video script.
   - Build for a 90-130 second spoken video, not an article summary.
   - Use a strong hook in the first 3-6 seconds.
   - Keep one central thesis and 2-4 supporting points.
   - Include voiceover, on-screen caption text, visual direction, emotional tone, and estimated duration per scene.
   - Before writing visible scene text, read `references/screen-copy-rules.md`.
   - Screen text should not be a narration summary. Generate a main judgment, support line, support items, and intended visual structure for each scene.

5. Convert the script into a storyboard.
   - Split the video into scenes.
   - Each scene should include narration, caption text, visual prompt or asset direction, layout type, motion style, and transition intent.
   - Before building the storyboard, satisfy the scene planning table from `references/narrative-planning-rules.md`: scene, arc role, narrative action, content shape, recommended layout, screen copy, visual slot, and motion role.
   - Choose the layout by scene function: hook, definition, example/context, diagnosis, process, evidence, role implication, or takeaway.
   - Avoid assigning the same title/list layout to every scene unless the user explicitly asks for a minimal system.
   - Prefer 5-9 scenes for a 2 minute video.
   - For template-driven videos, read `references/template-system-rules.md` before finalizing the storyboard. Treat templates as closed design systems with layout pools, not visual skins.

6. Generate audio and timing.
   - Treat narration audio as the master timeline.
   - Read `references/audio-sync-rules.md` and `references/media-diagnostics-rules.md` before finalizing imported or generated voiceover audio.
   - Generate TTS audio or instruct the user/agent to generate it using the configured TTS provider.
   - Default to Edge TTS for public-friendly local runs. Use Volcengine or HTTP TTS only when the user provides their own credentials in environment variables.
   - Use transcription or forced alignment to produce word-level or sentence-level timestamps.
   - Use those timestamps to build captions and scene boundaries.
   - Audio quality gate: if the narration has obvious room echo, reverb tail, hiss, hum, clipping, or broadband noise, run a denoise / dialogue-enhancement pass before render and retime captions from the processed audio if duration changes.
   - Before final TTS for Chinese narration, read `references/pronunciation-rules.md` and create a job-local `phonemes.json` when names, polyphones, or English terms need overrides.

7. Prepare visuals.
   - Use AI-generated still images, sourced images/video, or Remotion-native graphics.
   - For MVP work, prefer still images plus motion, typography, charts, and transitions over AI-generated video clips.
   - Check licensing and factual fidelity when using sourced assets.

8. Build `video-plan.json`.
   - Convert analysis, script, captions, audio, visual assets, style, and cover plan into a single Remotion input file.
   - Use the schema in `references/video-plan-schema.md`.
   - Read `references/screen-copy-rules.md` and ensure `caption`, `body`, `tags`, `steps`, `data`, and `layout` form a real information hierarchy.
   - Before choosing `style.template`, read `references/template-system-rules.md`, `templates/README.md`, and `templates/registry.json`; then read the selected template package's `SKILL.md` and `design-tokens.json`.
   - Treat each template package as a small design skill: follow its content fields, layout primitives, hard constraints, and preview requirements.
   - Use the selected template's declared layout pool. If a scene needs a missing structure, extend the selected template using its own design system instead of mixing in another template.
   - Read `references/platform-rules.md` before filling `publish`.
   - Apply platform safe-area rules from `references/platform-rules.md` before
     placing titles, cards, diagrams, and captions. When the aspect ratio or
     platform changes, generate a safe-area overlay preview.
   - Read `references/preference-rules.md` if a local preference file exists or the user asks to save defaults.

9. Render and package.
   - Generate a first-frame preview first when the user has not explicitly confirmed full rendering.
   - Render the video through Remotion.
   - Render the cover still.
   - Export the publish package with script, captions, metadata, and platform copy.

10. Quality check.
   - Run `scripts/validate-plan.mjs` and `scripts/audit-timing.mjs` before render.
   - Verify duration, audio presence, audio quality gate status, caption timing, missing assets, unreadable text, aspect ratio, cover readability, and platform publish rules.
   - If imported or generated narration still has obvious echo or noise after render, do not treat the video as final; create a repaired audio version and re-render or remux it into the final package.
   - Before a full render, render the middle frame of every scene plus a contact sheet; check information hierarchy, repeated layouts, lower-frame emptiness, title wrapping, linework crossing text, platform safe areas, and caption readability.
   - For 9:16, 3:4, or 16:9 platform adaptation, also render a safe-area overlay contact sheet and verify that critical text, cards, diagrams, and captions are outside danger zones.
   - If issues are detected, fix the plan or assets and render again.

## Recommended File Layout

For each video job, create a job folder:

```text
jobs/<slug>/
  input.md
  analysis.json
  script.json
  storyboard.json
  audio/
    voiceover.mp3
    bgm.mp3
  captions/
    captions.json
    captions.srt
  assets/
    scene-01.png
    scene-02.png
  video-plan.json
  output/
    video.mp4
    cover.png
    script.md
    publish.md
    metadata.json
  phonemes.json
```

## Dependency Policy

Required:

- Node.js
- Remotion
- FFmpeg and ffprobe
- TTS provider or local TTS. Edge TTS is the public default; Volcengine and HTTP adapters require user-provided credentials.
- Caption alignment or transcription capability

Recommended:

- Image generation or image sourcing capability
- Search API or browser research capability

Optional:

- LLM API for standalone or batch execution
- AI video generation API
- Stock media API
- Automatic publishing API

## Agent vs API Responsibility

When running inside Claude Code, Codex, or OpenClaw:

- Use the active agent model for content understanding, research synthesis, script writing, and storyboard planning.
- Do not require an internal LLM API unless the user asks for standalone/batch automation.
- Prefer deterministic scripts for validation, media copying, Remotion rendering, and packaging.

When running standalone:

- Read provider keys from environment variables.
- Keep provider choice configurable.
- Never hardcode API keys.

## Quality Bar

The result is acceptable only if:

- Video is vertical 1080x1920 or the requested aspect ratio.
- Duration is close to target, normally 90-130 seconds.
- Voiceover, captions, and scene timing are aligned.
- Captions are readable on mobile.
- Visuals support the narration instead of being generic decoration.
- Cover is readable at small thumbnail size.
- `publish.md` includes platform-ready title, body copy, tags, and optional comment prompt.
- Pronunciation risks have been handled by rewriting or a job-local `phonemes.json`.
- A first-frame preview has been generated before full rendering unless the user explicitly requested a render without preview.

## References

- Read `references/mvp-spec.md` before designing or implementing the first version.
- Read `references/video-plan-schema.md` before generating Remotion input data.
- Read `references/audio-sync-rules.md` and `references/media-diagnostics-rules.md` before using imported audio, generated TTS, or a rendered video with source audio.
- Read `references/narrative-planning-rules.md` before turning a topic, one-sentence idea, or rough opinion into a script/storyboard.
- Read `references/screen-copy-rules.md` before writing screen text, storyboard layouts, or `video-plan.json` scene fields.
- Read `references/template-system-rules.md` before choosing, extending, or creating a visual template.
- Read `references/platform-rules.md` before generating publish copy.
- Read `references/pronunciation-rules.md` before final TTS for Chinese narration.
- Read `references/preference-rules.md` before reading or writing reusable defaults.
- Read `references/long-to-short-rules.md` when adapting a long script, article, or podcast into short videos.
- Read `templates/README.md` before selecting or creating a visual template.
- Read `templates/registry.json` before selecting a template package.
- Use `examples/input.md` as the first smoke-test input.
