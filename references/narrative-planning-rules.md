# Narrative Planning Rules

Use these rules before writing `video-plan.json`. They adapt the strongest
content discipline from `guizang-ppt-skill` to spoken short videos.

## Layer Boundary

This file owns the content generation layer: what the video says, in what
order, and what each scene is trying to do.

It does not own:

- visual template routing; see `references/template-system-rules.md`;
- Remotion rendering, captions, TTS, timing, or safe areas; those remain the
  responsibility of the video production pipeline.

Stable principle:

```text
guizang-style narrative planning -> HTML Anything-style template governance -> short-video-maker video production
```

## Do Not Jump From Topic To Video Plan

When the user provides only a topic, one sentence, rough opinion, or short
prompt, do not directly generate scenes. First expand the input into a narrative
brief and a scene plan.

Recommended path:

```text
Input -> Narrative Brief -> Narrative Arc -> Scene Plan -> Template Selection -> Video Plan
```

If the user has already provided a complete spoken script, skip broad
clarification and extract the narrative arc from the script. Still create a
scene plan before building `video-plan.json`.

## Clarification Gate

Ask only when missing information materially changes the video. In Codex, ask
at most 1-3 key questions at a time.

Highest-impact questions:

1. Who is this for, and where will it be watched?
2. Is this a course/consulting explainer, product/technical analysis, personal
   opinion, or social hook?
3. Are there required materials, data, screenshots, claims, or forbidden points?

If answers are missing but the work can proceed, make conservative assumptions
and state them in the plan.

## Narrative Brief

Before scene planning, identify:

- `subject`: the exact topic, concept, role, product, person, company, or event;
- `audience`: who needs to understand it;
- `occasion`: why the video exists;
- `thesis`: the one judgment the video argues for;
- `context_gap`: what the viewer must know before the thesis makes sense;
- `proof_shape`: examples, contrast, workflow, data, case, or analogy;
- `takeaway`: what the viewer should remember or do.

For acronyms, jargon, new roles, or new products, the opening must pass the
context gate: name the subject, identify it plainly, then state the thesis.

## Narrative Arc

Use this default arc for a 60-130 second spoken video:

| Arc | Typical scenes | Function |
|---|---:|---|
| Hook | 1 | Name the subject and create a reason to keep watching |
| Context | 1-2 | Explain why this matters now |
| Core | 3-5 | Develop the main argument through examples, contrast, process, or evidence |
| Shift | 1 | Reframe the issue or challenge the obvious interpretation |
| Takeaway | 1-2 | State the final judgment, implication, or action |

The arc is not a fixed page count. It is a thinking scaffold. Merge or split
scenes based on audio length, information density, and visual readability.

## Scene Plan Table

Before writing `video-plan.json`, create or mentally satisfy this table:

| Field | Meaning |
|---|---|
| `scene` | Scene number and approximate timing |
| `arc_role` | Hook, Context, Core, Shift, or Takeaway |
| `narrative_action` | The one thing this scene does |
| `content_shape` | statement, definition, contrast, examples, diagnostic, flow, signal, capability, data, case, image evidence |
| `recommended_layout` | The template layout that matches the content shape |
| `screen_copy` | caption, body, tags/steps/data |
| `visual_slot` | none, background motion, diagram, screenshot, case image, chart, or evidence image |
| `motion_role` | reveal, compare, flow, highlight, loop, or static |

Do not skip the scene plan when the topic is complex or the user is unhappy
with content clarity.

## One Scene, One Narrative Action

Each scene should do one clear thing:

- define a concept;
- contrast two interpretations;
- show concrete examples;
- ask diagnostic questions;
- convert messy inputs into a workflow;
- show a market signal;
- explain role implications;
- deliver a takeaway.

Do not make one scene both define the topic, list examples, explain a process,
and state the final takeaway. Split scenes instead.

## Content Shape Must Match Layout

Choose layout from content shape, not aesthetics:

| Content shape | Good layout direction | Avoid |
|---|---|---|
| New concept or acronym | definition / not-but / field-note | abstract thesis without context |
| Concrete examples | scenario matrix / role-action grid | one huge paragraph |
| Diagnostic questions | checklist / question stack | decorative cards |
| Process or abstraction | input -> rule -> workflow | unrelated image filler |
| Before/after or old/new | compare / signal pair | data chart without data |
| Capability implication | capability map / role matrix | generic motivational quote |
| Real data | chart / KPI / data layout | invented metrics |
| No real data | qualitative statement / examples / flow | fake percentages or rankings |
| Visual evidence | screenshot, case image, system diagram | decorative stock image |

If the selected layout needs fields the scene does not have, revise the scene
or choose another layout. Do not invent data or add decoration to fill space.

## Screen Copy Rules

- `caption` is the main judgment, not a transcript line.
- `body` explains why the judgment matters.
- `tags`, `steps`, and `data` are concrete support items.
- Keep titles short. Rewrite long titles before shrinking type.
- Avoid one-character Chinese orphan lines in titles, support lines, card text,
  and captions.
- If content does not fit, delete, split, or change layout. Do not shrink text
  below mobile-safe sizes.

## Chrome, Label, And Tag Separation

Avoid repeated AI-looking metadata.

- Persistent chrome = series, topic family, or scene number.
- Scene label = the function of the current scene.
- Kicker or tag = a short local hook for this scene.
- Headline = the main judgment.

Do not repeat the same phrase across chrome, tag, headline, and body.

Bad:

```text
Chrome: AI Workflow
Tag: AI 工作流
Headline: AI 工作流是什么
Body: 这一页讲 AI 工作流
```

Better:

```text
Chrome: FDE / Enterprise AI
Tag: 进入现场
Headline: FDE 不是卖软件
Body: 它的位置更接近业务现场的 AI 落地角色
```

## Images And Diagrams

Images must serve the argument:

- case evidence;
- product or UI screenshot;
- system diagram;
- concept infographic;
- real-world scene that anchors the claim.

Do not add images only because the lower half feels empty. If a visual element
does not carry meaning, prefer background motion, layout spacing, or a simpler
scene.

## Reject Conditions

Revise the narrative plan when:

- the first scene does not identify the subject clearly;
- a scene has more than one narrative action;
- a data layout is chosen without real data;
- a visual slot is filled with decorative or generic imagery;
- the same scene structure repeats without a content reason;
- chrome, tag, headline, and body repeat the same idea;
- content overflow is solved by tiny text instead of splitting or rewriting.
