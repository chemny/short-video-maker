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

## Overflow Rules

- No text should overflow its container.
- No text should overlap preceding or following content.
- Use fixed container dimensions for captions, cards, labels, counters, and cover titles.
- Use `outline` instead of `border` when measuring-sensitive sizing matters.

## Chinese Short Video Typography

- Keep cover titles short and bold.
- Keep subtitles and captions high contrast.
- Avoid negative letter spacing.
- Avoid viewport-width-based font scaling.
- Use platform-safe margins for all critical text.

## DOM Measurement

- If measuring DOM nodes during preview/render, account for Remotion's current scale.
- Use `useCurrentScale()` when converting browser layout measurements to composition pixels.
- Keep measurement logic guarded so it does not create render instability.
