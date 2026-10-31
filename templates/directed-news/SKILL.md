# Directed News — authored portrait candidate

This is a reusable production renderer derived from the reviewed B composition and its three source-adapted Shotcraft recipes. Opt-in only; not the upstream full library and not a universal topic converter. Supports1080x1920/30fps with no extra cover intro and components off. No hardcoded company names, asset filenames or shot IDs select layouts.

Author the existing sentence-storyboard.json with directorVersion1, per-row understanding/visualContribution/claimType and each shot recipe/revealPolicy/motionPurpose. Animation fields use {captionId,edge?,offsetSeconds?}; numeric freehand event times are rejected. The shared entry resolves them only after actual narration alignment. Context can precede its explanation; a spoken conclusion must have an explicit anchor. Highlights persist to shot exit.

Use scripts/run-job.mjs for preview and HD. Set meta.directorVersion=director-v1 and productionWorkflow=reviewed-v1. Actual shared layout inspection, preview hash, renderer identity, review record and PCM exporter apply. No bypass render script is needed. The full pipeline stops at a complete preview when actual visual/listening review remains incomplete; this is successful preview production, not HD acceptance. Do not fabricate passed review checks. See references/director-production.md.
