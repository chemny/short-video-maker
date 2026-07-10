# Screen Copy And Information Layout Rules

Use these rules when turning narration into visible scene text. The goal is to
make each frame understandable at a glance without turning the page into a
transcript.

## Layer Contract

For each scene, generate four layers:

| Layer | Purpose | Typical field |
|---|---|---|
| Main judgment | The one idea the viewer should remember from this frame | `caption` |
| Support line | Why it matters, what it means, or the key implication | `body` |
| Support items | Concrete examples, roles, steps, contrasts, or keywords | `tags`, `steps`, `data`, or template-specific fields |
| Visual structure | The layout that carries the support items | `layout`, `type`, template component |

Do not treat screen text as a compressed transcript. Narration gives the full
sentence-by-sentence argument; screen text gives the structure.

## Writing Rules

- Opening context gate: when the topic is a new concept, role, product,
  framework, acronym, person, company, or event, the first scene must name the
  subject clearly and give the viewer enough context before making a high-level
  judgment. Do not open with an abstract conclusion that only makes sense after
  the second scene.
- For acronym or jargon topics, the first scene should include:
  1. the exact subject name;
  2. a plain-language definition or identification;
  3. the video's main judgment or question.
- A hook can be opinionated, but it cannot be context-free. If the viewer cannot
  answer "what are we talking about?" from the first frame, rewrite the opening.
- `caption` should be a judgment, not a neutral topic label.
- `body` should answer "so what" or "why", and should not repeat `caption`.
- Support items should be concrete: roles, business actions, workflow steps,
  comparison sides, or named concepts.
- Avoid vague filler such as "change", "trend", "value", "ability", or
  "signal" unless the support line immediately makes it concrete.
- The visible text stack should make 70% of the argument understandable even if
  the viewer watches muted.
- Keep the bottom caption layer separate from screen-copy layers. Captions
  follow the voice; screen copy explains the frame.

## Layout Taxonomy

Choose the layout by scene function. Do not render every frame as
"title + list".

| Scene function | Recommended visual structure |
|---|---|
| Hook / thesis | Opening judgment page with strong title, support line, and one brief support block |
| Definition | "Not / but" contrast or field-note panel |
| Examples / real-world context | 2x2 matrix, scenario cards, or role/action grid |
| Diagnosis / questions | Three-question panel or diagnostic checklist |
| Process / abstraction | Flow conversion: input -> rule -> workflow/result |
| Evidence / market signal | Left/right contrast, before/after, or signal pair |
| Role implication | Role matrix, capability map, or action grid |
| Ending / takeaway | Triangle, loop, or three-part synthesis |

One video can use one visual language, but should still vary the internal
structure by scene function.

## Filling The Frame

Do not solve empty frames by making titles verbose. Fill the page with useful
structure:

- examples or support items;
- process arrows or node diagrams;
- comparison panels;
- role or scenario matrices;
- restrained background motion or thematic linework.

Every visual element should map to content. Decorative elements are acceptable
only when they remain behind the content and do not cross, cover, or compete
with text.

## Title Breaking

- Prefer intentional semantic line breaks over automatic wrapping.
- If a Chinese title is too wide, split at punctuation or semantic boundaries.
- Do not allow a single trailing Chinese character to sit alone on a final
  line. This is a failed preview, not an acceptable visual compromise.
- When a title creates a one-character final line, fix it in this order:
  shorten/rewrite the title, add an intentional semantic break, then reduce font
  size only if the shorter wording weakens the meaning.
- Apply the same rule to support lines, card body text, labels, and captions:
  no wrapped line may contain only one Chinese character. If it happens,
  rewrite the visible copy before render.
- Shorten copy before shrinking type below mobile-safe sizes.

## Typography Hierarchy

- Main title: strong but not overly black; prefer one step lighter than poster
  weight for information videos.
- Card keywords: one step lighter than the title.
- Support line: medium weight, readable but visually secondary.
- Labels, scene numbers, and mono tags: small and restrained; they should not
  compete with the main judgment.
- Bottom captions: readability wins; keep them large enough for mobile even if
  other type is refined.

## Preview Gate

Before a full render, create stills from the middle of each scene and a contact
sheet. Review:

- whether the frame can be understood at a glance;
- whether scene layouts repeat too much;
- whether the lower half is unintentionally empty;
- whether text wraps cleanly;
- whether linework, arrows, charts, or decorative elements cross text;
- whether captions remain readable and do not cover designed content.

Fix the stills before rendering the full video.
