---
name: editorial-brief
zh_name: "编辑简报"
en_name: "Editorial Brief"
description: "Swiss/editorial-inspired short-video template for professional explainers, courses, consulting, and business opinion videos."
category: video
scenario: education
aspect_hint: "1080x1440 primary; responsive to 1920x1080 and 1080x1920"
tags: ["editorial", "swiss", "brief", "course", "consulting", "business"]
remotion_component: "SceneEditorialBrief"
---

# Editorial Brief

## Intent

Use this template for professional knowledge videos where trust, clarity, and
business judgment matter more than viral decoration. It borrows from HTML
Anything's deck systems: each visual route is a closed frame system, not a
single layout with different colors.

Good for:

- course or consulting accounts;
- business and AI workflow analysis;
- founder/product/strategy opinion;
- structured explainers with 5-9 scenes.

Avoid for:

- emotional storytelling that needs photography;
- meme, entertainment, or glitch-heavy hooks;
- data-heavy content with real charts; use `data-punch` or a future data template.

## Required Fields

Each scene should include:

- `caption`: one main judgment, ideally 8-18 Chinese characters.
- `body`: one supporting sentence, ideally 16-34 Chinese characters.
- `tags`: 2-4 concrete support items, preferably exact words from the voiceover
  when tag timing/highlighting is needed.
- `type`: drives the small scene label.
- `layout`: should express the scene function, not just visual style.

Do not put a paragraph in `caption`. Do not repeat the subtitle text in `body`.
Read `references/screen-copy-rules.md` before generating these fields.

## Layout Pool Contract

The template has a fixed layout pool. Choose the layout by scene function before
writing visible text. Do not choose the layout after writing generic text.
For topic-to-video generation, use `arcRole`, `narrativeAction`, and
`contentShape` from the scene plan as the bridge between narrative planning and
this template's layout pool.

| Layout | Use when | Required fields | Fallback |
|---|---|---|---|
| `hook` | Opening or thesis scene | `caption`, `body`, 1-3 `tags` | Use one support block if tags are missing |
| `definition` | Explaining a new acronym, role, product, method, or concept | `caption`, `body`, 2 contrast tags or definition tags | Use a field-note panel with the definition |
| `scenario-matrix` | Showing real business actions, roles, or examples | 3-4 `tags` or `steps` | Rewrite body into 2-4 concrete examples |
| `diagnostic` | Asking what needs a model, agent, or process redesign | 2-4 `steps` or question-like tags | Use a compact checklist |
| `flow` | Showing abstraction, workflow conversion, or process design | 3 `steps` | Use `body` as the middle node and infer input/output from narration |
| `signal` | Showing old/new, before/after, market contrast, or evidence | 2 tags or 2 data entries | Use left/right contrast panels |
| `capability` | Explaining role implications or required abilities | 3 tags or steps | Use three capability rows |
| `takeaway` | Final synthesis or call-to-think | `caption`, `body`, 2-3 tags | Use a three-part synthesis frame |

The layout pool is a content contract. If the scene lacks the fields required
for the chosen layout, rewrite the screen copy or choose a more suitable layout.
Do not fill missing structure with decorative cards.

Recommended mapping:

| `contentShape` | Preferred layout |
|---|---|
| `statement` | `hook` or `takeaway` |
| `definition` | `definition` |
| `contrast` | `signal` |
| `examples` | `scenario-matrix` |
| `diagnostic` | `diagnostic` |
| `flow` | `flow` |
| `signal` | `signal` |
| `capability` | `capability` |
| `data` | use another data-oriented template unless data is light and textual |
| `case` / `image-evidence` | use a visual slot only when the asset supports the argument |

## Field Writing Contract

Use the four-layer screen-copy model:

1. `caption` = main judgment;
2. `body` = support claim or "so what";
3. `tags` / `steps` / `data` = concrete support items;
4. `layout` = visual structure that carries those support items.

For new acronyms or concepts, the first scene must pass the context gate:

- name the exact subject;
- identify it in plain language;
- state the video's judgment or question.

For Chinese text, rewrite before render if any title, support line, card text,
or caption wraps into a one-character final line.

## Frame System

This template must vary layout by scene function. Do not render every scene as
the same two-column card.

Required frames:

- `statement`: hook/opening judgment; display headline, sparse support text,
  ledger row.
- `split`: definition/context; large title plus a strong field-note panel.
- `process`: examples, steps, workflow nodes; 2-3 tiles using ordinal chrome.
- `quote`: thesis or turning point; centered or poster-like statement frame.
- `stat`: evidence/market signal; large color block plus ledger/stat rows.
- `closing`: final takeaway; centered or poster-style closing frame.

