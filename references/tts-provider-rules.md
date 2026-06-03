# TTS Provider Rules

Use `scripts/tts.mjs` as the only TTS middleware entrypoint.

## Providers

- `edge`: default provider, Microsoft Edge online TTS, no API keys, default voice `zh-CN-XiaoxiaoNeural` (小小).
- `local`: system TTS, no API keys, good for offline smoke tests.
- `volcengine`: built-in high-quality Chinese TTS adapter. Users must provide their own credentials.
- `http`: generic third-party adapter. Users provide endpoint, auth, model, voice, and optional provider fields.

## Commands

```bash
node scripts/tts.mjs voices --provider=edge
node scripts/tts.mjs voices --provider=local
node scripts/tts.mjs voices --provider=volcengine
node scripts/tts.mjs voices --provider=http

node scripts/tts.mjs preview --provider=edge
node scripts/tts.mjs preview --provider=local
node scripts/tts.mjs preview --provider=volcengine --voice-preset=deep-male
node scripts/tts.mjs preview --provider=http --voice=voice-id

node scripts/tts.mjs generate remotion/public/video-plan.json --provider=edge
node scripts/tts.mjs generate remotion/public/video-plan.json --provider=local
node scripts/tts.mjs generate remotion/public/video-plan.json --provider=volcengine --voice-preset=deep-male
node scripts/tts.mjs generate remotion/public/video-plan.json --provider=http --voice=voice-id
```

## Output Contract

Every provider must write:

- `public/audio/voiceover.mp3`
- `public/captions/captions.json`
- `public/captions/captions.srt`
- updated `public/video-plan.json` with scene `start` / `end`, `meta.durationSeconds`, and `audio.provider`

Remotion should never depend on provider-specific response shapes.

## Voice Selection

- If the provider supports voice listing, expose it through `voices`.
- If it does not, accept a manual `--voice` or environment variable.
- Keep voice presets in `data/voice-presets.json`.
- Do not hardcode credentials, user app IDs, tokens, or secrets.

## Render Gate

TTS generation can run before approval. Full video rendering still requires first-frame confirmation.
