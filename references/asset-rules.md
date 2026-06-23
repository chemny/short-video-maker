# Asset Rules

Use these rules for AI-generated images, sourced images, video clips, logos, and other visual assets.

## Asset Location

- Put render-time assets under Remotion `public/`.
- Reference local assets with `staticFile()`.
- Use plan paths relative to `public/`, for example `assets/scene-001.png`.
- Keep generated assets out of GitHub unless they are intentional examples.

## Image Handling

- Preserve aspect ratio unless intentional distortion is part of the design.
- For 9:16 videos, crop or compose images for vertical framing.
- Avoid stretching 16:9 images to fill 9:16.
- Use object-fit style choices deliberately: `cover` for backgrounds, `contain` for diagrams or screenshots.
- Add fallback Remotion-native graphics when an image asset is missing.

## AI Image Covers

- Treat AI-generated cover images as background or focal material.
- Keep final Chinese title text in Remotion when readability matters.
- Prompt for empty title space if the image API generates a background.
- Do not rely on image models to render exact Chinese text.

## Sourced Media

- Verify licensing and source suitability before using external media.
- Prefer user-provided or generated assets for publishable videos.
- Avoid factual visuals that could misrepresent real people, companies, products, or events.

## Visual Quality

- Visuals must support the narration.
- Avoid generic "technology background" imagery unless tied to a specific concept.
- Do not use dark, blurry, or decorative-only images when the viewer needs to inspect details.
- Check mobile readability after compression.