Primary 3:4 layout rules:

- keep top `metadata-chrome`: topic / scene count / scene type;
- use the visual route's own background system: graph paper, color blocks,
  paper panels, pin notes, or swatches;
- use display typography at frame scale, not card scale;
- move supporting detail into frame-specific components rather than repeating
  the same card structure;
- global captions sit below designed content and must remain secondary.

16:9 adaptation:

- keep the same chrome and title;
- widen the mid-frame brief into a horizontal system;
- keep bottom ledger as a low band;
- avoid stacking too much vertical content.

9:16 adaptation:

- reduce secondary panels;
- keep one strong headline;
- favor 1-2 tags only.

## Visual Routes

Set `style.editorialVariant` to choose one complete route. Do not mix palettes
inside one video unless the whole series is intentionally multi-chapter.

Set `style.layoutSystem` when the video should use an aspect-ratio-aware spoken
video layout rather than the older editorial slide chrome:

- `spoken-card-v1`: platform-neutral spoken-video information cards. This is
  not a Xiaohongshu-specific system; it supports 3:4 now and is intended to be
  extended to 9:16 and 16:9 with the same content rules. Platform choice belongs
  to `publish`, not to the visual template.

`spoken-card-v1` should follow the HTML Anything 3:4 card grammar rather than
the older Remotion tile grammar:

- `topline`: compact series label plus scene number.
- `tag`: one short content label, not a permanent platform badge.
- `headline`: large, high-confidence title; it owns the frame.
- `lead`: one supporting sentence below the headline.
- `copy`: one left-accent quote/explanation block for thesis frames.
- `list`: stacked rows for concrete business examples.
- `flow`: stacked process rows for question/process frames.
- `split`: two comparison panels for market signal or contrast frames.
- `footer`: small metadata plus progress rule; avoid heavy bottom ledgers.

Avoid dense three-column mini-cards as the default. They make 3:4 spoken-video
frames feel like dashboards instead of authored video cards.

### Spoken-card Information Layouts

For information-heavy spoken videos, vary the frame structure by scene function.
Use one visual language, but do not repeat one layout across all scenes.

| Scene function | Structure |
|---|---|
| Hook / thesis | Strong judgment headline, support line, one compact support block |
| Definition | "Not / but" contrast, field-note panel, or definition split |
| Examples / context | 2x2 scenario matrix or role/action grid |
| Diagnosis / questions | Three-question diagnostic panel |
| Process / abstraction | Flow conversion such as input -> rule -> workflow/result |
| Evidence / market signal | Left/right contrast or before/after signal pair |
| Role implication | Role matrix or capability map |
| Ending / takeaway | Triangle, loop, or three-part synthesis |

Each scene should contain:

1. a main judgment;
2. a support line;
3. support items;
4. a visual structure that maps to those support items.

Use the named `Layout Pool Contract` above as the source of truth. The table
below is only a semantic guide for choosing the right structure.

For the first scene, pass the context gate before optimizing for style:

- If the topic is a new role, acronym, method, product, company, person, or
  event, name it in the headline or support line.
- Give a short definition or identification before relying on an abstract
  judgment.
- Then state the thesis. A strong hook should still let a cold viewer know what
  the video is about.

Do not fill empty space by making titles longer. Use matrices, process nodes,
comparison panels, restrained linework, or background motion.

- `html-cobalt-grid`: based on Beautiful HTML Templates `cobalt-grid`; warm
  graph paper, electric cobalt, Newsreader-style headlines, QR/pixel patches,
  process tiles, field-note panels.
- `html-editorial-forest`: based on `editorial-forest`; forest green, dusty
  pink, oat cream, Source Serif 4, mono chrome, flat editorial color blocks.
- `html-signal`: based on `signal`; deep navy, bone paper, antique gold,
  institutional editorial weight, dark/light panel contrast.
- `html-liquid-dark`: based on HTML Anything video frames `liquid-bg-hero`,
  `logo-outro`, and `glitch-title`; near-black canvas, fluid gradient blooms,
  glass panels, cyan/purple accents, and light-on-dark caption behavior.
- `html-soft-editorial`: based on `soft-editorial`; cream paper, Cormorant
  serif, pastel swatches, translucent cards, warmer magazine rhythm.
- `swiss-blue`: hard Swiss grid, black text, strong cobalt accent. Best for
  enterprise AI, product strategy, and clean course explainers.
- `editorial-ink`: newspaper/editorial page feeling, serif headline, almost
  monochrome. Best for serious judgment, consulting, and trust-first topics.
- `magazine-cream`: warmer magazine memo style with rust accent. Best for
  founder thinking, lesson summaries, and less technical analysis.
