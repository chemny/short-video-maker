# Remotion 短视频制作 Skill

中文 | [English](README.md)

这个 skill 用来把一篇文章、一个主题或一个粗略想法，转成适合小红书、抖音、TikTok 风格解说视频的竖屏短视频包。

它设计为可在 Codex、Claude Code、OpenClaw 中迁移使用。Agent 负责调研、分析、脚本和分镜；本地 Node 脚本与 Remotion 工程负责校验、TTS 同步、字幕、首帧预览、渲染、封面导出和打包。

## 它怎么工作

```mermaid
flowchart TD
    A["文章 / 选题 / 想法"] --> B["提炼观点和受众"]
    B --> C["生成脚本和分镜"]
    C --> D["生成 video-plan.json"]
    D --> E["生成旁白和字幕"]
    E --> F["生成首帧预览"]
    F --> G{"用户确认?"}
    G -- "继续调整" --> C
    G -- "确认渲染" --> H["Remotion 渲染视频"]
    H --> I["打包视频、封面、脚本和发布文案"]
```

Agent 负责创作判断：调研、提炼角度、写脚本、规划分镜。本地脚本负责稳定执行：校验结构、同步 TTS、生成字幕、预览首帧、渲染、质检和打包。

## 适合谁使用

当你希望 agent 从文章、主题或想法出发，完成一套短视频制作流程时使用它：

- 中文知识解说和观点视频
- 小红书、抖音竖屏视频
- 带旁白、字幕、封面和发布文案的视频
- 需要把创作判断和确定性渲染分开的 agent 工作流

不要把它当成 GitHub 发布工具。公开发布检查、安全审查和仓库同步应该交给独立的 `GitHub-skill-publisher`。

## 可以生成什么

- `analysis.json`：受众、角度、论点、风险和叙事结构
- `script.json`：旁白、场景文案和时长估算
- `storyboard.json`：场景版式、视觉方向、动效和转场
- `video-plan.json`：Remotion 使用的单一输入文件
- `voiceover.mp3` 和时间轴字幕
- `video.mp4`、`cover.png`、`script.md`、`publish.md`、`metadata.json`

## 目录结构

```text
SKILL.md                     Skill 入口
README.md                    英文说明
README.zh.md                 中文说明
references/                  工作流规则、schema 和设计指南
scripts/                     确定性工作流脚本
data/                        音色预设和复用数据
examples/                    公开示例输入
jobs/                        本地任务工作区，默认不进入 git
remotion/                    Remotion 工程
```

音频、字幕、视频、本地任务输出和依赖目录默认不会进入 GitHub。

## 环境要求

- Node.js 和 npm
- FFmpeg 和 ffprobe
- 在 skill 根目录安装依赖
- 在 `remotion/` 目录安装 Remotion 依赖

安装依赖：

```bash
npm install
cd remotion
npm install
```

安装后，如果你的 agent 运行环境只在启动时扫描 skill，请开启一个新的 agent 会话。

## 安装方式

把这个仓库作为一个独立 skill 文件夹安装。`SKILL.md` 必须位于 skill 根目录：

```text
<your-skills-dir>/remotion-short-video/SKILL.md
```

常见本地目录：

```text
~/.agents/skills/remotion-short-video/
~/.codex/skills/remotion-short-video/
```

## TTS 供应商

当前支持：

- `edge`：默认供应商，Microsoft Edge 在线 TTS，不需要 API key。运行时默认音色是 `zh-CN-XiaoxiaoNeural`。
- `local`：macOS 系统 TTS，不需要 API key，适合 macOS 离线冒烟测试。
- `volcengine`：火山引擎/字节 TTS，需要用户自己提供凭证。
- `http`：通用第三方 TTS 适配器。如果供应商需要鉴权，需要用户自己提供 endpoint 和凭证。
- `none`：跳过 TTS，用于外部音频流程。

只有需要覆盖供应商配置时，才参考 `.env.example` 配置本地环境。真实密钥应放在环境变量或私有 `.env` 中，不要提交到仓库。

常用默认值：

```bash
TTS_PROVIDER=edge
EDGE_TTS_VOICE=zh-CN-XiaoxiaoNeural
EDGE_TTS_RATE=default
```

火山引擎凭证：

```bash
VOLCENGINE_TTS_APPID=<your-app-id>
VOLCENGINE_TTS_ACCESS_TOKEN=<your-access-token>
VOLCENGINE_TTS_VOICE_TYPE=<your-voice-type>
```

## 基本流程

创建本地 job：

```bash
node scripts/init-job.mjs examples/input.md demo-video
```

填写 `jobs/demo-video/` 下的内容文件：

```text
analysis.json
script.json
storyboard.json
video-plan.json
```

只生成音频、字幕和发布包，不渲染视频：

```bash
node scripts/run-job.mjs jobs/demo-video
```

生成首帧预览，给用户确认：

```bash
node scripts/run-job.mjs jobs/demo-video --preview-frame=0
```

用户明确确认后再渲染完整视频：

```bash
node scripts/run-job.mjs jobs/demo-video --render --confirmed-render
```

`--confirmed-render` 是刻意保留的确认门，用来避免 agent 在用户确认视觉方向前自动触发长时间渲染。

## 输出文件

成功运行后，输出在：

```text
remotion/public/output/
  video.mp4
  cover.png
  first-frame.png
  script.md
  publish.md
  metadata.json
```

## 验证方式

运行脚本语法检查和 Remotion 类型检查：

```bash
npm run check
cd remotion
npm exec -- tsc --noEmit
```

新会话验证 prompt：

```text
请使用 remotion-short-video skill，基于 examples/input.md 生成一个 60 秒中文竖屏解说视频方案。请生成脚本、分镜、video-plan、字幕和首帧预览。在我确认之前不要渲染完整视频。
```

## 许可证

MIT
