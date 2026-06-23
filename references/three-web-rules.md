# 3D And Web Template Rules

Use these rules when building richer visual templates, including 3D scenes or web-first UI compositions that become videos.

## 3D In Remotion

- Use Three.js or React Three Fiber only when 3D adds clear value.
- Use `@remotion/three` and wrap 3D content in `ThreeCanvas`.
- Set explicit canvas width and height from `useVideoConfig()`.
- Add proper lighting; do not rely on default dark scenes.

## 3D Animation

- Drive 3D animation from `useCurrentFrame()`.
- Do not use React Three Fiber's `useFrame()` for rendered animation.
- Do not let shaders, model animations, or physics run from real time unless they are locked to Remotion frames.
- Use `<Sequence layout="none">` when sequencing content inside `ThreeCanvas`.

## 3D Quality Checks

- Verify the canvas is nonblank.
- Verify camera framing on desktop and mobile dimensions.
- Verify lighting and materials are visible after compression.
- Avoid heavy scenes that make rendering impractically slow.

## Web-To-Video Workflow

- Building a web page first is valid when it improves design quality.
- Convert the web experience into Remotion components before final video rendering.
- Remove interactive-only behavior that cannot be represented on a deterministic timeline.
- Replace CSS transitions with Remotion frame-driven animation.
- Keep layout responsive, but render-critical sizes should be stable and composition-aware.

## Tailwind

- Tailwind can be used if installed and configured.
- Do not use `transition-*` or `animate-*` classes for rendered motion.
- Prefer explicit CSS-in-JS for timing-critical video layout.
