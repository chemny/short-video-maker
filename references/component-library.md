# Component library (design draft, nothing implemented from this page)

Status: five of eleven components are built (`BigFigure`, `BigLine`, `Timeline`, `BraceExpand`, `ConvergeMerge` with text sources); style A (editorial serif) is chosen. `EvidenceQuote`, `DocParkPills` and `DeviceStage` need page captures and interface cut-outs and are not built. `FrameFilm.tsx` does not use the new components yet. Code: `remotion/src/templates/frame/{kit.tsx,registry.ts,components/,gallery.tsx}`; workbench: `npm run gallery` in `remotion/`. Answers one problem: a topic's research should turn into components people like to watch without hand-writing a storyboard per film. Builds on `references/visual-system.md` (fixed frame) and `remotion/src/templates/frame/effects/`.

## Principles

1. **One shot, one subject.** The stage shows a single thing at large scale: a figure, a sentence, an interface, a relation. No page furniture, no second focus.
2. **Evidence is cropped, not pasted.** A source page is shown as the one sentence being spoken, zoomed to read at phone size, with the page edge as context. A whole page in the stage is never a shot.
3. **A component is chosen by information type**, not by taste (table below). The Director maps each beat's claim type to a component; it does not invent layouts.
4. **Components are data-driven.** Props come from `claims.json` fields; copy, numbers, images and cue times are inputs, never edited in the component.
5. **Each component is finished once.** It ships with a sample page (real content, light and dark, short and long text) and passes the measured-layout audit before any film uses it.
6. **No component twice in one film** unless the beats differ in meaning; repeated motion reads as repeated announcement.

## Information types and components

| Type (claim shape) | Component | Shows | Props (required) | Limits | Basis today |
|---|---|---|---|---|---|
| `figure`: a date, amount, count | `BigFigure` | digits roll to the value, unit and one label | `parts[{prefix?, value, suffix?}]`, `label?` | 1 to 2 parts, 6 digits each, label ≤4 chars | `Odometer` |
| `sequence`: before then after (dates, stages) | `Timeline` | 2 to 4 points on a vertical line, each landing on its cue | `points[{when, what}]` | ≤4 points, `what` ≤8 chars | new |
| `compare`: A against B | `SplitCompare` | two panels, one value each, a verdict line | `a{label,value}`, `b{label,value}`, `verdict?` | ≤6 chars per label | new |
| `scope`: conditions joined by or/and | `BraceExpand` | braces open to reveal each condition | `conditions[{text, sub?}]`, `joiner` | ≤3 conditions, text ≤8 chars | `BraceExpand` |
| `relation`: several sources into one | `ConvergeMerge` | sources joined by curves into a target | `sources[{image or text}]`, `target` | 2 to 4 sources | `ConvergeMerge` |
| `quote`: a sentence from a source | `EvidenceQuote` | the sentence zoomed, highlighted word by word with the voice, source line under it | `page{image, rect}`, `highlight`, `sourceLabel` | one sentence ≤30 chars highlighted | `CursorFlyover` rewritten to crop |
| `document`: several points inside one article | `DocParkPills` | article scrolls, one pill dealt per point | `page`, `points[{rect, pill}]` | ≤3 points, pill ≤6 chars | `DocParkPills` |
| `interface`: what the product looks like | `DeviceStage` | one official screen large, optional exploded layers | `screens[{image}]`, `mode: still|explode` | 1 to 3 screens, cut-outs trimmed | `ExplodedView` |
| `steps`: how it works | `Steps` | ≤4 nodes drawn in order, line follows the voice | `steps[{icon?, text}]` | ≤4 steps, text ≤6 chars | new |
| `idea`: an abstract point with no evidence | `ObjectPlate` | one generated object in the film's art style, nothing else | `image` | art style per `generated-art-style.md`; ≤1 per three shots | generated media |
| `hook`: the first second | `BigLine` | one bold line already on screen at frame 0 | `text` | ≤8 chars per line, ≤2 lines | new |

## Shared contract (every component)

- **Props are plain JSON.** Strings are Chinese or English only; any image is an asset path with a recorded source and licence.
- **Timing.** The component receives `from`, `to` and a list of cues `{captionId, edge, offsetSeconds}`; it never uses fixed second counts of its own. Minimum visible time 2.0 s, comfortable 3 to 6 s. A component that cannot hold its end state to the shot's end is a defect (the HyperFrames `count-up` block vanished when the shot outlived its authored 3 s; we must not repeat it).
- **Theme.** Colours only through the frame tokens (`--page --ink --muted --accent --mark --blend --grade`); no hard-coded colour in a component. Accent is set by the film, not the component.
- **Zones.** Stage 936×880 at y 410 to 1290; nothing outside it. The platform-safe band is y 290 to 1535 with the right 194 px reserved for the button rail (`visual-system.md`). Key content stays off the stage's lower-right corner.
- **Text.** Sizes from the three-step type scale in the frame; never shrink to fit, shorten the copy (limits above are the contract). Measured against the real rendering by `check-layout`.
- **Determinism.** Every value is a function of the frame number; no random, no timers.
- **Failure behaviour.** Over a limit the component refuses with a message naming the prop; it never clips silently.

## Data flow

`claims.json` entry gains `type` (one of the table) and `payload` matching that component's props. The Director picks the component from `type` and fills cues from the aligned captions. Example:

```json
{ "claimId": "c7", "type": "figure", "payload": { "parts": [{"prefix": "11月", "value": 4, "suffix": "日"}], "label": "测试" } }
```

Claims with no matching type fall to `BigLine` (spoken line as text) or `ObjectPlate` (idea), and the Director note says why.

## Quality gate per component

1. A sample page rendering the component with real content from a finished film: dark and light, one short and one maximum-length text, three timings.
2. `check-layout` clean on all of them, and stills reviewed by the user before any motion is added.
3. A props schema (JSON Schema) in the component folder, used by the Director to validate a plan before rendering.

## Build order

1. Re-cut the six existing effects to this contract (props schema, cue input, held end state, theme tokens only): `BigFigure`, `BraceExpand`, `ConvergeMerge`, `EvidenceQuote`, `DocParkPills`, `DeviceStage`.
2. New: `BigLine`, `Timeline`, `Steps`, `SplitCompare`, `ObjectPlate`.
3. Sample page and schema for each, then a still review.
4. Wire `type` and `payload` into research and the Director.

## Decisions (2026-11-15)

- **Safe band.** Target Douyin and WeChat Channels. Neither publishes official numbers; third-party estimates give top 190 to 290 px, bottom 200 to 385 px, button rail 90 to 194 px. We take the conservative end (top 290, bottom 385, right 194) and have not measured the apps. Replace with measured values if a screenshot of each app's playback screen is ever available.
- **Look.** No reference videos from the user. Three candidate directions are shown as stills of one component (`BigFigure`) and the user picks; until then nothing is a standard.
- **Count.** First batch is eight: the six re-cuts plus `BigLine` and `Timeline`. `SplitCompare`, `Steps` and `ObjectPlate` are added when a topic first needs them; until then a compare claim falls back to `BigLine`, which will read plain.
