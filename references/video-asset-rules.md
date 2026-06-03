# Video Asset Rules

Use these rules when embedding source video clips, screen recordings, GIFs, APNG, AVIF, WebP, or Lottie assets.

## Video Clips

- Use `<Video>` from `@remotion/media` for video assets.
- Use `staticFile()` for local video clips in `public/`.
- Use remote URLs only when availability and CORS are reliable.
- Use `trimBefore`, `trimAfter`, `playbackRate`, `loop`, and `muted` deliberately.

## Clip Audio

- Mute source clips by default when voiceover is present.
- Only keep source clip audio if it is part of the story.
- Balance clip audio against voiceover and BGM.

## Animated Images

- Use Remotion's animated image support for GIF/APNG/AVIF/WebP when appropriate.
- Keep animated images synchronized with the composition timeline.
- Avoid large looping GIFs that slow rendering.
- Prefer short, purposeful animated assets over decorative loops.

## Lottie

- Use `@remotion/lottie` for Lottie animations.
- Load Lottie JSON with render-blocking safeguards.
- Keep Lottie dimensions explicit.
- Do not use Lottie animations that run independently of Remotion's frame timeline when synchronization matters.

## Web-To-Video Templates

- It is acceptable to first design a web-like template and then render it with Remotion.
- The web template must still obey Remotion rules: frame-driven animation, no CSS transitions for rendered motion, stable dimensions, and safe text layout.
- Avoid depending on browser-only interactivity during render.
