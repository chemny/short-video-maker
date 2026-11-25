# Generated images and video (ComfyUI Agent API)

The user runs a private generation service (ComfyUI behind an HTTP wrapper). Reach it through `scripts/generate-media.mjs`; the client lives in `scripts/lib/comfy-agent.mjs`. Service address: `http://100.96.20.126:8788` (override with `COMFY_AGENT_API_URL`). It is reachable only from machines on the user's Tailscale network. Docs: `/docs`, OpenAPI: `/openapi.json`.

## Key setup (one time, by the user)

Generation, asset and workflow endpoints need a Bearer key; public health and documentation endpoints do not. Put it in `~/.cmm/short-video-maker-local.env`, which the skill already loads and which must stay mode 600 and out of the repository:

```
COMFY_AGENT_API_KEY=<key>
```

Never put the key in a job folder, plan, log, commit or message. The client redacts it from errors and never writes it into records.

## Commands

```bash
node scripts/generate-media.mjs JOB health        # service status; adds upstream/queue when the key is set
node scripts/generate-media.mjs JOB workflows     # registered workflows and fields
node scripts/generate-media.mjs JOB image --prompt="…" --width=864 --height=1536 --seed=42   # dry run: prints the plan only
node scripts/generate-media.mjs JOB image --prompt="…" --confirm --purpose="cover art for cap-1"
node scripts/generate-media.mjs JOB edit --prompt="…" --image=ref.png --confirm --purpose="…"
node scripts/generate-media.mjs JOB video-image --prompt="…" --first-frame=still.png --duration=5 --confirm --purpose="…"
node scripts/generate-media.mjs JOB resume <jobId>   # after an interruption; never resubmits
```

Workflows: `image` (image.generate), `edit` (image.edit, up to 16 images), `video-text`, `video-image` (first frame, optional last frame), `video-reference` (images or motion video; name `<Picture 1>` / `<Video 1>` in the prompt), `replace-person`, and explicit `character-swap`. Video is 24 fps, 2 to 15 s (default 5 except Character Swap, which uses the full source within 2–15 s when duration is omitted), sides a multiple of 32, total pixels at most 1344×768, so a vertical clip is 768×1344. Profiles `fast` (default), `balanced`, `quality`. Image `model_variant` is `standard`, `uncensored` or `turbo` (turbo is fixed at 8 steps); `encoder_variant` is `standard` or `atomicchat_q8`. Pick the least restrictive-looking options only when the user asks for them.

## Rules for using generated media

- **Nothing runs without `--confirm` and a `--purpose`.** Without `--confirm` the command prints the request and the files it would upload and sends nothing. Uploaded local files leave the machine for the user's server, so list them to the user first.
- **A generated asset is level D** in `references/asset-research.md` terms: label it "AI 生成" on screen and in the production notes. Never present it as a photograph, an official image, a screenshot or news evidence, and never use it to depict a real person, product or event that it did not come from.
- **Official and sourced material comes first.** Generate only to fill a real visual need (cover art, abstract backdrops, mood transitions, clips the story cannot otherwise show). Do not generate stand-ins for evidence.
- Confirmed generation uploads its materials, calls `/v1/prepare`, validates an unsubmitted plan for the selected workflow, and saves the full result under `research/preflights/<idempotencyKey>.json`. A timeout, HTTP error or malformed/mismatched preflight blocks submission. The original request is submitted unchanged; server-normalized seeds, prompts and defaults are not copied back into it. The CLI displays preflight warnings; informational missing/out-of-range labels do not automatically block or rewrite an explicit full prompt. Use prepare-only to inspect and resolve warnings before generation when needed.
- Every run is recorded in `research/generated.json`: workflow, request, seed, job id, idempotency key, local file hashes, outputs with SHA256, purpose. Review the actual frames before using a result and write the relevance judgement into the assets list.
- A retry uses the same idempotency key (derived from the request and the local file hashes), so it returns the same remote job instead of generating twice. After a timeout use `resume`, not a new submit. A remote task is not cancelled when the client gives up.
- Check `health` before a long job; the key and queue can fail independently of the wrapper.


## Explicit API policies and preflight

Existing request defaults remain unchanged. The CLI omits new fields unless selected; it does not choose another workflow. `--confirm` and `--purpose` retain their existing meaning. Every new generation submission now requires a successful server preflight; an unavailable preflight endpoint blocks generation instead of falling through.

