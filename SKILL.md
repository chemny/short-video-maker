---
name: short-video-maker
description: Make researched narrated videos from an article, link, topic, approved script, or local media through one Remotion workflow. Supports primary-source snapshots and selected official media, claim-to-scene evidence, conservative local ASR word-boundary alignment, native clip selections, responsive horizontal/vertical layouts, audio mixing, per-scene previews, technical checks and explicit editorial review. Uncertain speech or unavailable official media remains a visible review gap.
metadata:
  version: "0.3.2"
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
- Visual approach: relevant official/native footage first, then traceable stills and authored diagrams; use parameterized semantic components with a consistent design system.
- Speech: auto-select local VoxCPM2 when its complete local environment is ready, otherwise Edge TTS. Users can explicitly select VoxCPM2, Edge or Volcengine. All three automatically align captions and use the same verified PCM export.
- Outputs: `video.mp4`, `cover.png`, `script.md`, `captions.srt`, `publish.md`, `metadata.json`

## Capability audit and routing

Before choosing or replacing a template, run `node scripts/inspect-capabilities.mjs` and read `references/capability-routing.md`. Compare suitable content types with the same script/audio; distinguish registered packages, 5 implemented editorial styles (27 legacy fallback aliases), legacy render branches and 20 semantic families. Shotcraft Brief is an opt-in 9:16 list/statement candidate, not the full B workflow or an automatic default. Preserve existing templates and rejected experiments outside default routing.

## Core Workflow

### Selectable render engines

Read `references/render-engines.md` when choosing or using a renderer. `run-job.mjs --engine=remotion|hyperframes` selects the engine; `meta.renderEngine` saves a job choice, then `SHORT_VIDEO_RENDER_ENGINE`, then Remotion is the default. Use one canonical approved plan, narration and caption timeline for both. Hyperframes uses the optional pinned runtime in `hyperframes/`, generates a job-local HTML/GSAP project, runs lint/validation/layout inspection, and verifies final PCM audio with the shared exporter. Missing selected runtime blocks before TTS; never silently change engines or install dependencies/skills. Remotion templates are not automatically interchangeable with Hyperframes; engine choice is not a promise of the same appearance.

### Unified director and preview review

For new authored news production read `references/director-production.md`. Use one `run-job.mjs` entry for templates and declared authored Remotion compositions. `directed-news` is an explicit portrait candidate built from B recipes; never a global automatic style. New briefs require a director plan and use `productionWorkflow="reviewed-v1"`. Preserve confirmed speech. Author expression decisions before selecting recipes; the shared entry resolves actual caption anchors, checks phone-scale geometry and renders the complete low-resolution preview. HD waits for a hash-bound record of actual visual/listening review. An unperformed check stays pending; a preview may still be delivered for review. User-requested preview checkpoints must be respected. No new per-stage user approvals are required for already authorized work.

### Mandatory sentence-directed production

Read `references/sentence-directed-production.md` before storyboarding any new narrated video or rebuilding an existing one. Preserve the specifically selected script/audio baseline in `baseline.json`; filenames or a shared topic do not establish approval. Build the full caption-aligned `sentence-storyboard.json` before selecting components. New plans set `meta.editorialWorkflow="sentence-v1"`. The production audit blocks missing/stale/uncovered mappings, out-of-range media selections and invalid typography tokens. This structural gate cannot establish semantic relevance or listening approval.

Order: locked script and voice -> real narration timing -> sentence-by-sentence source/visual/edit decisions -> aspect-specific layout and font hierarchy -> suitable components or job-local Remotion composition -> actual scene/caption image inspection -> full preview -> user visual review. A group of sentences may share a shot, but each sentence must identify what remains visible, the actual media playback or emphasis change, and the reason. Do not substitute generic action labels or a list of component names for editorial decisions. A custom composition must consume the authored storyboard, run its own actual DOM/layout checks and use the shared PCM exporter; do not claim generic renderer validation covers custom code.

### Components are an authored toolbox

