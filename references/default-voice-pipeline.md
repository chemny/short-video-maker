# Default local narration and verified export

New generated-narration jobs auto-select **VoxCPM2 when its existing local weights/runtime and ASR prerequisites are ready; otherwise Edge TTS**. Explicit CLI, job or environment choices override detection. All supported narration providers share this pipeline:

```text
approved narration + verbatim phrase captions
  -> selected VoxCPM2 / Edge / Volcengine / macOS system speech
  -> local ASR, synthesis-provider word times or measured system phrase boundaries
  -> aligned caption and scene boundaries
  -> lossless WAV narration/BGM preparation
  -> Remotion video
  -> PCM master with explicitly audible native clips
  -> copy video / encode AAC once
  -> decoded waveform offset/drift verification
  -> hash-bound final quality check
```

Run `node scripts/run-job.mjs /absolute/job --render --confirmed-render` after rendering is authorized. Neither `--tts=voxcpm2` nor `--align` is needed for the default. A preparation-only run also synthesizes/aligns, then packages without presenting an earlier video as a new render. Inspect scene previews and the final contact sheet, and retain the separate listening/editorial check.

## Existing runtime, no automatic installations

- `SHORT_VIDEO_VOXCPM2_DIR`: directory containing the independently installed `generate.py`, `.venv/bin/python`, and `model-spec.json`. On this user's Mac the discovered default is `~/Codex/inbox/voxcpm2-local`. Other machines must point at their own installation. The adapter does not run an installer, download weights, start a service or modify any model-manager settings. An absent/incomplete local environment selects Edge in auto mode; explicitly selected VoxCPM2 remains blocked until configured.
- `SHORT_VIDEO_VOXCPM2_SEED=42` and `SHORT_VIDEO_VOXCPM2_STEPS=10` are defaults; CLI `tts.mjs --seed`/`--steps` override them. Plain mode does not promise a fixed personal voice; no reference recording is selected automatically.
- Only local ASR needs Whisper/PyTorch/NumPy through the `python3` command (or `PYTHON3_BIN`). An existing `small.pt` is preferred, otherwise existing `base.pt`. Set `SHORT_VIDEO_WHISPER_MODEL` or pass runner `--asr-model=/existing/model.pt`. Local ASR Chinese matching additionally needs the existing OpenCC normalization helper runtime. See `requirements-asr.txt`; dependencies/models are never installed by the normal runner.
- `node scripts/doctor.mjs` checks the default runtime/model prerequisites without synthesizing speech or downloading anything.
- Use `SHORT_VIDEO_TTS_PROVIDER=auto` for machine-aware defaults. Selection order is explicit `--tts`/`--provider`, the job audio provider, the environment preference, then automatic capability detection. Set the job provider to `auto` to reset a saved choice. The generic legacy `TTS_PROVIDER` variable is no longer the default selector, so an unrelated older credentials file cannot silently choose an online provider.

Explicit alternatives remain `--tts=edge`, `--tts=local` (macOS say), `--tts=volcengine`, `--tts=http`, and `--tts=none`. Edge/Volcengine automatically align without an extra flag. Use `--align` (or direct TTS `--force-asr`) to explicitly request independent local ASR instead of cloud word times. Explicit VoxCPM2/Edge/Volcengine choices never fail over to another provider on synthesis/alignment errors. macOS say automatically matches measured phrase segment boundaries; HTTP retains its older opt-in `--align` behavior.

Direct commands use the same automatic selection:

```sh
node scripts/tts.mjs voices
node scripts/tts.mjs preview --output=/new/sample.wav --text='你好，这是本地配音。'
node scripts/tts.mjs generate /absolute/job/video-plan.json
```

## Approved text, caching and failure behavior

Keep approved caption text equal to the narration, apart from punctuation/spacing/case and Traditional/Simplified matching normalization. Captions must partition scenes at narration boundaries. If no captions are supplied, the adapter creates short phrase texts from the narration, then gets their times from ASR. It never writes guessed times into the canonical plan.