- `xhs-morandi`: softer social-card tone with restrained rose accent and
  lighter panels. Best for Xiaohongshu 3:4 explainers that still need authority.

The route owns color, typography, panel treatment, grid opacity, label wording,
and separator behavior. `style.background`, `style.textPrimary`, and
`style.accent` remain required by the general plan schema, but this component
uses the route tokens first.

## Design Tokens

Default route:

- `html-cobalt-grid`

Core route palette:

- `html-cobalt-grid`: paper `#F0EBDE`, ink `#1F2BE0`, grid `rgba(31,43,224,0.10)`
- `html-editorial-forest`: cream `#EFE7D4`, green `#2E4A2A`, pink `#E89CB1`
- `html-signal`: navy `#1C2644`, bone `#F0ECE3`, gold `#C8A870`
- `html-liquid-dark`: near-black `#090A12`, violet `#7567FF`, mint `#35F2C5`
- `html-soft-editorial`: paper `#F2EEDF`, ink `#2A241B`, pink `#E1A4C2`, lemon `#D6DD63`
- `swiss-blue`: paper `#F7F5EE`, ink `#0A0A0A`, accent `#002FA7`
- `editorial-ink`: paper `#F4F1EA`, ink `#14120F`, accent `#14120F`
- `magazine-cream`: paper `#F6EFE3`, ink `#201C17`, accent `#C45F3B`
- `xhs-morandi`: paper `#F7EFE8`, ink `#2A2723`, accent `#B86B77`

Typography:

- display: Inter Tight / PingFang SC / Noto Sans CJK SC
- body: Inter / PingFang SC / Noto Sans CJK SC
- mono: Menlo / JetBrains Mono / ui-monospace

## Hard Constraints

- Use one accent color.
- Follow the selected route's font stack, palette, spacing rhythm, chrome, and
  component grammar. Do not import another route's visual language for one
  scene.
- Prefer an 8 px spacing rhythm for new elements. If a size is arbitrary, round
  it to the nearest 8 px unless it must align to an existing token.
- Use hairline separators and grid, not decorative vertical rails.
- Do not use rounded card-heavy layouts.
- Do not use gradient orbs, bokeh blobs, or unrelated decoration.
- Every visible block must map to content: title, support claim, signal, ledger.
- Text must fit inside its assigned area across 3:4, 16:9, and 9:16.
- Layouts must respect the active platform safe area. For 9:16, reserve top
  device chrome and bottom platform UI, and keep left/right margins symmetric by
  default. For 3:4 and 16:9, keep conservative title and caption margins rather
  than using the physical edge of the canvas.
- Safe-area previews should show base margins symmetrically. Only show a
  right-side platform rail when the user explicitly requests that profile.
- Caption layer must not cover the designed content block.
- Captions must be positioned from the safe-area profile, not from a fixed
  physical bottom offset.
- Caption color should be automatic: dark text on light backgrounds, light text
  on dark backgrounds. Use backdrop only when the background is visually busy.
- Decorative linework, arrows, maps, globes, grids, and node links must stay
  behind content or route around text. They must not cross or reduce readability
  of cards, captions, headings, or support lines.
- Persistent background motion such as globes, maps, grids, and atmospheric
  linework must use the composition/global frame timeline. It must not restart
  at each scene cut, because that creates visible jumping.
- Titles, support lines, card text, and captions must use intentional semantic
  line breaks. Do not allow any wrapped line to contain only one Chinese
  character. This is a hard failure: rewrite or shorten the copy before render.
- Title weight should be strong but not overly black; card keywords should be
  lighter than titles; labels and mono chrome should be visibly secondary.
- Do not use fake numbers, lorem ipsum, placeholder metrics, or generic labels
  like "Value 01". If a data layout has no real data, choose a non-data layout.
- If a new scene needs a structure not listed in the layout pool, extend this
  template using the same design system. Do not mix in another template's
  cards, decorations, fonts, or palette.

## Quality Checklist

- The headline is readable at phone size.
- The support claim adds meaning and does not repeat the caption.
- The signal panel highlights a real keyword from narration.
- The frame looks like a designed editorial page, not a UI dashboard.
- A 3:4 still and 16:9 still have been checked before full video render.
- For spoken-card videos, render every scene's middle frame and a contact sheet
  before full video render.
- For new aspect ratios or platform targets, also render a safe-area overlay
  contact sheet before full video render.
- Check whether the set has enough layout variety, whether lower-frame space is
  intentionally filled, and whether captions remain separate from designed
  screen copy.
- Check whether each scene uses one of the declared layout pool structures. If
  not, either revise the scene or document the new layout in this template
  before relying on it.