| CLI option | API field | Applies to | Omitted behavior |
|---|---|---|---|
| `--framing=legacy\|contain\|cover` | `framing` | `video-reference`, `replace-person` | Existing `legacy` spatial processing |
| `--prompt-mode=full\|supplement` | `prompt_mode` | `replace-person`, `character-swap` | Existing full custom prompt, or default template when empty |
| `--frame-instruction="..."` | `frame_instruction` | `replace-person` with explicit `--prompt-mode=supplement` | Standard Qwen endpoint-edit instruction |
| `--resolution-preset=480\|768` | `resolution_preset` | `character-swap` | Server's existing 768 preset |
| `--mask-expansion=N` | `mask_expansion` | `character-swap` | Server's existing 64-pixel expansion |

`contain` retains the source composition with centered black padding; `cover` fills the canvas with centered cropping. These policies align source video, endpoints and optional depth inputs. Independent identity photos are not cropped using the source coordinates. Uploaded endpoints still require visual composition checks. `framing` does not apply to `video-image`, `video-text` or Character Swap.

With `supplement`, `--prompt` adds video requirements to the server's role-aware replacement instruction. In `replace-person`, only `--frame-instruction` adds requirements to the Qwen endpoint-edit stage. In default/full mode, the previous full prompt behavior, including the old endpoint-edit instruction handling, is retained. Generic `video-reference` requires a complete prompt naming the material roles and does not accept `--prompt-mode`.

`replace-person` accepts `--last-frame` (confirmed tail) and repeatable `--image` (additional references); `video-reference` accepts `--anchor-image`. Replacement slots are identity `<Picture 1>`, confirmed/generated opening reference `<Picture 2>`, then additional photos from `<Picture 3>`. A tail guide is not another picture slot. Generic references follow `--image` order from `<Picture 1>`; the source is `<Video 1>`.

To inspect real server preflight without generation:

```bash
node scripts/generate-media.mjs JOB replace-person \
  --identity-image=person.png --motion-video=source.mp4 \
  --framing=contain --prompt-mode=supplement \
  --prompt="Natural smile; retain the source action timing." \
  --frame-instruction="Keep the earrings." --duration=5 \
  --prepare-only --confirm --purpose="Review the replacement plan"
```

Without `--confirm`, this is only a local dry run: no HTTP, uploads, preflight or generation. With `--prepare-only --confirm`, it uploads the listed files, saves the server plan, prints roles, geometry, effective prompts, stages and warnings, then exits without calling `/v1/jobs`. It creates server assets, not a generation job. `--prepare-only` is rejected on `resume`; unknown or route-inapplicable file options are rejected rather than silently ignored. A subsequent authorized generation invocation without `--prepare-only` uploads materials and performs a fresh preflight before submission. For new framing choices, uncertain material roles or a route change, inspect prepare-only output before generating. No extra approval step is imposed on already authorized work.

| Goal | Explicit command | Main limitation |
|---|---|---|
| Overall video edit or source plus identity/object references | `video-reference` | Whole-frame regeneration; action/background retention is not guaranteed |
| Confirmed or automatically edited first/last frames | `replace-person` | Independent endpoint edits may change pose, face or composition |
| Person-mask-constrained replacement | `character-swap` | Depends on detection, tracking and masks; identity and edges can drift |

Character Swap has a separate command; it does not replace `replace-person`. The CLI accepts identity/source, optional prompt, duration, seed, steps, preset, mask expansion and audio (`source` or `none`); the API retains its existing timeout default. Always specify `--duration` when switching routes if the intended source interval must stay fixed. Image-to-video narration remains `video-image`/FL2VA; a photo alone is not a reason to select Ref2VA or a swap workflow. `resume` keeps the existing job and request and never submits a fresh generation request or re-routes it.

## Background music (local mlx-serve)

`scripts/generate-music.mjs JOB --prompt=... --lyrics=... --duration=75 --seed=7 --confirm --purpose=...` calls a local mlx-serve (`MLX_MUSIC_URL`, default `http://127.0.0.1:11240`). Start it only when needed and stop it afterwards: `mlx-serve serve --model /Volumes/T9/AI/models/ddalcu/YuE2-3B-MLX-Serve-8bit --host 127.0.0.1 --port 11240` holds about 11 GB and needs T9 mounted; its preflight wants 12.5 GB free. YuE2 is a song model: it requires lyrics and has no instrumental switch, so listen for vocals before using a track under narration. Keep music well below the voice and duck it against the narration.
