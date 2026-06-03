# Remotion Short Video Skill

[中文](README.zh.md) | English

Turn an article, topic, or rough idea into a narrated vertical short-video package for Xiaohongshu, Douyin, TikTok-style explainers, and other social platforms.

This skill is designed to be portable across Codex, Claude Code, and OpenClaw. The active agent handles research, analysis, script writing, and storyboarding; the bundled Node and Remotion workflow handles validation, TTS synchronization, captions, first-frame preview, rendering, cover export, and packaging.

## Who Should Use It

Use this skill when you want an agent to produce a complete short-video workflow from a source article, topic, or idea:

- Chinese knowledge explainers and opinion videos
- Xiaohongshu and Douyin vertical videos
- Narrated videos with captions, cover image, and publish copy
- Agent-assisted video planning where rendering should stay deterministic

Do not use it as a generic GitHub publishing workflow. Public release checks, security review, and repository sync should be handled by a separate publishing skill such as `GitHub-skill-publisher`.

## What It Produces

- `analysis.json`: audience, angle, claims, risks, and narrative structure
- `script.json`: narration, scene text, and timing estimates
- `storyboard.json`: scene layout, visual direction, motion, and transition notes
- `video-plan.json`: the single Remotion input file
- `voiceover.mp3` and timed captions
- `video.mp4`, `cover.png`, `script.md`, `publish.md`, and `metadata.json`

## Repository Layout

```text
SKILL.md                     Skill entrypoint
README.md                    English documentation
README.zh.md                 Chinese documentation
references/                  Workflow rules, schemas, and design guidance
scripts/                     Deterministic workflow scripts
data/                        Voice presets and reusable data
examples/                    Public example input
jobs/                        Local job workspace, ignored by git
remotion/                    Remotion project
```

Generated audio, captions, videos, local job outputs, and dependency directories are intentionally ignored by git.

## Requirements

- Node.js and npm
- FFmpeg and ffprobe
- Skill-root dependencies installed with `npm install`
- Remotion dependencies installed inside `remotion/`

Install dependencies:

```bash
npm install
cd remotion
npm install
```

After installation, start a fresh agent session if your agent runtime only discovers skills on startup.

## Installation

Install this repository as one skill folder. `SKILL.md` must be at the skill root:

```text
<your-skills-dir>/remotion-short-video/SKILL.md
```

Typical local layouts:

```text
~/.agents/skills/remotion-short-video/
~/.codex/skills/remotion-short-video/
```

## TTS Providers

The workflow supports:

- `edge`: default provider, Microsoft Edge online TTS, no API key required. The runtime default voice is `zh-CN-XiaoxiaoNeural`.
- `local`: macOS system TTS, no API key required. Useful for offline smoke tests on macOS.
- `volcengine`: Volcengine/ByteDance TTS. Requires user-provided credentials.
- `http`: generic third-party TTS adapter. Requires user-provided endpoint and credentials when the provider needs them.
- `none`: skip TTS when audio is handled separately.

Copy `.env.example` into your local environment only when you need provider overrides. Keep real keys in environment variables or a private `.env`; never commit real credentials.

Useful defaults:

```bash
TTS_PROVIDER=edge
EDGE_TTS_VOICE=zh-CN-XiaoxiaoNeural
EDGE_TTS_RATE=default
```

Volcengine credentials:

```bash
VOLCENGINE_TTS_APPID=<your-app-id>
VOLCENGINE_TTS_ACCESS_TOKEN=<your-access-token>
VOLCENGINE_TTS_VOICE_TYPE=<your-voice-type>
```

## Basic Workflow

Create a local job:

```bash
node scripts/init-job.mjs examples/input.md demo-video
```

Fill these files in `jobs/demo-video/`:

```text
analysis.json
script.json
storyboard.json
video-plan.json
```

Generate TTS, captions, and package metadata without rendering:

```bash
node scripts/run-job.mjs jobs/demo-video
```

Generate a first-frame preview for user approval:

```bash
node scripts/run-job.mjs jobs/demo-video --preview-frame=0
```

Render only after the user explicitly approves:

```bash
node scripts/run-job.mjs jobs/demo-video --render --confirmed-render
```

The `--confirmed-render` flag is intentional. It prevents agents from accidentally triggering long renders before the user has approved the visual direction.

## Output

After a successful run, files are written under:

```text
remotion/public/output/
  video.mp4
  cover.png
  first-frame.png
  script.md
  publish.md
  metadata.json
```

## Verification

Run syntax and Remotion type checks:

```bash
npm run check
cd remotion
npm exec -- tsc --noEmit
```

Fresh-session verification prompt:

```text
Use the remotion-short-video skill to create a 60-second Chinese vertical explainer from examples/input.md. Generate the script, storyboard, video plan, captions, and first-frame preview. Do not render the full video until I confirm.
```

## Updating

Pull or copy the latest repository into the same skill folder, then reinstall dependencies if `package.json` or `remotion/package.json` changed:

```bash
npm install
cd remotion
npm install
```

Start a fresh agent session after updating so the runtime can reload `SKILL.md`.

## Publishing

This skill keeps video-generation logic only. For GitHub publishing checks, security review, platform compatibility, and release workflow, use `GitHub-skill-publisher`.

Before publishing this repository, verify:

- no real `.env` or API keys are included
- generated media and `jobs/` outputs are ignored or removed
- `npm run check` passes
- `cd remotion && npm exec -- tsc --noEmit` passes
- `SKILL.md`, `README.md`, `README.zh.md`, `LICENSE`, `.gitignore`, and all referenced files are present

## License

MIT
