# Font Rules

Fonts determine whether the video feels polished, especially for Chinese short videos.

## Default Strategy

- Use system Chinese font fallbacks for maximum portability.
- Separate cover title font, body text font, and caption font when possible.
- Keep font choices restrained and readable after platform compression.

## Local Fonts

- Place local font files under `public/fonts/`.
- Load local fonts before rendering when exact typography matters.
- Use consistent family names and weights.
- Do not publish commercial fonts unless licensing allows it.

## Google Fonts And Remote Fonts

- Use `@remotion/google-fonts` for Latin fonts when appropriate.
- Load only needed weights and subsets.
- Avoid remote font dependency for Chinese-heavy videos unless reliability is acceptable.

## Font Loading

- Wait until fonts are loaded before measuring text.
- Use font-loading utilities that block rendering until ready.
- Validate font availability in templates that depend on precise layout.

## Chinese Typography

- Prefer bold, high-legibility Chinese fonts for covers.
- Use simpler fonts for captions and body text.
- Avoid thin Chinese fonts in compressed mobile video.
- Avoid decorative fonts for factual or educational videos unless the brand requires them.
- For information-heavy spoken videos, avoid making every text layer equally
  heavy. Use a clear weight ladder:
  - title: strong, but one step lighter than poster weight when the frame is not
    a cover;
  - card keyword: lighter than title;
  - support line: medium weight;
  - labels, scene numbers, and mono tags: small, restrained, and secondary;
  - bottom captions: large enough for mobile compression, even if other text is
    visually refined.
- If the frame feels crude or overly loud, reduce title and card keyword weight
  before reducing font size.
- If the frame is hard to read, increase contrast or support-line size before
  making all weights heavier.