Read `references/semantic-components.md` and `components/registry.json` when using a component. Automatic component defaults are disabled after failed visual acceptance. Keep existing components available through explicit authored selection. Never map old scenes into generic cards as a substitute for sentence directing. Structured facts, matching real footage and explicit caption anchors govern each selection. Enhancements are optional; no quota of effects or components. Existing jobs remain compatible. The layer-editing workbench is not implemented.

### Default voice, alignment and audio export

Read `references/default-voice-pipeline.md`. For generated narration, `run-job.mjs` auto-selects local VoxCPM2 when its runtime/weights and ASR prerequisites exist, otherwise Edge TTS. Users may explicitly choose VoxCPM2, Edge or Volcengine. All three commit only matched captions/scenes, prepare lossless PCM and rebuild/verify the final audio timeline. No `--tts` or `--align` flag is needed for this default. Imported narration remains protected and defaults to `--tts=none`; its final export still uses the PCM timeline. No local setup is required for the default Edge route: use its returned word times and Node/FFmpeg export checks. Local synthesis uses ASR; cloud word timing is explicitly labeled provider-matched. Missing prerequisites for an explicit provider or ambiguous timing block that choice; explicit selections never silently switch on runtime/API failure; automatic mode can use the documented final macOS fallback. Preserve the explicit `sourceVolume` of native video clips when rebuilding final audio.

Personal voice: `--voice-profile=/path/profile.json` (or `SHORT_VIDEO_VOXCPM2_VOICE_PROFILE`) clones the profile's ORIGINAL reference with VoxCPM2 and applies its tempo exactly once; see `references/default-voice-pipeline.md`. Honor a user's requested provider, voice and speaking rate. When the user wants to compare/select voices, offer local VoxCPM2, online Edge (no API key), and Volcengine (requires credentials); use `--tts`, `--voice`, `--voice-preset`, `--rate` or `--speed` as appropriate. If no preference is stated, use automatic capability detection without an extra confirmation question. Existing per-job provider choices remain stable unless the user changes them or selects `auto`.

### P0 content and layout gates

For new researched jobs, read `references/p0-production.md`; set `meta.productionVersion="p0-v1"`. Finish bounded official research/coverage, explicit per-caption visual bindings, and browser-measured responsive layout before rendering. Run complete product/article/dated-daily examples across three aspects for regression acceptance. Technical reports must remain separate from actual listening/editorial approval.

### Researched production and upgraded media route

Read `references/researched-production.md` for link/topic/article intake, local ASR, native clips, aspect variants and quality gates. This is the supported replacement for the former Auto workflow; no installation or runtime dependency on Auto remains.

- For a topic, identify official domains with the available web tool, then inspect official announcements/docs/demo/media pages. For a supplied article, read it and trace key factual claims to primary sources. Use `research-sources.mjs` and explicit `download-source-media.mjs` requests to retain snapshots, IDs, hashes and selected media. Record blocked pages, embedded players, unavailable videos and rights uncertainty instead of silently filling with stock imagery.
- Product, article and daily briefs use `init-report.mjs`; daily dates are explicit in the user's timezone. The agent writes the researched script and the scene/evidence plan. Existing approved text remains locked. Each researched scene declares claim/source IDs, a visual reason and whether the visual is official, authored or user supplied.
- `align-narration.mjs` matches approved captions to real ASR word boundaries using an existing local Whisper model. It writes a report first; `--apply` is allowed only on an unambiguous match. Missing/repeated/uncertain speech or homophones block automatic application. This is not a promise of acoustic forced alignment or flawless Chinese recognition.
- `import-clips.mjs` takes explicit source intervals and sound controls. Clips default to muted, are not silently looped/frozen, and use the responsive media renderer. `responsive-report` reflows text/media for 16:9, 9:16 and 3:4; use `adapt-aspect.mjs` to create independent variants. Older decorative templates are preserved, not universally adapted.
- The runner audits evidence, actual clip lengths and timing before render. Researched renders automatically generate each scene's midpoint still and safe-area sheet. Inspect these, plus the post-render full-duration contact sheet. Technical pass and editorial approval are separate; `--require-content-review` rejects missing/stale plan/video review records. Never synthesize a passing review without actually performing its checks.
- Reuse unchanged inputs/caches. Audio/script changes invalidate alignment; plan/video changes invalidate editorial review. A final MP4 is always rerendered after visual changes; local scene-level planning edits do not imply partial MP4 rendering.

