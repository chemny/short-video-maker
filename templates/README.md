# Template Packages

Short Video Maker templates follow the HTML Anything pattern: a template is a
small, inspectable package, not just a Remotion component.

Each template package must include:

```text
templates/<template-id>/
  SKILL.md              # selection rules, constraints, fields, quality bar
  design-tokens.json    # palette, typography, spacing, component tokens
  example-plan.json     # minimal working video-plan example
  preview-3x4.png       # preferred still preview when available
  preview-16x9.png      # optional responsive preview
  rules.md              # optional deeper layout/component notes
```

The top-level `templates/registry.json` is the routing index. It should list
each template's tone, density, aspect support, layout pool, motion grammar, and
best/avoid use cases. The registry helps choose candidates; the selected
package's `SKILL.md` remains the source of truth.

## Package Contract

- `SKILL.md` is the source of truth for when to use the template.
- `design-tokens.json` must use named tokens instead of loose adjectives.
- `example-plan.json` must render without extra assets or private credentials.
- Previews should be generated from the example plan, not hand-designed.
- Remotion components execute the template contract; they should not invent a
  different visual language at render time.
- Each template must declare a layout pool. A layout pool is a set of named
  information structures such as `hook`, `definition`, `scenario-matrix`,
  `diagnostic`, `flow`, `signal`, `capability`, and `takeaway`.
- New layouts should be added only when they extend the selected template's own
  design system. Do not mix visual grammar from unrelated templates.

## Selection Contract

When building `video-plan.json`, first choose a template package by content
signal, tone, density, aspect ratio, and layout pool. Then shape `caption`,
`body`, `tags`, `steps`, `data`, and `visual` fields to satisfy that package.
Do not generate generic scenes and apply a skin afterwards.

Selection order:

1. read `references/template-system-rules.md`;
2. read `templates/registry.json`;
3. shortlist templates by tone, density, aspect, and best/avoid use cases;
4. read the selected package's `SKILL.md`, `design-tokens.json`, and
   `example-plan.json`;
5. generate or update the plan using that package's layout pool and constraints.

## Borrowed From HTML Anything

The useful pattern is:

- template metadata for discoverability;
- hard layout and typography constraints;
- example-driven previews;
- small package directories;
- a shared primitive vocabulary;
- quality gates that reject vague "clean / premium" styling.

The video pipeline remains Remotion-native because narration, captions, timing,
aspect ratios, and scene transitions are first-class requirements here.

## Example And Preview Gate

Every template package should have a real example and generated previews for
its supported aspect ratios. For 3:4 spoken videos, render every scene's middle
frame and a contact sheet before a full render. For new 9:16 or 16:9 work, also
render a safe-area overlay contact sheet.
