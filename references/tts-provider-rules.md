# TTS Provider Rules

Use `scripts/tts.mjs` as the only TTS middleware entrypoint.

## Providers

- `voxcpm2`: default on a complete local environment, existing independent local runtime, plain speech and mandatory conservative ASR matching. See `default-voice-pipeline.md` for runtime paths, caching, failure behavior and verified PCM export.
- `edge`: default without a complete local environment, or explicit Microsoft Edge online TTS, no API keys, default voice `zh-CN-XiaoxiaoNeural` (小小).
- `local`: macOS system TTS, final automatic offline fallback, measured caption-phrase timing without ASR.
- `volcengine`: built-in high-quality Chinese TTS adapter. Users must provide their own credentials.
- `http`: generic third-party adapter. Users provide endpoint, auth, model, voice, and optional provider fields.

## Commands

```bash
node scripts/tts.mjs voices
node scripts/tts.mjs generate /absolute/job/video-plan.json
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

Use job-local paths relative to the canonical plan. VoxCPM2 commits immutable `audio/source/*.wav` and aligned captions only on successful matching; older explicit adapters retain their `audio/voiceover.mp3` path. Each successful provider writes:

- a job-local audio reference in `audio.voiceover`
- updated canonical `video-plan.json` with captions, scene `start` / `end`, `meta.durationSeconds`, and `audio.provider`
- the normal package step exports `captions/captions.json` and `captions/captions.srt` (also available in the delivery package)

Remotion should never depend on provider-specific response shapes.

## Voice Selection

- If the provider supports voice listing, expose it through `voices`.
- If it does not, accept a manual `--voice` or environment variable.
- Keep voice presets in `data/voice-presets.json`.
- Do not hardcode credentials, user app IDs, tokens, or secrets.

## Render Gate

TTS generation can run before approval. Full video rendering still requires first-frame confirmation.

Edge and Volcengine generation now automatically match word times through the shared staged pipeline. Edge uses node-edge-tts 1.2.11; cloud-only jobs do not need local TTS/ASR or Python for normal matching/export. See default-voice-pipeline.md for provider selection and timestamp provenance.


Automatic mode falls back from unavailable VoxCPM2 synthesis to Edge, then to macOS system speech when available. Chinese narration selects an installed Chinese voice; other narration uses the OS default. `--tts=local` selects it directly. No model, Python or voice download is needed. Caption timing comes from actual separately synthesized phrase audio, with no word-level recognition claim. Explicit provider choices and text/alignment failures do not switch voices. See [pipeline details](default-voice-pipeline.md).
