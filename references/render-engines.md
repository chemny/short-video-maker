# Render engines

Use one approved `video-plan.json`, narration and accepted caption timeline. Engine selection changes visual authoring/rendering, not the TTS provider or approved script. The current default remains Remotion.

## Selection

Priority: CLI `--engine=remotion|hyperframes` > `meta.renderEngine` > `SHORT_VIDEO_RENDER_ENGINE` > `remotion`. Unknown values fail. A selected missing runtime blocks before TTS; there is no silent renderer fallback.

```sh
node scripts/run-job.mjs /absolute/job --engine=remotion --preview-video
node scripts/run-job.mjs /absolute/job --engine=hyperframes --preview-video
node scripts/run-job.mjs /absolute/job --engine=hyperframes --render --confirmed-render
```

A job can save `"renderEngine": "hyperframes"` inside `meta`. Imported audio remains protected. Use `--tts=none` for an already prepared imported-narration job; changing engines must not trigger new narration.

## Optional installation

The isolated `hyperframes/package.json` and lockfile pin the runtime. With user authorization, run `npm ci --prefix hyperframes` at the skill root. It is not a global installation and does not install or enable skills. An existing CLI can be selected with `SHORT_VIDEO_HYPERFRAMES_BIN=/absolute/path/to/hyperframes`. Node >=22, FFmpeg and an available Chrome are needed. Do not automatically download browsers or models, run Hyperframes init/skills, publish/upload projects, or use Hyperframes TTS/transcribe to replace our approved audio workflow.

## Hyperframes branch

The shared runner validates the plan, handles existing speech/alignment, prepares PCM, maps visuals and audits evidence before dispatching. The adapter generates a job-local HTML+GSAP composition with local assets and a DESIGN.md. It uses actual canonical scene/caption times, explicit video source offsets, separate muted video and narration audio, and frame-rounded cover duration. It runs native lint, runtime validation and layout inspection before rendering, then the shared PCM final mux/waveform check. Technical results are separate from listening and visual approval.

The initial adapter supports the canonical scene headline/body, steps, metric/stats graphics, still images and video media. Preserve image/video aspect ratio with `contain` unless an explicit reviewed `cover`/focal point is supplied. Native Remotion template components and typography are not compiled into Hyperframes: switching engine does not reproduce an existing custom TSX project or guarantee visual parity. Advanced custom layouts need their own Hyperframes authoring work and review.

Native lint may warn that inline multi-element scenes could be split into sub-compositions for better Studio editing. These are authoring-structure warnings, not ignored visual overflow. Read native validation/inspection warnings and review actual rendered frames before delivery.

- Source: `<job>/hyperframes/<identity>/index.html` and `DESIGN.md`.
- Complete draft MP4: `<job>/preview/hyperframes/<identity>/video.mp4`.
- HD delivery package: `<job>/hyperframes/delivery/<identity>/`.
- Latest pointers: `<job>/hyperframes/latest.json`.

Draft is currently full-canvas with draft encoding, not the quarter-scale Remotion preview. Outputs stay separate from existing Remotion deliveries. Preview reuse binds the approved plan, local media bytes, generator/export source, pinned runtime lock and actual MP4 hash. Editing generated source is protected: rerunning refuses to overwrite a human-edited index. Retain that folder as an authored project and use native CLI explicitly for further manual work; update/review the canonical timing before certifying its output.

For a Studio preview, run the installed Hyperframes CLI `preview <project-dir>`; use the actual printed port and `http://localhost:<port>/#project/<project-directory-name>`. A source HTML file is not the Studio preview URL. A rendered local MP4 can be shown directly or inside a normal playback page.

## Acceptance boundary

A passing render verifies routing, timing transport, media availability and technical checks; it does not approve the aesthetic or news interpretation. Do not rewrite approved text, regenerate voices, borrow an unrelated dynamic clip, or publish content just because a different renderer is selected.
