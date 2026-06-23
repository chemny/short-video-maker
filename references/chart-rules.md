# Chart Rules

Use charts when the narration includes comparisons, trends, proportions, timelines, progress, or quantified claims.

## Chart Types

- Bar charts for comparisons.
- Progress bars for process completion or confidence.
- Line charts for trends.
- Donut or pie charts only for simple proportions.
- Tables only when the viewer has enough time to read them.

## Animation

- Disable third-party chart animations.
- Drive all chart motion from `useCurrentFrame()`, `interpolate()`, and `spring()`.
- Stagger bars or rows for readability.
- Keep chart animation short and synchronized with narration.

## Data Integrity

- Do not invent numbers.
- Include source context in analysis files when factual data is used.
- Avoid over-precise visuals for uncertain estimates.
- Do not use decorative charts without real meaning.

## Mobile Readability

- Use large labels.
- Minimize axes and gridlines.
- Highlight the one comparison or trend the narration is explaining.
- Do not show more data points than the viewer can understand in the scene duration.

## Implementation

- React, SVG, and HTML are acceptable.
- D3 can be used for scale calculations, but not for autonomous animation.
- Keep chart components reusable across templates.
