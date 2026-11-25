# Generated-art style: paper-craft still life (style A)

Chosen by the user on 2026-11-01 from four candidates (paper-craft, frosted glass, line art, macro photograph). Use it for every AI-generated picture in a film so they read as one set. Generation itself is in `references/generated-media.md`.

## What a picture is

One object that stands for an idea, never a screen, a person or a brand: a lock for privacy, layered sheets for a system layer, a key for access, a notebook for writing, a plant and cup for looking around. It is a metaphor beside the evidence, not evidence.

## Look

- **Subject:** hand-made paper-craft and matte clay objects, soft edges, visible paper grain.
- **Colour:** clay orange (#D97757 to #E58D62), olive green (#788C5D), ivory; at most one neutral metal accent.
- **Light:** low soft side light, a gentle contact shadow, no hard highlights.
- **Background:** flat, no texture. Dark theme: charcoal #14120F to #100F0D. Light theme: ivory #F4EFE4. Do not mix in one film.
- **Composition:** subject centred and small enough to leave about 40% empty space; nothing touches the edge, so the picture can fade into the page.
- **Never:** text, letters, numbers, logos, UI, faces, hands, real products or events.

## Prompt template

```
<subject>，扁平纸艺立体质感，<theme background>，陶土橙与橄榄绿点缀，低调侧光，柔和接触阴影，主体居中，四周大面积留白，高级编辑插画，无文字无标志无人物
```

Negative prompt: `文字，字母，数字，标志，水印，手机界面，屏幕内容，人脸，写实人物，浅色背景`（dark theme）or `…，深色背景`（light theme）。

Size 1024×768 with `model_variant=turbo`; wide pictures 1344×768. Make three seeds per subject, look at each, keep the best, and write the choice into `research/generated.json` and the production notes.

## Rules

- At most about one generated picture per three shots; official and sourced material comes first.
- If a result shows an unwanted object (an elephant, a person, a screen), reroll; do not keep it.
- A generated picture never replaces what an official image, quotation or screenshot could show.