Short scripts (up to 300 characters including spaces) are synthesized as one utterance. Longer scripts are synthesized serially by scene to bound local inference, then joined as PCM; split any individual scene longer than 300 characters before synthesis. Voice consistency and delivery across long sections still require listening; plain synthesis is not a speaker-identity lock.

WAV caches are content-addressed by actual text/chunks, seed/steps, engine script/spec identity and runtime path. Their audio hashes are verified on reuse. Changing text or generation configuration invalidates synthesis. `--fast`/`--skip-tts-if-exists` never bypass this identity check for VoxCPM2. Transcript caches include audio/model/language identity.

The adapter stages alignment separately. Unmatched, extra, repeated, homophone or uncertain speech blocks the run with a rejected report; existing canonical plan/alignment/delivery remains intact. No word-count fallback or lower confidence threshold is applied. Exact text with only low-probability/zero-duration issues may be independently checked with an already installed base model when the default small model was used. Both must match the approved text; the second result must pass normal rules, and corresponding cue boundaries must agree within 250ms. Both reports are retained. Explicit ASR model selection disables this automatic second check.

Successful generated audio remains `sourceMode=tts`, `provider=voxcpm2`, `timingSource=asr-matched`; it can regenerate safely when approved text changes. This differs from user-imported narration: `sourceMode=imported` defaults to no synthesis and explicit TTS replacement is rejected. For a deliberate voice replacement, create a separate TTS job.

## Full audio timeline and verification

The finalizer uses the exact frame-rounded cover offset and scene/source windows. It mixes:

- prepared narration, gain, optional cleanup/normalization, and ducked/faded BGM **once**;
- every native video's explicitly positive `sourceVolume`, respecting frame-rounded `sourceStart`;
- the outgoing scene's 12-frame transition extension when enabled, capped to the content duration.

The rendered audio is replaced by this complete master, so narration/BGM are not doubled and native source sound is not dropped. Intermediate audio is 48kHz PCM WAV. The video stream is copied; the final audio is encoded to AAC once. No hardcoded 43ms trim is applied: that delay was observed in one encoder path, not a portable constant.

The exported waveform is compared against the PCM master at 8kHz using a Node.js FFT, with no Python/NumPy dependency for cloud-only installations. Global offset and available head/middle/tail windows must stay within 10ms with correlation at least 0.9. Silent masters use an explicit silence check. Silence/repetition or failed verification never certifies listening quality. Missing FFmpeg or failed checks block the export rather than skip it.

`output/audio-export-report.json` records source/master/plan/final-video hashes, frame-based offset/duration, audible clip IDs and the decoded verification. New narrated plans use `audio.exportPipeline=pcm-master-v1`; `quality-check --require-render` rejects missing, failed or stale evidence. A verification failure preserves the original Remotion render and leaves delivery blocked. Do not hand-edit a failing report into a pass.

## Evidence to review

- `audio/voxcpm2-generation.json`: actual model revision/configuration, text/chunks, cache use and audio identity.
- `alignment/alignment-report.json`: approved-text coverage, observed boundaries, issues and apply status; optional `alignment-first-pass.json` for independent checking.
- `audio/processing-report.json`: requested audio processing and prepared WAV.
- `output/audio-export-report.json`: final timeline/mix identity and timing verification.
- `output/quality-report.json`: technical checks, final audio export verification and separate editorial state.

Waveform agreement proves export timing against the mix. ASR provides estimated word boundaries. Neither proves voice naturalness, pronunciation quality, factual correctness or visual relevance; perform and accurately record those checks separately.

## Cloud word timestamps and portable selection

`--tts=edge` and `--tts=volcengine` use the same staged text validation, immutable audio snapshots, PCM timeline, final mux and hash-bound QC as local narration. Approved text is validated before online requests. Per-scene compressed audio is decoded before concatenation; word offsets accumulate actual decoded durations, avoiding MP3 header/priming drift between scenes. Scene caches retain both audio identity and actual provider word times. Filename-only skip flags never certify a different text/voice request.