### Material input route (phase-1 consolidation)

When the user provides local materials or finished narration, read `references/material-input-workflow.md`.
Use the same `video-plan.json`, Remotion project and `scripts/run-job.mjs` as the content route:

- Inventory with `scripts/scan-assets.mjs`; filenames suggest roles, not semantic matches.
- Author/obtain the actual timed scene and caption plan. Do not use Auto Video Maker's picture cycling or character-count alignment.
- Import explicit selections with `scripts/import-media.mjs`. It copies inputs into the job and retains their provenance in `manifest.json`; it never rewrites source media.
- Imported narration defaults to `--tts=none`. `sync-local-audio.mjs` remains a **macOS TTS** wrapper, not the recording importer.
- Optional cleanup/normalization and deterministic BGM mixing run through `scripts/prepare-audio.mjs`. Prepared audio is played once; source voice/BGM are not layered over it again.
- An unmatched or absent timing plan must be resolved before rendering. Use the upgraded local ASR route when appropriate; uncertain results remain blocked. Use the researched/clip/responsive routes above for their corresponding inputs.
- Treat already approved scripts as locked content; propose substantive rewrites separately.
- For legacy Auto jobs and the replacement/retirement boundary, read `references/delivery-checks.md`. Conversion retains existing timing and never claims new speech alignment. New jobs run entirely through this skill.
- Auto Video Maker's separate local entry is retired; its local archive was subsequently deleted at the user's request. Historical jobs and the remote repository remain. Do not reinstall it as a dependency or create a forwarding Auto skill.

### Content input route

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
   - Use automatic provider selection: complete local VoxCPM2/ASR environment selects VoxCPM2; otherwise select Edge before any synthesis request. Edge and Volcengine automatically match approved captions to returned word timestamps, or require local ASR if timestamps are unavailable. Users may explicitly select these providers, voice and rate. In automatic mode only, synthesis unavailability tries Edge after VoxCPM2 and finally macOS system speech if `say` exists. Explicit provider failures and text/alignment rejections remain blocking. macOS uses measured caption-phrase audio boundaries, not word-level estimates; see `references/default-voice-pipeline.md`.
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
   - Render the video through Remotion, then build the full PCM audio master (narration, BGM, selected clip sound), remux with the video stream copied, and verify decoded offset/drift. A failed export verification blocks delivery.
   - Render the cover still.
   - Export the publish package with script, captions, metadata, and platform copy.

10. Quality check.
   - Read `references/delivery-checks.md`. Inspect the generated `quality-report.json`, full-duration `contact-sheet.jpg`, and `assets-needed.md`; resolve or explain review warnings. A technical pass does not prove speech alignment or image relevance.
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
- Node.js and FFmpeg are sufficient for Edge narration with returned word timestamps and verified export. Local VoxCPM2 additionally needs its existing runtime/weights plus local ASR dependencies. Volcengine requires user credentials and returned word timestamps (or an existing ASR runtime). Runtime scripts never install dependencies or download models automatically.
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

## Complete preview and partial narration repair

For a full-duration low-resolution preview and per-scene VoxCPM2 audio/ASR cache rules, read `references/iteration-workflow.md`. Use `--preview-video` to review without replacing an existing HD delivery. Confirmed renders create/reuse a complete preview before HD; preview generation itself never counts as human approval. Scene cache reuse does not bypass strict text alignment, measured layout or final audio verification.

## Default caption and pause repair

Both the normal runner and `tts.mjs generate` automatically run the shared acoustic timing pass after accepted text alignment. Read `references/default-acoustic-timing.md` for protected demonstration holds, conservative pause rules, independent phrase checks and rollback evidence. Do not use case-specific output scripts as the production path.
