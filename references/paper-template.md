# Warm-paper template (paper-v1)

An opt-in, topic-agnostic visual template for authored news and explainer films: ivory paper, near-black ink, one clay accent, serif headlines, hairlines instead of boxes, and a picture in almost every shot (a real photo or a flat illustration). Not an automatic default; select it explicitly and review the complete preview like any other authored renderer.

## How a job uses it

The job keeps a three-line `src/index.tsx` that registers `PaperRoot` from `remotion/src/templates/paper/PaperFilm.tsx`, declares `meta.renderSource` as an authored-remotion composition, and authors `sentence-storyboard.json` shots whose `recipe` is one of the names below. Shot content (text, pictures) and every cue are plain data; each cue is a real caption anchor `{captionId, edge, offsetSeconds}` that the Director resolves to seconds. A missing cue means the element is visible from the shot start. The film never contains topic-specific drawing code.

## Recipes (stable data schema)

`paper-statement` (hook, opinion, takeaway), `paper-list` (3 to 5 parallel items), `paper-timeline`, `paper-points` (numbered groups), `paper-compare` (two sides plus connector), `paper-stat` (counting number and trend line), `paper-flow`, `paper-quote`, `paper-media` (real image with label), `paper-split`. Field names are documented by the sample content in `remotion/src/templates/paper/gallery.tsx`. Avoid the Director's built-in keys `items`, `cards`, `blocks`, `parts` (they are length-bounded) and the built-in recipe names.

## Imagery

An image is `{photo: "path under the job public dir"}` or `{art: kind}`. Illustration kinds: hills, city, device, assistant, chart, people, document, server, moon, cup, house, pin, voice, camera, layers, shield. Illustrations are placeholders that keep a consistent look; use real or generated images when the story needs evidence. Never present an illustration as a photograph, and keep the source label for photographs.

## Preview and checks

`npm run gallery` in `remotion/` opens every recipe in Remotion Studio with sample data and motion. The shared measured-layout audit applies unchanged: use layout roles for every text element (title, body, source, label, caption); a small attribution inside a body line must be its own `source` element. Motion is calm and deterministic: fade-and-rise, picture wipe with slow drift, hairlines that draw, counting numbers, drawn trend lines.