Edge requests raw word boundaries, keeps their original service text and converts milliseconds to seconds. Volcengine retains v1 `addition.frontend`/`timestamp` word data; the tested large-model endpoint returns milliseconds. Set `VOLCENGINE_TTS_TIMESTAMP_UNIT=s` only for an explicitly seconds-based compatible endpoint. Unsupported/missing word data requires an existing local ASR runtime; it never falls back to character-count timing.

Cloud timing is labeled `audio.timingSource=provider-matched` and backed by `alignment/provider-timing.json`, bound to the exact audio/report hashes. It is not represented as independent ASR. Local timing remains `asr-matched`. Numbers expanded by a provider must still match the approved spoken text; mismatches block automatic application.

Portable Edge jobs require Node/Remotion/FFmpeg and network access, but no Python, Whisper or VoxCPM2. Volcengine additionally requires `VOLCENGINE_TTS_APPID` and `VOLCENGINE_TTS_ACCESS_TOKEN`; credentials remain outside the repository and are not written to generation metadata. In this user's existing complete environment, automatic selection remains local VoxCPM2.

## User choices

```sh
# Automatic: local on a configured host, Edge on a host without local models
node scripts/run-job.mjs /absolute/job --render --confirmed-render
# Explicit online Edge voice/rate
node scripts/run-job.mjs /absolute/job --tts=edge --voice=zh-CN-YunxiNeural --rate=+10% --render --confirmed-render
# Explicit Volcengine preset (credentials must already be configured)
node scripts/run-job.mjs /absolute/job --tts=volcengine --voice-preset=deep-male --speed=1.0 --render --confirmed-render
# Explicit local synthesis
node scripts/run-job.mjs /absolute/job --tts=voxcpm2 --seed=42 --steps=10 --render --confirmed-render
```

Auto selection probes installed files/dependencies read-only; it does not load model weights into inference, install packages, or send any cloud request. Model-file sizes are checked against the local manifest through the existing model setup module. A fixed job provider takes precedence over an environment preference; CLI `auto` resets it for that run.


## Final macOS offline fallback

Automatic mode tries the preferred installed VoxCPM2 backend, then Edge if synthesis is unavailable, then macOS `say` when available. Volcengine remains an explicit, credentialed selection and is not automatically billed. Explicit CLI/job/environment provider choices never switch on failure. Text disagreement or alignment rejection blocks output rather than triggering another voice. Imported narration remains protected.

macOS fallback uses the system default voice and rate; Chinese narration instead selects an already installed matching system Chinese voice (such as Tingting), unless `MACOS_TTS_VOICE` / `MACOS_TTS_RATE` are configured. No voice is installed and no system setting is changed. A system default may not speak Chinese: the adapter selects from the installed voice inventory without modifying OS settings. Missing Chinese voices or implausibly short audio blocks delivery; preview/listen for pronunciation and phrase joins. For direct use: `node scripts/run-job.mjs <job> --tts=local`. Provider-specific cloud voice/rate/model arguments do not carry into automatic fallback. Explicit ASR options still require the requested ASR runtime; they are never silently discarded.

Each approved caption phrase is synthesized separately to AIFF, decoded to PCM, and timed from its actual duration. The joined PCM uses cumulative measured segment boundaries; no character-rate estimates or Python/Whisper are needed. Evidence is labeled `system-phrase-segment-matching`, with caption phrase granularity and possible leading/trailing silence. This is not independent recognition or word-level alignment. Phrase joins and voice quality require listening review. The same staged matching, PCM export, AAC remux and final waveform QC apply.

Fallback warnings appear only when switching. `audio.providerSelection` records attempted/actual backends without credential-bearing error text, and `audio.selectionMode=auto` preserves automatic selection on future runs. Automatic fallback never permanently pins the lower quality voice. A host without macOS `say` receives the underlying failure.

## Partial iteration

VoxCPM2 narration and local ASR now cache independently per scene; the complete preview is hash-bound and reused before HD rendering. See [iteration-workflow.md](iteration-workflow.md) for commands, invalidation and limits. Existing aggregate caches are retained without automatic migration.

默认字幕声学校正、异常停顿处理与演示留白保护现已接入统一入口，见 [默认声学修复](default-acoustic-timing.md)。
