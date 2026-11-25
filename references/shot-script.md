# Shot script (step 3): write the script beat by beat, around pictures

A researched film is written as `shot-script.json` **before** narration is recorded and before any storyboard. Each beat is one spoken line, one picture from `research/visual-inventory.json` and one camera move. A sentence that no available picture can carry is rewritten, not dressed in text. Gate: `node scripts/audit-shot-script.mjs <job> [--target=<seconds>] [--emit=<script.md>] [--json]`; code and limits: `scripts/lib/shot-script.mjs`.

Order for a researched job: sources and media → `build-visual-inventory.mjs` (rating poor stops here and goes to the user) → **shot script** → `audit-shot-script.mjs` → `--emit` the narration → `audit-script.mjs` on it → lock script → TTS and alignment → `sentence-storyboard.json` (keeps each beat's picture and move) → render.

## File

```json
{"schemaVersion": 1, "topic": "...", "beats": [
  {"id": "b1", "narration": "exact spoken line", "claimIds": ["c1"],
   "rung": "recording", "material": "<inventory id>", "move": "hold", "crop": "region of the picture", 
   "why": "what the viewer sees and what it adds to this sentence",
   "noMaterialReason": "only for diagram and text beats: why no inventory picture fits"}]}
```

- **rung** (best first): `video` real footage, `image` a real picture or interface with camera motion, `recording` a page scroll recording, `diagram` an authored drawing, `text` words only. The rung must match the material's kind in the inventory.
- **material**: an id from the inventory (required for the three media rungs). A candidate that is not downloaded is allowed at this stage and is flagged: downloading needs the user's approval, file by file.
- **move**: `push`, `pull`, `pan`, `focus` (crop to a region), `highlight` (mark a region), `compare`, `count`, `cursor`, `hold` (footage already moves). These are the camera grammar built in step 4; naming them now keeps the script honest about what the picture will do.
- **why**: what is on screen, not a restatement of the narration.

## What the gate blocks and warns

Errors: no beats; empty narration; invalid rung or move; empty `why`; a media rung without a material, or a material that is missing from the inventory, unusable (grade X, missing file) or of a different kind than the rung; a diagram or text beat without `noMaterialReason`; the opening beat not a real picture, or longer than 7 s before the picture changes; any single still beat over 12 s; one picture used in more than two beats; text-only beats over 25% of the film, or text plus diagram over 50%; unknown claim ids.

Warnings: opening beat over 4.5 s; beats over 8 s; text-only over 15% or text plus diagram over 30%; a picture reused with the same move and crop; the same rung and move three times in a row; fewer than four distinct pictures; grade C material; material without a provenance record; material not downloaded yet; a number in the narration with no `claimIds`; `why` that repeats the narration; estimated length more than 20% off the target.

Durations are estimates (about 4.7 Han characters per second); real timing comes from the narration. The gate checks shape and pacing, not whether a picture really fits the sentence: look at the picture before binding it.

## Worked check (2026-11-17, Apple pages, nothing downloaded)

A 45 s, eight-beat script was written from the saved page text and inventory: a page recording first, six official pictures, one text line for the language and usage-limit caveat (13% of the film). The gate passed with warnings that six pictures are not downloaded yet.

## Step 4: camera grammar and the renderer

Moves are implemented in `remotion/src/templates/frame/shots/` (`camera.ts` pure math, `Shot.tsx` shots and overlays, `index.tsx` the `ShotFilm` composition). A shot is full-bleed: the picture fills the 1080x1920 frame, with a soft scrim and the caption at y 1320 to 1490 (centred, 700 px wide, inside the platform-safe area). This differs from the fixed frame of `visual-system.md` (topic line plus 936x880 stage), which stays for authored components and the gallery. Landscape pictures are fitted to the width over a blurred copy of themselves, portrait ones cover the frame; the camera never exposes an edge.

Extra beat fields, all validated by the gate:

| Move | Needs | What the viewer sees |
|---|---|---|
| `hold` | nothing | the picture or footage as it is (footage already moves) |
| `push` / `pull` | optional `region` to lean toward | slow 16% push in, or out |
| `focus` | `region` {x,y,w,h} normalised 0..1 | camera eases onto the region and holds with a slight drift |
| `highlight` | `region`, optional `at` (s from shot start) | a milder zoom, the region outlined and the rest dimmed |
| `pan` | `region` and `regionEnd` | camera glides from one region to the other |
| `cursor` | `region`, optional `at` | a pointer arrives at the region and clicks |
| `count` | `figure` {parts:[{value:"6", suffix}], label, at} | the picture dims and blurs, a figure rolls up over it |
| `compare` | `materialB`, optional `labels`, `at` | two pictures as stacked cards, the second arriving on its cue |

A `text` beat needs `onScreen`: one or two `[{text, at, accent?}]` lines (8 characters each at most) on the page colour. Footage may set `sourceStart`. `fit` forces `cover` or `contain`.

Commands (job folder is the public directory; nothing is downloaded):

```
node scripts/compile-shot-film.mjs <job> [--captions=<aligned captions.json>] [--audio=<job-relative file>] [--theme=dark|light]
node scripts/render-shot-film.mjs  <job> --stills          # one mid-frame per shot + output/shot-contact-sheet.png
node scripts/render-shot-film.mjs  <job> [--scale=0.4]     # the video, output/shot-film.mp4
```

Compile refuses a beat whose picture is not on disk, a diagram beat (no renderer yet) and invalid overlay props, naming the beat. Warnings come from the real picture sizes: a focus that zooms under 1.2x, or a region whose centre cannot reach the safe area because the picture edge stops it. Without `--captions` times are estimated from the narration (preview only); with aligned captions, they are handed to beats in order by character count.

Review (2026-11-17, fixture built from the Apple page recording, not for publication): 10 shots covering every move rendered as stills and a 0.4x video of 29 s. Seen: highlight, focus, pan, push, compare, text and cursor read as intended; a count over a bright page was unreadable until the page was dimmed to 72% and blurred; the caption was off-centre until it was centred. Only still frames and frame strips were reviewed, not playback.

Not done: diagram renderer, transitions and rhythm (step 5), narration audio and aligned captions through `run-job.mjs` (the film is not part of that runner, its review gate or preview identity yet), caption word highlighting, the existing five components other than figure (`count`) and hook (`text`).

## Step 5: whole-film layer (hook, rhythm, transitions, sound)

Script-level fields (all optional, the gate warns when they are missing):

- `hook`: `{lines:[{text, at, accent?}]}`, one or two lines of at most 8 characters, shown over the first shot from frame 0 on a darkened picture for 2.6 s. Write a number, a question or a claim, not the topic name.
- `bgm`: `{file, volume?, lufs?}`. `file` is a path (copied into `audio/`), or `synth` for a plain placeholder bed made with FFmpeg (to judge the mix, not to publish). The level is set from the file's measured loudness to a target of -32 LUFS (about 16 LU under narration at -16 LUFS), capped at full scale; `volume` overrides. There is no ducking: narration is continuous, so the bed stays low, fades in over 1 s and out over 1.5 s.
- per beat `transition`: `cut` (default), `dissolve` (0.3 s) or `slide` (0.27 s, rises in), and `section: true` to mark a change of section. Unmarked beats cut on the beat; a `section` beat and the closing text line dissolve in. The incoming shot starts early on top of the outgoing one; its camera and cues still count from its own start.

Sound effects are synthesised, licence-free and plain (a swish, a tick, a low hit): swish on a transition and on the second card of a compare, tick on a highlight and a cursor click, hit when a figure lands and with the hook title. They are written to `audio/sfx/` and listed in `shot-film.json`.

Gate additions (warnings): every beat about the same length (variation under 15% with five or more beats), a beat under 1.6 s, an opening beat more than 1.3x the average, more than 40% of beats entered by a transition, no hook, no music bed. Errors: an unknown transition, a hook of more than two lines, a line over 8 characters, a missing or negative cue. `score-film.mjs` adds a shot-length variation check.

Compile also makes shots contiguous: a pause between spoken beats stays on the shot just shown, and lead-in silence belongs to the first shot, so no frame is empty (a gap of 0.35 s at the start rendered black until this was fixed).

Measured on the fixture (macOS voice, normalised to -16 LUFS mono; Apple page pictures; not for publication): the synthetic bed measures -26.2 LUFS, so the old fixed volume of 0.12 would have put it at -44.6 LUFS, inaudible; the loudness target gives volume 0.513 and about -32 LUFS. The final file measures -13.0 LUFS because a mono voice file is played on both channels (+3 LU), the same as the narration alone; the compositor passes narration at unity. Hook text first sat unreadable on a bright page and now has a 66% dim and a dark halo. Only frames and measurements were reviewed, nothing was auditioned.

Not done: ducking against real speech activity, real music (needs a file or `generate-music.mjs` with its key), caption word highlighting, any listening review.

## Step 6: review loop before the user sees a film

`node scripts/review-shot-film.mjs <job> [--captions=..] [--audio=..] [--scale=0.25] [--no-render] [--json]` renders a small preview, measures it with FFmpeg and writes `output/review/` (`preview.mp4`, 1 fps `contact-NN.png` sheets of 8 tiles per row, `report.json`, `frame-review.template.json`). It exits 1 when the film needs a fix.

Measurements (refuse only): blank frames, the longest stretch with no visible change (fail from 4 s), the longest still shot on the aligned timeline (fail above 12 s; footage is exempt), caption contrast against white text (3:1, at most 10% of caption time below), the first visible picture change (fail after 7 s), integrated loudness (-17.5 to -11.5 LUFS), true peak (fail above 0 dBFS) and silence over 1.5 s. The hook text rising counts as the first change.

Frame review: after looking at the contact sheets, fill `frame-review.template.json` (five judgements per shot: `focal`, `textShare`, `relevance`, `variety`, `safeArea`, each `passed`, `needs-fix` or `not-performed` with notes saying what was seen) and bind it with `--record=<file>`. The record carries the SHA-256 of the compiled film and every file it plays, so changing timing, pictures, sound or captions makes it stale. A `needs-fix` fails the loop and lists the issues; `not-performed` keeps it pending.

Verdicts: `needs-fix` (a measurement failed or the review found issues), `review-pending` (no review, stale or incomplete), `ready-for-user` (measurements pass and a current review is recorded). A failed measurement cannot be overridden by a review. Only `ready-for-user` goes to the user, once, with the contact sheets and the report.

Run on the fixture (2026-11-17, Apple page pictures, macOS voice; not for publication), three rounds: round 1 measurements passed but the frame review found six issues in four shots (a 7.7 s still, a focus that did nothing at 1.04x, a pan cutting the heading, a cursor shot cropped at the top edge); round 2 found the highlight box cutting the first letter of the headline; round 3 passed. The loop caught three things the earlier measures and gates had passed. Unlike the older warning rules it also caught that a highlight's box margin matters more than its zoom, so the zoom warning now applies to `focus` only.

Limits: contact sheets are 1 fps stills without time labels (FFmpeg here has no text filter; tile order is time, left to right, top to bottom, and `report.json` lists shot times), so motion between tiles is not seen; the review is done by the agent looking at those sheets, so it is a second pair of eyes, not the user's judgement of taste; sound is measured, never auditioned. The loop is a separate command and is not part of `run-job.mjs`.

## Main line command and delivery fields

`node scripts/make-shot-film.mjs <job>` runs `audit` (the gate above), `narration` and `review`; `--final` adds delivery; `--stage=audit|narration|review|final` runs one. State is kept in `<job>/narration/` (`video-plan.json`, `state.json`, `audio/`): the narration is regenerated only when the script text changes or with `--redo`. Options: `--provider=`, `--voice=`, `--speed=`, `--voice-profile=`, `--asr-model=`, `--allow-cloud`.

Script fields used at delivery: `title`; `publish: {douyin: {title, body, tags[], comment?}, channels: {title, body, tags[]}}` (titles up to 30 characters, the two platforms written separately); `provenance: {<material id>: "who owns it and how it may be used"}` for pictures with no download record (a download record's rights note counts automatically); `bgm.credit` for music that needs one.

Delivery refuses: a verdict other than `ready-for-user`, missing publish copy, a picture without a rights note or not on disk. Final check on the rendered file: 1080x1920, 30 fps, an audio stream, duration within 0.2 s of the film, stream lengths within 0.25 s, loudness -17.5 to -11.5 LUFS, true peak at most 0 dBFS.

Run on the fixture (2026-11-17, macOS speech `--provider=local`, not for publication): 10 beats, 35 s, narration timing provider-matched, voice levelled to -16 LUFS, review recorded, `--final` wrote the package and every final check passed. The pictures there have no download records, so provenance came from the script's `provenance` notes.

## Real-topic trial (2026-11-17 to 18): Apple's Siri AI page

First end-to-end run on a real topic, with the macOS system voice (`--provider=local`). Sources: one official page (`apple.com/apple-intelligence/`; the newsroom page is script-rendered and gave no article text). Material: 4 then 5 phone-width scroll recordings and 10 downloaded images, each download approved by the user by file name and size. Result: 14 beats, 75 s, final check passed, nothing publishable (Apple's pictures, trial only).

What the real run taught, now in the tools or the rules above:

- **Check pixel size before promising a picture.** The first ten files (29 to 117 KB) were carousel thumbnails: 696x452 (grade C) and 372x452 (grade X). The page also serves `_large_2x` versions (1392x904 and 744x904, grade B); the extractor only listed the 1x `src`, so the 2x URLs were derived from the file name, checked with a headers-only request, registered as candidates and downloaded after a second approval. Ask for sizes in pixels, not kilobytes, and check for a 2x file first.
- **The first review passed every measurement and still failed:** soft pictures, a scroll that did not show its claim, a void under a picture. The measurements cannot see those.
- **Captions on bright pictures** measured 2.6:1; the caption scrim was deepened (now 10:1 worst case).
- **A picture smaller than the frame is now centred** (blurred backdrop above and below evenly) instead of hanging from the top.
- **Recorder:** `--from-text`, `--from-y` and `--speed` (px per second) let a recording start at one section and move slowly enough that a short list stays on screen for the whole shot. The first privacy recording scrolled past its checklist in two seconds; at 45 px/s from a chosen offset it stays.
- **Claims:** 15 claims, each with a quote that occurs in the saved page text, tied to beats by `claimIds`.

Not shown by this run: a voice other than the system voice, music other than the synthetic placeholder, a topic with official video, a page that needs a login.

## Voice: VoxCPM2 take selection, mastering, and captions (2026-11-18)

**VoxCPM2 plain speech is not repeatable across seeds.** On the Apple-page script the same text gave, depending on the seed, a stray "哼" after a sentence, "知识" read as "支持", "它" written as "他", and words the recogniser was unsure of. The alignment gate refuses all of these (rightly: no guessed fallback), and a whole-script re-run with a new seed fixed some and broke others.

- `node scripts/pick-voice-takes.mjs <job> [--seeds=42,7,11,23,5,99] [--scenes=b1,b3] [--min=0.4] [--avoid=b11:42] [--all] [--refine]` synthesises each scene with several seeds, transcribes every take with the same local ASR the gate uses (Traditional output normalised with the gate's own OpenCC step), keeps the take whose transcript reproduces the text with the highest word confidence, and writes `narration/takes.json`. Scene takes are cached, so only new seeds are synthesised. This only chooses between real recordings; nothing is edited.
- `--refine` loops: assemble the chosen takes, run the alignment gate without applying it, swap the take of every scene it flags (the rejected seed is remembered), repeat up to six rounds. On the trial it matched in four rounds.
- `make-shot-film.mjs --stage=narration --provider=voxcpm2 --redo` then uses the chosen seed per scene (`--scene-seeds` in `tts.mjs`). `--seed=` and `--steps=` are passed through for a whole-script seed.
- Rewording beats ASR luck: a line the recogniser keeps misreading ("外部知识", "它") is better rewritten ("查资料", "Siri") than retried.
- **Matching rule changed:** the gate's matching step now also maps 一 to 九 to 1 to 9 on both sides, so a spoken number written 六 or 6 is not a misreading. Display text is untouched. Low word confidence (below 0.35) and every other issue still block.
- The bridge plan needs a `cover` object; without it applying a successful alignment crashed.

**Voice mastering** (narration stage): a mild compressor and limiter, then two loudnorm passes (measure, then apply linearly) to -16 LUFS with the true peak at most -1.5 dBFS. The synthetic voice's peaks had kept a single pass at -17.8 LUFS.

**Captions** now follow `caption-standard.md` (Netflix Simplified Chinese rules): one line, 14 units, no commas or full stops, no punctuation at the end. Cuts fall at natural points (after a comma or enumeration comma, after a particle, before a preposition or conjunction, at a Latin/Han boundary) and never inside a phrase: the first version cut 提醒|事项 and 朋|友, which tests now guard against. A tail under about six units is re-cut with its neighbour. The one remaining warning comes from the voice, not the cutting: "或者用 Apple Pencil" is spoken at 11.5 characters per second against the 9 limit.

Result: 64 s, 34 captions, VoxCPM2 timing `asr-matched`, -16.4 LUFS, -1.4 dBFS, final check passed. Not shown: another voice or a personal voice profile, a listening review.

## One voice for the whole film (2026-11-19)

VoxCPM2 plain speech is a different random speaker every take, even with the same seed and a different sentence, so choosing the best take per scene (above) produced several voices in one film. A film needs one voice:

- **Clone profile.** `<job>/narration/voice/profile.json` (`mode: clone`, `reference_audio`, its SHA-256) built from a clean take of the wanted voice; every scene is then synthesised with `--voice-profile=<that file>`, seeds only vary delivery. For the trial the reference was the 5.1 s take of scene 8 (the third male-sounding voice in order of appearance, chosen from fundamental frequency: male-sounding scenes were 2, 3, 8 and 11). The reference is a generated take, not a personal recording.
- `pick-voice-takes.mjs` also takes `--voice-profile=`, `--min=` (lowest accepted word confidence, 0.45 used) and `--rounds=`. A take whose pitch (`scripts/voice-pitch.py`, rough autocorrelation) is more than 30% off the reference is rejected as a drifted voice.
- The refine loop's check now follows the real flow: each scene decoded on its own first, then the whole audio, either one matching is enough.
- **Wording that the recogniser cannot hold steady.** English names (a 0.19 to 0.73 spread for the same "Mac、iPad 和 Vision Pro"), the homophone 它 for 他, and app names ("提醒事项" heard as "视像") kept tipping scenes over the 0.35 gate between decodes. Six lines were reworded to Chinese equivalents (助手, 手机, 平板, 电脑, 头显); the film still shows the real Mac and iPad pictures. A reworded line is cheaper than ever more seeds.
- Recognition is not deterministic across runs, so a pre-check can pass what the real run rejects: the real run decides, and its full-pass report is now kept (`alignment/<provider>-full-pass-rejected-*.json`).

Result: one cloned male voice, 64 s, 34 captions, ASR-matched timing, -16.2 LUFS, -1.3 dBFS, final check passed. Pitch per scene by a second estimator was 113 to 171 Hz except two scenes (246 and 184 Hz) where the estimators disagree: possible drift, not confirmed. Not verified by listening.

## Step 8: entry effects, exits and picture layouts (2026-11-19)

Until now almost every picture cut in and the landscape ones always sat as one card on a blurred backdrop. Entry effects are now a small planned vocabulary, in `remotion/src/templates/frame/shots/transitions.ts` (renderer) and `scripts/lib/transitions-plan.mjs` (plan; a test keeps their durations equal).

| Effect | Entry | The outgoing shot meanwhile | Used for |
|---|---|---|---|
| `cut` | none | stays | default, short beats |
| `dissolve` | 0.3 s fade | stays | closing text, compare |
| `slide` | fade with a small rise | stays | explicit only |
| `push` | new picture pushes in from a side (alternates) | pushed out the other way | a picture after a recording, a new section |
| `stack` | new card slides in over it | shrinks, dims, blurs | a new section |
| `wipe` | circle opens from the focused region | grows slightly | a new section |
| `zoom` | old picture grows while the new one settles from large | | the same picture with a new crop |
| `blur` | blurred to sharp | blurs out | a figure, a moving page after a still |

A transition belongs to the incoming shot and starts early on top of the outgoing one; entries end at rest (offset 0, no blur, full opacity) and exits start at rest. **Layouts** for a picture that does not fill the frame: `card` (default), `float` (the card tilts slowly in perspective while the backdrop drifts the other way; assigned to long still pictures, at most three per film) and `stack` (a second picture, `materialB`, offset and turned behind it; explicit only). **Accent:** a short warm flash when a highlight or a figure lands.

Plan (restrained profile, deterministic): the first beat and beats under 2.2 s cut; closing text and compare dissolve; a figure blurs; a new section cycles stack, push, wipe; the same picture again zooms; a recording after a still blurs, a picture after a recording pushes; a run of two cuts followed by a beat of 3.5 s or more breaks with the next effect of a cycle; the same moving effect never twice in a row; sides alternate; at most 40% of entries move (sections and the closing text are kept first). An explicit `transition`, `dir` or `layout` on a beat always wins.

Checks: the gate warns when a film of ten or more beats has fewer than three kinds of moving entry, when one effect repeats three times, or when more than 40% of entries move; `layout: stack` without `materialB` is an error; the review loop reports `entryVariety` (three in a row fails).

`node scripts/render-transition-sampler.mjs <job>` renders every effect and layout on the job's own pictures, labelled, with a sheet of frames across each transition; use it to choose or to review a change. Trial (Apple page, 14 beats): five kinds of moving entry (blur, stack, push, zoom, dissolve) and a floating card on three pictures instead of eight identical cuts and fades. Checked from dense frame strips only; playback speed and taste are for the viewer.

## Keyword plate (prototype, off by default)

A beat may set `keyword` (two to eight characters, optional `keywordAt` in seconds): a large serif word with a short accent bar above a picture that leaves room, below the platform's top band (y 330). It rises in on its cue and stays for the shot. Shown only as a mock-up so far: on four real shots it filled the empty band above a landscape card cleanly on three, and collided with the top of the card on the fourth, where a focus move had lifted the card. Not assigned automatically; whether the film uses it is the user's decision (it adds a second text layer next to the caption).

## Backdrop and card (2026-11-25)

A picture that does not fill the frame (a landscape picture on a portrait screen) used to sit as a narrow card on a dark blur, leaving a third to a half of the frame empty. The user chose to fill that space with the background rather than with text (a keyword plate was mocked up and declined; the `keyword` field stays, off). Changes:

- **Backdrop from the picture's own colours:** `cornerPalette` (ffmpeg, 2x2 area average) stores the four corner colours in the shot's media; the renderer builds a gradient from them (darkened, slightly more saturated), a soft glow behind the card and the blurred picture underneath for texture. The gradient turns a few degrees over the shot.
- **Full-width card** (it was 94% wide) and a **lane**: pictures that leave room sit 70 px above or below the middle in turn, so neighbours never share one band.
- **Float** tilts to 7 degrees (it was 4.5) with a 60 px backdrop drift (it was 28), so it can be seen. **Stack** exit no longer blurs the old picture, only shrinks and dims it. Drift after a focus move is 8% (it was 4%). Whoosh effects are about half as loud.
- The caption scrim now fades out below the caption (0.82 at the caption, 0.5 at 88%, 0.34 at the bottom edge) instead of staying near-black to the bottom.

Seen in before/after stills of four shots: the empty bands now carry the picture's colour (taupe, blue, mauve). A picture with a black frame (the iPad, the CarPlay screen) still gives a dark band, because its own colours are dark.
