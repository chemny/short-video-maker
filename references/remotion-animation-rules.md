# Remotion Animation Rules

Use these rules whenever creating or modifying Remotion visual templates for this skill.

## Frame-Driven Animation

- Drive animation from `useCurrentFrame()` and `useVideoConfig()`.
- Use `interpolate()` for linear or eased value mapping.
- Use `spring()` for entrance, emphasis, and organic motion.
- Clamp interpolated values unless overshoot is intentional.
- Keep animation timing in frames or seconds derived from `fps`; avoid hardcoded frame values without context.

## Forbidden Patterns

- Do not use CSS `animation`.
- Do not use CSS `transition`.
- Do not use Tailwind animation utilities.
- Do not rely on browser runtime timers such as `setTimeout`, `setInterval`, or wall-clock time.

These patterns can preview inconsistently and will not be deterministic in rendered videos.

## Scene Timing

- Wrap timed scene content in `<Sequence>`.
- Convert scene seconds to frames with `Math.round(seconds * fps)`.
- Keep each scene's visible content inside its own frame window.
- Avoid scene layouts that depend on hidden content affecting dimensions outside the active sequence.

## Motion Quality

- Use movement to explain the narration, not as decoration.
- Prefer a small number of deliberate animated elements over many moving parts.
- Keep short-video motion readable on mobile screens.
- Avoid motion that pushes captions, key objects, or titles outside platform-safe areas.

## Template Requirements

- Every template must support 1080x1920 by default.
- Every template must tolerate scenes with no image assets.
- Every template must avoid layout shifts when captions change.
- Every template must render correctly from frame 0.
