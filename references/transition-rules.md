# Transition Rules

Use transitions to support the narrative, not to decorate every scene change.

## Transition Types

- `cut`: default for fast short-video pacing.
- `fade`: soft conceptual transitions.
- `slide`: workflow, list, or interface transitions.
- `wipe`: data, comparison, or timeline transitions.
- `flip` or stylized transitions: only when the visual identity calls for it.

## Package Guidance

- Prefer `@remotion/transitions` for full-screen scene transitions when template complexity grows.
- Keep simple internal motion in scene components when a full transition library is unnecessary.

## Duration

- Use short transitions for social video, usually 8-20 frames at 30fps.
- Remember that transition sequences overlap adjacent scenes.
- Adjust total duration if transition overlap changes timing.
- Do not let transitions desynchronize captions or voiceover.

## Timing

- Linear timing is predictable for cuts, wipes, and quick slides.
- Spring timing can feel more natural for UI and object movement.
- Keep all transition timing frame-driven.

## Safety

- Do not transition captions independently from the voiceover unless the design requires it.
- Avoid transitions that obscure important words, faces, charts, or UI screenshots.
- Check the first and last frame of each transition for blank or awkward states.
