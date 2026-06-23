# Preference Rules

Use `data/user_prefs.template.json` as the shape for reusable defaults. A real `user_prefs.json` may exist locally, but it should not be committed or treated as universal truth.

## Priority

Apply preferences in this order:

```text
Remotion defaults < shared user_prefs.json < job instructions < current user request
```

The current user request always wins.

## What Can Be Remembered

- Default target platforms.
- Preferred TTS provider and voice.
- Preferred caption style.
- Preferred cover style.
- BGM volume range.
- Common CTA tone.
- Preferred visual templates.

## What Must Not Be Stored

- API keys.
- Access tokens.
- Personal account credentials.
- Private publish destinations.
- One-off instructions that only applied to a specific job.

## Agent Behavior

- If a preference file exists, read it before generating `video-plan.json`.
- If the user says "save this as default", update the local preference file only after confirming the exact preference to save.
- Do not silently learn from every run. Ask before writing persistent preferences.
