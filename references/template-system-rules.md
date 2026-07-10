# Template System Rules

Use these rules before selecting, extending, or creating a visual template. The
goal is to borrow HTML Anything's template discipline without turning the video
pipeline into a generic HTML deck generator.

## Core Principle

A template is a closed design system, not a color skin.

Each template should define:

- when to use it and when to avoid it;
- the supported aspect ratios;
- a layout pool tied to scene functions;
- typography, color, spacing, chrome, and motion rules;
- required scene fields and graceful fallbacks;
- example previews that show the intended output.

Do not mix visual grammar from multiple templates in one scene. If a scene needs
a layout that the selected template does not have, extend the selected template
using its own fonts, palette, spacing rhythm, chrome, and component grammar.

## Registry Contract

Read `templates/registry.json` before choosing a template. Use its fields as the
first-pass selector:

| Field | Purpose |
|---|---|
| `tone` | What the video should feel like |
| `density` | How much information the template can hold per scene |
| `primaryAspect` | The aspect ratio that should be polished first |
| `responsiveAspects` | Aspect ratios the template may support with adaptation |
| `layoutPool` | Named scene structures the template promises |
| `motionGrammar` | Allowed motion vocabulary |
| `bestFor` / `avoidFor` | Taste and use-case boundaries |

The registry does not replace a template package's `SKILL.md`. It is a routing
index. After selecting a candidate, read that package's `SKILL.md`,
`design-tokens.json`, and example plan before writing `video-plan.json`.

## Layout Pool Rules

Each professional spoken-video template should define at least six layouts. A
layout is not a CSS class name; it is an information structure.

Recommended baseline pool:

- `hook`: subject, context, and main judgment;
- `definition`: not/but, field note, or plain-language definition;
- `scenario-matrix`: concrete roles, examples, or business actions;
- `diagnostic`: question list, checklist, or decision criteria;
- `flow`: input -> abstraction -> workflow/result;
- `signal`: market or behavior contrast;
- `capability`: role/capability map;
- `takeaway`: synthesis, loop, triangle, or final thesis.

Use the layout that matches the scene function. Do not assign every scene to
the same title-plus-list frame.

## Example-First Rule

Every template package should include a real example plan and generated
previews. A good example uses realistic content, not placeholder text.

Minimum expected examples:

- `example-plan.json`;
- one 3:4 contact sheet for the primary layout pool when the template supports
  3:4;
- optional 16:9 and 9:16 contact sheets when those formats are supported.

Generated previews are regression references. If a change makes a template look
worse against its own example, fix the template before using it for a job.

## Hard Visual Constraints

Write constraints as concrete values or measurable rules:

- font stack, allowed weights, and approximate size scale;
- spacing rhythm, preferably based on an 8 px grid;
- maximum line count and orphan-line rules;
- palette ownership and accent count;
- border radius and shadow rules;
- chrome position and optionality;
- caption safe area and readability rules;
- motion timing and whether motion is global or scene-local.

Avoid vague guidance such as "premium", "modern", "clean", or "beautiful"
unless it is backed by concrete rules.

## Video-Specific Differences From HTML Decks

Videos have constraints that decks do not:

- narration audio is the master timeline;
- captions must remain readable and separate from designed screen copy;
- scene transitions and persistent background motion must not jump;
- 9:16, 3:4, and 16:9 need separate safe-area checks;
- a frame may be on screen for only a few seconds, so information hierarchy
  must be more aggressive than in a deck.

Borrow the template governance, not the whole deck runtime.

## Reject Conditions

Reject or revise a template output when:

- the first frame does not name a new concept, acronym, person, product, or
  event clearly enough;
- scene layouts repeat without a content reason;
- visible copy wraps into a one-character Chinese line;
- decorative lines, diagrams, or motion elements cross text;
- captions cover designed content;
- the lower half is unintentionally empty;
- the design introduces a new palette or component grammar inside a closed
  template system;
- fake data, lorem ipsum, or invented metrics appear.
