# Shared Design Primitives

These primitives define the vocabulary templates may reuse. They are inspired by
HTML Anything's template skills, but adapted for timed Remotion video.

## Structural Primitives

- `metadata-chrome`: topic, scene number, type label, date/source, or channel.
- `display-title`: one dominant headline, usually 1-2 lines.
- `supporting-claim`: one sentence that explains or sharpens the headline.
- `signal-panel`: a high-contrast block for the keyword, number, or thesis.
- `ledger-row`: numbered keyword or summary rows separated by hairlines.
- `timeline-axis`: horizontal or vertical sequence of steps.
- `compare-panel`: before/after, old/new, model/business, problem/solution.
- `kpi-tower`: data-driven bars or number blocks; only use real numbers.
- `quote-field`: large statement with attribution or source.
- `caption-band`: global subtitle surface; must not compete with scene content.

## Visual Tokens

- `paper`: background color or surface color.
- `ink`: primary readable text.
- `muted`: secondary metadata text.
- `accent`: one active color for emphasis.
- `hairline`: 1-2 px separator/border.
- `grid`: optional layout guide texture.
- `display-font`: headline family/weight.
- `body-font`: support text family/weight.
- `mono-font`: metadata, labels, numbers.

## Hard Rules

- Every visible element must map to a primitive or content field.
- Avoid decorative rails, blobs, generic cards, and orphaned shapes.
- Use one accent color per template instance unless the template explicitly
  defines a multi-color system.
- For 3:4 and 16:9, keep captions visually secondary to the designed frame.
- If a template uses data graphics, values must come from user input or sources.
- Prefer stable dimensions and grid tracks so text does not shift layout.

## Aspect Ratio Responsibilities

- 3:4 is the default design target for professional social video.
- 16:9 should widen the grid and reduce vertical stacking.
- 9:16 should preserve hierarchy and simplify secondary panels.
- A template package must state which aspect ratio is primary.
