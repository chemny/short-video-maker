# Visual system (fixed frame + shotcraft effects, draft)

Status: draft under user review; not a default. Style A (editorial serif, restrained clay accent) is chosen; tokens and zones are in `frame/kit.tsx`, and the component workbench is `npm run gallery`. Code: `remotion/src/templates/frame/` (`FrameFilm.tsx`, `effects/`). Consistency comes from what never changes; the middle stage carries one authored effect per shot.

## The frame (1080×1920)

| Zone | Content |
|---|---|
| Reserved, y 0 to 290 | Platform top bar (Douyin, WeChat Channels) |
| Topic, y 300 | The film's topic, 72 px serif, identical on every page |
| Stage, y 410 to 1290 | The main visual: one authored effect at a time, 936×880 |
| Caption, y 1320 to 1490, width 810 | The spoken phrase, 54 px, the only text that follows the speech; narrower than the stage so the button rail does not cover it |
| Reserved, below 1535 and the right 194 px | Platform description, progress bar and button rail |

Zone values are the conservative end of third-party estimates (neither platform publishes numbers) and are unmeasured. `FrameFilm.tsx` still holds the earlier zones (topic 104, stage 226 to 1356, caption 1380 to 1550) and has not been updated.

Films built from real pictures (`references/shot-script.md`) use a full-bleed layout instead: the picture fills the frame and only the caption sits in the safe band.

No shot title, key line, tags, rules, cards or page furniture. Anything on the stage is evidence (a real page, an official interface, a sourced sentence) or an explanation drawn with the story (a relation, a sequence, a figure).

## Light and dark

Same system, different tokens (`--page`, `--ink`, `--muted`, `--accent`). Dark: charcoal page, ivory ink, soft clay glow behind the stage. Light: ivory page, near-black ink.

## Effects (each used once per film; `effects/SOURCE.md` has provenance)

`CursorFlyover` (a source page, camera flying sentence to sentence, cursor, marker), `ConvergeMerge` (real interfaces joined by curves into one node), `Odometer` (dates and figures rolling), `DocParkPills` (a sourced article scrolling to each point, a pill dealt for each), `BraceExpand` (conditions opened by braces, joined by "or"), `ExplodedView` (real interface cut-outs fanning out in 3D and closing). Rewrites for portrait, not drop-in ports: demo parameters were tuned on placeholder material at 1920×1080.

## Material

- Source pages are captured at phone width (`capture-page.mjs`: headless Chrome over the DevTools protocol; sentence rectangles come from the DOM, so highlights sit exactly on the words). Official interface images are cut out and trimmed to the largest connected region so no shadow fragments remain.
- Official images carry no overlay credit inside the stage by default; credit them in the production notes. Generated art follows `references/generated-art-style.md` and is not used when a real picture can show the point.
- Never label a picture as a feature it does not show (the Siri interface in the press kit is Apple's own, not Qwen's).

## Not done

Not wired into `run-job.mjs` (no measured-layout audit, review gate or preview identity for these films); fonts are macOS system fonts; effect parameters need fine tuning per film.
