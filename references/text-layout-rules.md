# Text Layout Rules

Use these rules for captions, cover titles, cards, charts, and any dense text layout.

## Measuring Text

- Use deterministic text measurement when layout depends on exact text size.
- Prefer `@remotion/layout-utils` for `measureText`, text fitting, and overflow checks.
- Only measure after fonts are loaded.
- Match measurement styles to render styles: family, weight, size, letter spacing, and line height.

## Fitting Text

- Prefer writing shorter text over shrinking type.
- Use dynamic font sizing for cover titles and compact cards.
- Cap maximum and minimum font sizes.
- If the text still does not fit, split it into multiple lines or shorten the copy.
- Use semantic line breaks for Chinese titles. Do not rely on automatic wrapping
  when a title is a key visual element.
- Avoid single-character orphan lines in titles, support lines, cards, labels,
  and captions. No wrapped line may contain only one Chinese character.
- If any line wraps into a one-character line, rewrite or shorten the copy
  before render. Do not accept the frame by merely hoping CSS will wrap better.
- In preview review, treat any one-character wrapped line as a required fix.

## Overflow Rules

- No text should overflow its container.
- No text should overlap preceding or following content.
- Use fixed container dimensions for captions, cards, labels, counters, and cover titles.
- Use `outline` instead of `border` when measuring-sensitive sizing matters.
- Text containers must also respect the active platform safe area. Avoid placing
  titles, support lines, cards, labels, and captions inside top device chrome or
  bottom platform UI zones.

## Chinese Short Video Typography

- Keep cover titles short and bold.
- Keep subtitles and captions high contrast.
- Avoid negative letter spacing.
- Avoid viewport-width-based font scaling.
- Use platform-safe margins for all critical text.
- For 9:16 social video, keep left/right margins symmetric by default and raise
  captions above the bottom title/comment/action area.
- For 3:4 and 16:9, still keep conservative edge margins; do not treat them as
  edge-to-edge design canvases when captions are present.
- For information cards, screen copy should use a hierarchy: main judgment,
  support line, support items, and visual structure. Do not fill a frame with
  transcript-like paragraphs.
- Support items should occupy the frame through matrices, process nodes,
  comparison panels, or diagrams rather than by making the headline longer.

## Frame Readability

- Decorative lines, arrows, connectors, maps, globes, grids, and charts must not
  cross text or sit inside text cards unless they are intentionally muted below
  readability threshold.
- Persistent background motion such as globes, maps, grids, and atmospheric
  linework must use the composition/global frame timeline rather than a
  per-scene local frame, so it keeps moving continuously across page switches.
- If a diagram uses connectors, route them to card edges or place them behind
  cards with enough contrast separation.
- Before full render, check a contact sheet of scene middle frames for repeated
  layouts, empty lower-frame space, title wrapping, and text/visual collisions.
- When changing aspect ratio or target platform, also check a safe-area overlay
  contact sheet. Any critical text inside an overlay danger zone is a layout
  failure.

## DOM Measurement

- If measuring DOM nodes during preview/render, account for Remotion's current scale.
- Use `useCurrentScale()` when converting browser layout measurements to composition pixels.
- Keep measurement logic guarded so it does not create render instability.
