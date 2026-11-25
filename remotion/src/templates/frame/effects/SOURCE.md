# effects (rewritten after video-shotcraft)

Four motions adapted from Vincentwei1021/video-shotcraft (Apache-2.0, https://github.com/Vincentwei1021/video-shotcraft), read from the installed copy at `~/.agents/skills/video-shotcraft/demos`, not an upstream snapshot we verified. Changes: portrait 1080×1920 layout, authored cues from the spoken caption times instead of fixed frame tables, our own tokens and media; the second version also replaces placeholder content with real pages and interfaces and changes the layouts substantially, so these are rewrites that keep each demo's idea and easing, not ports of its parameters. The upstream demos were tuned on placeholder material at 1920×1080, so the values here are starting points that were re-checked on our content, not guarantees.

| File | Source demo | What we kept |
|---|---|---|
| `CursorFlyover.tsx` | `demos/camera/cursor-flyover/CursorFlyover.tsx` | overview then zoom-in steps with easeInOutCubic, cursor and click ripple kept at screen size by counter-scaling |
| `ConvergeMerge.tsx` | `demos/ui-entrance/bezier-source-converge-merge/BezierSourceConvergeMerge.tsx` | cubic curves drawn on, nodes slide along their own curve and shrink in three stages, data packets travel the path, path length by a precomputed arc table (no DOM measure) |
| `DocParkPills.tsx` | `demos/ui-entrance/doc-park-left-pill-deal/DocParkLeftPillDeal.tsx` | document slides left to show about 35%, scale 0.92, slow loop scroll with an integer number of cycles, pills dealt with outBack |
| `ExplodedView.tsx` | `demos/camera/space-camera-moves/ExplodedView.tsx` | tilted 3D stage, layers float apart on Z with staggered out-back, drop shadows onto the base, reverse-order closing |
| `Odometer.tsx` | `demos/data/odometer-digit-roll/OdometerDigitRoll.tsx` | per-digit 0-9 strips, staggered easeOutCubic deceleration with half-cell overshoot, two ghost copies while spinning, one pulse when the last digit locks; static dot and unit |
| `BraceExpand.tsx` | `demos/typography/brace-expand/BraceExpand.tsx` | hard-cut small braces, outBack slide outward while growing, text clip width bound to the brace gap, letter-spacing relaxing after it settles |
