---
name: short-video-maker
description: Make a researched, narrated vertical short video from a topic, link or article. Searches official sources, grades the picture material it finds, writes the script beat by beat around real pictures, renders it with a camera grammar (push, focus, highlight, pan, cursor, count, compare), and only hands a film to the user after measurements and a recorded frame review pass. Uncertain facts, missing material and unperformed checks stay visible. Older template routes remain available through references/legacy-routes.md.
metadata:
  version: "0.3.2"
  tags: remotion, short-video, douyin, channels, research, script, shot-film, tts, captions
---

# Short Video Maker

Turn a topic, link or article into a vertical video built from real pictures: official footage, interface images and page recordings moved by a camera grammar, with narration, captions, a hook, transitions and sound. The agent does the research, writing and judgement; the scripts and the Remotion project do the files, timing, rendering and checks. No internal LLM API is required.

## Default target

Douyin and WeChat Channels, vertical 1080x1920, 30 fps, Chinese, 40 to 90 seconds unless the user says otherwise. Pictures are full-bleed; the caption sits in the platform-safe band. The safe-area numbers are conservative third-party estimates, not measured on the apps.

## The main line

Each stage has a gate. Do not skip a gate or invent its result.

1. **Job and research.** `node scripts/init-report.mjs <job> product|article|daily --topic=<topic>`. Find the official domain with the web tool, then `research-sources.mjs <job> --official-domains=<d> --url=<page>` for text and media candidates. Claims go in `research/claims.json` with a source and a quote that occurs in the saved text. Detail: `references/researched-production.md`.
2. **Picture material.** `capture-source-page.mjs` (one screenshot) or `record-source-page.mjs` (phone-width scroll video). Downloading any official file needs the user's approval, file by file (name, source, size), then `download-source-media.mjs`.
3. **Visual inventory.** `node scripts/build-visual-inventory.mjs <job>` grades every picture (A, B, C, X) and rates the topic rich, medium or poor. **Poor: tell the user before writing the script** and offer to add material, widen the research, record a page or change the angle. Never fill a film with text cards.
4. **Shot script.** Write `shot-script.json`: one beat per spoken line, each with a picture from the inventory, a camera move and a reason; plus `hook`, `bgm` and transitions. Gate: `node scripts/audit-shot-script.mjs <job>`; `--emit=<script.md>` writes the narration for `audit-script.mjs`. Detail and field list: `references/shot-script.md`.
5. **Narration and timing.** `node scripts/make-shot-film.mjs <job>` runs the audit, then the narration stage: each beat becomes a scene and its text phrase captions, the existing voice tools synthesise and align them (`references/default-voice-pipeline.md`), and the voice is levelled to -16 LUFS. Use `--provider=voxcpm2|local` for a voice that stays on the machine; an online voice (edge, volcengine) needs `--allow-cloud` because the narration text leaves the machine. Timing is trusted only while the script text is unchanged.
   With VoxCPM2, run `node scripts/pick-voice-takes.mjs <job> --refine` first: plain speech varies by seed, so each scene's best take is chosen by ASR check and the alignment gate (details in `references/shot-script.md`). When a film must sound like one speaker, add `--one-take` to `make-shot-film.mjs`: the whole script is voiced in one pass and scene times come from ASR of the full audio (try another `--seed` if alignment rejects a take).
6. **Compile and look.** `compile-shot-film.mjs <job> --narration` and `render-shot-film.mjs <job> --narration --stills` (one frame per shot). Compile refuses a picture that is not on disk, invalid overlay props and a missing music file.
7. **Review loop.** `make-shot-film.mjs <job>` continues into `review-shot-film.mjs --narration`: render a preview, measure it, write 1 fps contact sheets and a report. Look at the sheets, fill `output/review/frame-review.template.json` with what you actually saw, bind it with `review-shot-film.mjs <job> --narration --record=<file>`. Fix and repeat until the verdict is `ready-for-user`. Detail: `references/quality-bar.md`, `references/shot-script.md`.
8. **Deliver, once.** `node scripts/make-shot-film.mjs <job> --final` (or `--stage=final`) refuses anything but `ready-for-user`, then renders `output/video.mp4`, `cover.png` (the hook frame), `script.md`, `captions.srt`, `publish.md` (抖音 and 视频号, written separately), `sources.md`, `metadata.json` (provenance, hashes, review) and `final-check.json` (size, fps, audio, sync, loudness, peak). A picture without a rights note, or missing publish copy, blocks it. Show the user the video, cover, report and contact sheets, and say what was only measured or seen as stills.

## Quality bar

Three layers (`references/quality-bar.md`): structure (`score-film.mjs`, the shot script gate), frame review (the loop above, recorded against the film's hash), and the user's own review of taste, rhythm and "大气". The first two are necessary, never sufficient. A technical pass is not editorial approval; never write a passing review you did not perform.

## Boundaries that always apply

- Nothing is committed or pushed without the user's explicit confirmation; for a push list the branch, remote and commits first.
- No library, model or skill is installed automatically. Scripts never download models.
- Downloads of media files need per-file approval. A rights note is a recorded assertion, not a licence; candidates are not reuse permission.
- AI-generated pictures (`references/generated-media.md`, `generate-media.mjs`) need `--confirm`, are labelled "AI 生成" and are never evidence.
- A real picture beats a generated one. Never label a picture as a feature it does not show.
- Official dates, numbers and quotes come from saved source text; time-sensitive facts carry their date.

## Known gaps in the main line

- `make-shot-film.mjs` is its own entry; the shot film is not part of `run-job.mjs`, which stays the entry for the legacy routes. For that reason the legacy template files were left in `templates/`.
- Diagram beats have no renderer; no ducking against speech; no caption word highlighting; contact sheets are still frames without time labels; sound is measured, never auditioned; the cover is the hook frame with its caption.
- Only the macOS system voice (`--provider=local`) has been run end to end on a shot film. VoxCPM2 and online voices use the same tools but were not exercised here.

## When the input is not a topic

Local media or finished narration, an approved script, a legacy job, a named template look (editorial brief, responsive report, shotcraft brief, directed news, warm-paper), a horizontal or 3:4 variant: use the legacy routes in `references/legacy-routes.md`. They still run through `scripts/run-job.mjs` and keep their own gates. Do not mix their templates into a shot film.

## Dependencies

Required: Node.js 22 or later, FFmpeg and ffprobe, Remotion (installed in `remotion/`), Chrome for page capture and recording. Optional: a local ASR model, VoxCPM2, macOS speech, Edge TTS, Volcengine credentials, ComfyUI key, music file. Runtime scripts never install or download anything.

## References

Main line: `shot-script.md`, `quality-bar.md`, `caption-standard.md` (caption text, length and timing), `researched-production.md` (research and provenance), `default-voice-pipeline.md`, `component-library.md` and `visual-system.md` (the fixed-frame components, used for figure and hook overlays), `generated-media.md`, `platform-rules.md`, `spoken-script-writing.md`, `pronunciation-rules.md`, `font-rules.md`.

Legacy and detail: `legacy-routes.md` indexes the template, director and component documents and keeps the earlier `SKILL.md` text in full.
