# Quality bar (structural score and what it cannot judge)

Status: step 1 of the rework agreed on 2026-11-17. Command: `node scripts/score-film.mjs <job-dir|video-plan.json> [--json] [--strict]`. Code and thresholds: `scripts/score-film.mjs` (`LIMITS`); change both together.

A film is judged in three layers. Only the first is automated.

## 1. Structural score (automated, necessary, never sufficient)

Measured from `video-plan.json`; when `sentence-storyboard.json` exists its shots are the unit, otherwise the plan's scenes. A scene may hold several picture changes, so scene-based timing is a pessimistic reading; author shots to measure them properly.

| Check | Pass | Fail | Why |
|---|---|---|---|
| Screen time with an image or video asset | ≥ 70% | < 50% | A film made of text cards is a slide deck. Asset provenance is not checked here (step 2) |
| Screen time with no media at all | ≤ 30% | > 50% | Cap on text-only and diagram-only time |
| Screen time with moving footage | ≥ 10% | warn only | Real footage is the strongest material |
| Longest shot | ≤ 8 s | > 12 s | A still picture held for 12 s reads as stalled |
| Average shot length | 2.5 to 6 s | > 12 s | Rhythm |
| First picture change | ≤ 4.5 s | > 7 s | The hook must not sit on one frame |
| Longest run of one layout | ≤ 2 | > 3 | Repetition reads as a template |
| Distinct layouts | ≥ 4 (or the number of shots) | warn only | Variety |
| Shots with motion | ≥ 80% | < 50% | A static picture is not a film (skipped when the unit carries no motion field) |
| Music bed planned (`audio.bgm`) | yes | warn only | Sound carries mood |

Score = passes plus half of warns, over the checks measured. `--strict` exits 1 when any check fails. A pass means the plan is not structurally poor; it says nothing about taste.

## 2. Frame review (agent, from rendered stills)

Done at step 6 from the per-second contact sheet, against a written rubric: one clear focal point per shot; text covers little of the frame; the picture says what the sentence says; no two neighbouring shots look the same; nothing sits inside the platform-unsafe band. The agent sees stills only, never continuous playback.

## 3. User review (once, on the preview)

Only the user can judge "大气", rhythm and whether it holds attention. Review is asked after layers 1 and 2 pass, never before.

## Baseline (2026-11-17, past jobs in `jobs/`)

Seven jobs scored 40 to 85. Five have no media asset at all (0% media, 100% text-only); the two with images fail on scene length and layout repetition or on the first change. This is the starting point the rework must beat on the same topic.

## Material layer (step 2): visual inventory

`node scripts/build-visual-inventory.mjs <job> [--strict]` grades the picture material a topic yields, from `research/` records and any files in `assets/`. Rating counts distinct pictures (sizes of one picture merged): usable on disk count 1, usable undownloaded candidates count 0.5. Rich: weighted ≥ 8 and at least one moving item. Medium: weighted ≥ 4. Otherwise poor, and the user is told before the script is written. `--strict` exits 1 on poor. `scripts/record-source-page.mjs` adds phone-width page scroll recordings.

Trial on two official Apple pages (2026-11-17): 66 candidate pictures, 32 usable after merging sizes and dropping icons, no official video found; a 6 s scroll recording of the feature page showed the real hero, device imagery and pinned sections, plus a regional banner at the top. Rating after the recording: rich (weighted 17). Nothing was downloaded.

## Script layer (step 3): shot script

`scripts/audit-shot-script.mjs` enforces the same limits earlier, on the script, before any audio: text-only beats ≤ 15% (error above 25%), no-picture beats ≤ 30% (error above 50%), opening beat a real picture changing within 4.5 s (error above 7 s), one still beat ≤ 8 s (error above 12 s), a picture used at most twice. See `references/shot-script.md`.

## Film layer (step 5): hook, rhythm, transitions, sound

The shot script gate also warns on flat rhythm, flicker beats under 1.6 s, a slow opening, over-use of transitions, no hook and no music bed (`references/shot-script.md`). `score-film.mjs` scores shot-length variation (needs five shots). Sound levels are set from measured loudness, not guessed volumes.

## Loop (step 6): who sees a film, and when

Layer 1 (structure) is the shot script gate and `score-film.mjs`; layer 2 (frame review) is `review-shot-film.mjs`: FFmpeg measurements plus a frame review recorded against the film's hash; layer 3 is the user, who is shown only a film whose verdict is `ready-for-user`, once. See `references/shot-script.md`, step 6.
