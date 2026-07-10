#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planPath = path.resolve(root, process.argv[2] ?? 'jobs/fde-ai-workflow-spoken-dark/video-plan.json');
const outputDir = path.resolve(
  root,
  process.argv[3] ?? path.join(path.dirname(planPath), 'output', 'html-style-variants'),
);
const tokenPath = path.join(root, 'templates', 'editorial-brief', 'design-tokens.json');

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const routes = tokens.routes;
const routeIds = Object.keys(routes);

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const slug = (value) => String(value).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();

const normalizeRoute = (id, route) => {
  const palette = route.palette ?? {};
  const components = route.components ?? {};

  if (id === 'html-liquid-dark') {
    return {
      bg: palette.black,
      bg2: palette.navy,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.mint,
      accent2: palette.violet,
      panel: 'rgba(255,255,255,0.085)',
      panel2: 'rgba(53,242,197,0.13)',
      line: palette.hairline,
      grid: 'rgba(255,255,255,0.045)',
      radius: 12,
      shadow: '0 28px 90px rgba(0,0,0,0.42)',
      dark: true,
      mode: 'liquid',
      label: route.name,
      components,
    };
  }

  if (id === 'html-cobalt-grid') {
    return {
      bg: palette.paper,
      bg2: palette.paper2,
      ink: palette.ink,
      muted: palette.inkSoft,
      accent: palette.ink,
      accent2: palette.paper,
      panel: palette.paper,
      panel2: palette.paper2,
      line: palette.hairline,
      grid: palette.grid,
      radius: 0,
      shadow: '12px 12px 0 rgba(31,43,224,0.18)',
      dark: false,
      mode: 'cobalt',
      label: route.name,
      components,
    };
  }

  if (id === 'html-editorial-forest') {
    return {
      bg: palette.cream,
      bg2: palette.cream2,
      ink: palette.ink,
      muted: palette.green,
      accent: palette.green,
      accent2: palette.pink,
      panel: palette.green,
      panel2: palette.pink,
      line: palette.green,
      grid: 'rgba(46,74,42,0.075)',
      radius: 8,
      shadow: 'none',
      dark: false,
      mode: 'forest',
      label: route.name,
      components,
    };
  }

  if (id === 'html-signal') {
    return {
      bg: palette.navy,
      bg2: palette.navyAlt,
      ink: palette.creamText,
      muted: '#B7C0CE',
      accent: palette.gold,
      accent2: palette.bone,
      panel: 'rgba(240,236,227,0.10)',
      panel2: palette.bone,
      line: 'rgba(240,236,227,0.18)',
      grid: 'rgba(226,220,208,0.05)',
      radius: 0,
      shadow: '0 24px 70px rgba(0,0,0,0.28)',
      dark: true,
      mode: 'signal',
      label: route.name,
      components,
    };
  }

  if (id === 'html-soft-editorial') {
    return {
      bg: palette.paper,
      bg2: palette.paper2,
      ink: palette.ink,
      muted: '#5C5345',
      accent: palette.pink,
      accent2: palette.lemon,
      panel: 'rgba(255,255,255,0.62)',
      panel2: palette.sage,
      line: 'rgba(42,36,27,0.20)',
      grid: 'rgba(42,36,27,0.045)',
      radius: 30,
      shadow: '0 28px 80px rgba(70,58,38,0.12)',
      dark: false,
      mode: 'soft',
      label: route.name,
      components,
    };
  }

  if (id === 'html-broadside') {
    return {
      bg: palette.bg,
      bg2: palette.bgAlt,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.ink,
      panel: palette.bgAlt,
      panel2: palette.accent,
      line: palette.line,
      grid: 'rgba(240,236,229,0.045)',
      radius: 0,
      shadow: 'none',
      dark: true,
      mode: 'broadside',
      label: route.name,
      components,
    };
  }

  if (id === 'html-emerald-editorial') {
    return {
      bg: palette.emerald,
      bg2: palette.emerald2,
      ink: palette.ink,
      muted: palette.inkSoft,
      accent: palette.paper,
      accent2: palette.ink,
      panel: palette.paper,
      panel2: palette.emerald2,
      line: palette.line,
      grid: 'rgba(15,26,92,0.10)',
      radius: 0,
      shadow: 'none',
      dark: false,
      mode: 'emerald',
      label: route.name,
      components,
    };
  }

  if (id === 'html-neo-grid-bold') {
    return {
      bg: palette.bg,
      bg2: palette.paper,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.ink,
      panel: palette.paper,
      panel2: palette.accent,
      line: palette.line,
      grid: 'rgba(10,10,10,0.09)',
      radius: 0,
      shadow: '8px 8px 0 #0A0A0A',
      dark: false,
      mode: 'neo-grid',
      label: route.name,
      components,
    };
  }

  if (id === 'html-monochrome') {
    return {
      bg: palette.paper,
      bg2: palette.paper2,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.ink,
      accent2: palette.cream,
      panel: palette.cream,
      panel2: palette.paper2,
      line: palette.line,
      grid: 'rgba(26,26,22,0.075)',
      radius: 0,
      shadow: 'none',
      dark: false,
      mode: 'monochrome',
      label: route.name,
      components,
    };
  }

  if (id === 'html-vellum') {
    return {
      bg: palette.bg,
      bg2: palette.bgAlt,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.ink,
      panel: 'rgba(255,255,255,0.08)',
      panel2: 'rgba(58,120,120,0.26)',
      line: palette.line,
      grid: 'rgba(232,216,92,0.055)',
      radius: 0,
      shadow: 'none',
      dark: true,
      mode: 'vellum',
      label: route.name,
      components,
    };
  }

  if (id === 'html-blue-professional') {
    return {
      bg: palette.paper,
      bg2: palette.paper,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.paper,
      panel: palette.surface,
      panel2: 'rgba(30,43,250,0.08)',
      line: palette.line,
      grid: 'rgba(30,43,250,0.065)',
      radius: 14,
      shadow: '0 18px 58px rgba(30,43,250,0.10)',
      dark: false,
      mode: 'blue-professional',
      label: route.name,
      components,
    };
  }

  if (id === 'html-cartesian') {
    return {
      bg: palette.paper,
      bg2: palette.paper2,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.ink,
      panel: 'rgba(255,255,255,0.24)',
      panel2: palette.paper2,
      line: palette.line,
      grid: 'rgba(184,176,164,0.18)',
      radius: 0,
      shadow: 'none',
      dark: false,
      mode: 'cartesian',
      label: route.name,
      components,
    };
  }

  if (id === 'html-grove') {
    return {
      bg: palette.bg,
      bg2: palette.bgAlt,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.ink,
      panel: 'rgba(212,207,191,0.07)',
      panel2: 'rgba(200,82,74,0.12)',
      line: palette.line,
      grid: 'rgba(212,207,191,0.045)',
      radius: 0,
      shadow: 'none',
      dark: true,
      mode: 'grove',
      label: route.name,
      components,
    };
  }

  if (id === 'html-raw-grid') {
    return {
      bg: palette.paper,
      bg2: palette.gray,
      ink: palette.ink,
      muted: '#333333',
      accent: palette.pink,
      accent2: palette.green,
      panel: palette.paper,
      panel2: palette.green,
      line: palette.line,
      grid: 'rgba(10,10,10,0.07)',
      radius: 0,
      shadow: '6px 6px 0 #0A0A0A',
      dark: false,
      mode: 'raw-grid',
      label: route.name,
      components,
    };
  }

  if (id.startsWith('fde-')) {
    return {
      bg: palette.bg,
      bg2: palette.card,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      accent2: palette.accent2,
      panel: palette.soft,
      panel2: palette.card,
      line: palette.line,
      grid: 'rgba(255,255,255,0.055)',
      radius: id === 'fde-build-minimal' || id === 'fde-bold-poster' || id === 'fde-nyt-data' ? 0 : 26,
      shadow: id === 'fde-build-minimal' ? 'none' : '0 34px 100px rgba(0,0,0,0.22)',
      dark: ['fde-business-grid', 'fde-glitch-title', 'fde-light-leak', 'fde-liquid-hero', 'fde-logo-outro', 'fde-vfx-cursor', 'fde-bold-signal', 'fde-creative-voltage'].includes(id),
      mode: id,
      label: route.name,
      components,
    };
  }

  return {
    bg: palette.paper,
    bg2: palette.surface,
    ink: palette.ink,
    muted: palette.muted,
    accent: palette.accent,
    accent2: palette.surface,
    panel: palette.surface,
    panel2: palette.paper,
    line: palette.hairline,
    grid: palette.hairline,
    radius: components.panelRadius ?? 0,
    shadow:
      components.panelShadow === 'soft paper lift'
        ? '0 22px 70px rgba(50,40,30,0.13)'
        : components.panelShadow === 'warm hard offset'
          ? '12px 12px 0 rgba(196,95,59,0.18)'
          : components.panelShadow === 'hard offset'
            ? '12px 12px 0 rgba(0,47,167,0.16)'
            : 'none',
    dark: false,
    mode: id,
    label: route.name,
    components,
  };
};

const frames = plan.scenes.map((scene, index) => ({
  ...scene,
  index,
  label:
    scene.type === 'hook'
      ? '开场判断'
      : scene.type === 'definition'
        ? '定义边界'
        : scene.type === 'example'
          ? '业务现场'
          : scene.type === 'thesis'
            ? '核心判断'
            : scene.type === 'ending'
              ? '收束'
              : '分析',
}));

const renderPixels = () =>
  Array.from({length: 49})
    .map(
      (_, index) =>
        `<i style="background:${[2, 3, 4, 9, 16, 23, 24, 25, 31, 37, 43, 44, 45].includes(index) ? 'currentColor' : 'transparent'}"></i>`,
    )
    .join('');

const renderGlobe = () => `
  <svg class="globe" viewBox="0 0 360 360" aria-hidden="true">
    <defs>
      <radialGradient id="fade" cx="50%" cy="50%" r="54%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.95"/>
        <stop offset="70%" stop-color="#fff" stop-opacity="0.64"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <mask id="globeMask"><rect width="360" height="360" fill="url(#fade)"/></mask>
      <clipPath id="clip"><circle cx="180" cy="180" r="132"/></clipPath>
    </defs>
    <g mask="url(#globeMask)" clip-path="url(#clip)">
      <circle cx="180" cy="180" r="132" fill="none"/>
      ${[-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75]
        .map((lng) => {
          const rx = Math.max(8, Math.cos((Math.abs(lng) * Math.PI) / 180) * 132);
          return `<ellipse cx="180" cy="180" rx="${rx.toFixed(2)}" ry="132" fill="none"/>`;
        })
        .join('')}
      ${[-60, -45, -30, -15, 0, 15, 30, 45, 60]
        .map((lat) => {
          const radians = (lat * Math.PI) / 180;
          const y = 180 + Math.sin(radians) * 132;
          const rx = Math.cos(radians) * 132;
          const ry = Math.max(3, Math.cos(radians) * 18);
          return `<ellipse cx="180" cy="${y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="none"/>`;
        })
        .join('')}
    </g>
  </svg>
`;

const renderTags = (scene) =>
  (scene.tags ?? [])
    .slice(0, 4)
    .map((tag) => `<span>${esc(typeof tag === 'string' ? tag : tag.text)}</span>`)
    .join('');

const renderFrame = (frame, style) => {
  const typeClass =
    frame.layout === 'step-list' ? 'process' : frame.layout === 'quote-card' ? 'quote' : frame.layout === 'data-card' ? 'stat' : 'statement';
  const tags = renderTags(frame);
  const body = frame.body || frame.voiceover;

  return `
    <section class="frame ${typeClass}">
      <div class="topline">
        <span>FDE / AI WORKFLOW</span>
        <span>${String(frame.index + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}</span>
      </div>
      <div class="pill"><b>${String(frame.index + 1).padStart(2, '0')}</b>${esc(frame.label)}</div>
      <h1>${esc(frame.caption)}</h1>
      <p class="lead">${esc(body)}</p>
      ${
        frame.layout === 'step-list'
          ? `<div class="tiles">${(frame.tags ?? [])
              .slice(0, 4)
              .map((tag, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b><strong>${esc(typeof tag === 'string' ? tag : tag.text)}</strong></div>`)
              .join('')}</div>`
          : `<blockquote>${esc(frame.voiceover)}</blockquote>`
      }
      <div class="tags">${tags}</div>
      ${style.mode === 'liquid' ? renderGlobe() : ''}
      <div class="pixels">${renderPixels()}</div>
    </section>
  `;
};

const renderPage = (routeId, route) => {
  const style = normalizeRoute(routeId, route);
  const coverTitle = plan.cover.title;
  const cssVars = Object.entries({
    '--bg': style.bg,
    '--bg2': style.bg2,
    '--ink': style.ink,
    '--muted': style.muted,
    '--accent': style.accent,
    '--accent2': style.accent2,
    '--panel': style.panel,
    '--panel2': style.panel2,
    '--line': style.line,
    '--grid': style.grid,
    '--radius': `${style.radius}px`,
    '--shadow': style.shadow,
  })
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

  return `<!doctype html>
<html lang="zh-CN" style="${cssVars}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(route.name)} - ${esc(plan.meta.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #111;
      color: var(--ink);
      font-family: Inter, "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
    }
    .deck {
      min-height: 100vh;
      padding: 32px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      background: #151515;
    }
    .frame {
      aspect-ratio: 3 / 4;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(720px 520px at 16% 12%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 62%),
        radial-gradient(620px 500px at 82% 18%, color-mix(in srgb, var(--accent2) 22%, transparent), transparent 64%),
        linear-gradient(180deg, var(--bg), var(--bg2));
      padding: 56px;
      box-shadow: 0 20px 70px rgba(0,0,0,0.34);
      isolation: isolate;
    }
    .frame::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
      background-size: 42px 42px;
      opacity: .9;
      z-index: -2;
    }
    .frame::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--bg) 74%, transparent) 100%);
      z-index: -1;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      color: var(--muted);
      font-family: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      min-height: 22px;
      margin-bottom: 34px;
    }
    .pill {
      width: fit-content;
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel) 78%, transparent);
      color: var(--ink);
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 26px;
      box-shadow: var(--shadow);
    }
    .pill b {
      color: var(--accent);
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 12px;
    }
    h1 {
      margin: 0;
      max-width: 760px;
      color: var(--ink);
      font-family: "Inter Tight", "Noto Sans SC", system-ui, sans-serif;
      font-size: clamp(44px, 7vw, 76px);
      line-height: 1.04;
      font-weight: 780;
      letter-spacing: 0;
    }
    .lead {
      max-width: 760px;
      margin: 26px 0 0;
      color: var(--muted);
      font-size: 25px;
      line-height: 1.35;
      font-weight: 680;
    }
    blockquote {
      margin: 44px 0 0;
      padding: 28px 30px;
      max-width: 780px;
      border-left: 4px solid var(--accent);
      background: color-mix(in srgb, var(--panel) 76%, transparent);
      color: var(--ink);
      font-size: 25px;
      line-height: 1.44;
      font-weight: 760;
      border-radius: var(--radius);
    }
    .tiles {
      margin-top: 44px;
      display: grid;
      gap: 14px;
    }
    .tiles div {
      display: flex;
      align-items: center;
      gap: 18px;
      min-height: 70px;
      padding: 0 20px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--panel) 72%, transparent);
      box-shadow: var(--shadow);
    }
    .tiles b {
      color: var(--accent);
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 14px;
    }
    .tiles strong {
      font-size: 24px;
      line-height: 1.12;
    }
    .tags {
      position: absolute;
      left: 56px;
      right: 56px;
      bottom: 54px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      z-index: 2;
    }
    .tags span {
      padding: 9px 13px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel) 78%, transparent);
      color: var(--ink);
      font-size: 14px;
      font-weight: 800;
    }
    .pixels {
      position: absolute;
      right: 40px;
      top: 40px;
      width: 126px;
      height: 126px;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 5px;
      color: var(--accent);
      opacity: .22;
      z-index: 1;
    }
    .pixels i { display: block; }
    .globe {
      position: absolute;
      right: -390px;
      bottom: -500px;
      width: 1060px;
      height: 1060px;
      opacity: .28;
      stroke: var(--accent);
      stroke-width: .35;
      fill: none;
      z-index: 0;
    }
    .cover h1 {
      font-size: clamp(64px, 9vw, 104px);
      max-width: 850px;
    }
    .cover .lead {
      color: var(--accent);
      font-size: 34px;
      font-weight: 820;
    }
    .html-cobalt-grid .frame { font-family: "Hanken Grotesk", "Noto Sans SC", system-ui, sans-serif; }
    .html-cobalt-grid h1 { font-family: Newsreader, "Noto Serif SC", Georgia, serif; font-weight: 760; }
    .html-editorial-forest .frame { font-family: "Source Serif 4", "Noto Serif SC", Georgia, serif; }
    .html-editorial-forest .pill, .html-editorial-forest .tiles div, .html-editorial-forest blockquote { border-radius: 8px; }
    .html-signal .frame { background: linear-gradient(180deg, var(--bg), var(--bg2)); }
    .html-signal h1 { font-family: "Source Serif 4", "Noto Serif SC", Georgia, serif; font-weight: 760; }
    .html-liquid-dark .frame::before { background-size: 64px 64px; opacity: .42; }
    .html-liquid-dark .pill { box-shadow: 0 0 30px color-mix(in srgb, var(--accent2) 22%, transparent); }
    .html-soft-editorial h1 { font-family: "Cormorant Garamond", "Noto Serif SC", Garamond, serif; font-weight: 760; }
    .html-broadside .frame { font-family: Barlow, "Noto Sans SC", system-ui, sans-serif; }
    .html-broadside h1 { font-family: Barlow, "Noto Sans SC", system-ui, sans-serif; font-weight: 900; text-transform: uppercase; line-height: .9; }
    .html-broadside .pill, .html-broadside .tiles div, .html-broadside blockquote, .html-broadside .tags span { border-radius: 0; }
    .html-broadside blockquote { border-left-width: 0; border-top: 2px solid var(--accent); }
    .html-emerald-editorial .frame { font-family: Manrope, "Noto Sans SC", system-ui, sans-serif; }
    .html-emerald-editorial h1 { font-family: "Bodoni Moda", "Noto Serif SC", Georgia, serif; font-weight: 900; line-height: .92; }
    .html-emerald-editorial .pill::before, .html-emerald-editorial .pill::after { content: ""; width: 42px; height: 4px; background: var(--ink); display: inline-block; }
    .html-neo-grid-bold .frame { font-family: "Space Grotesk", "Noto Sans SC", system-ui, sans-serif; }
    .html-neo-grid-bold h1 { font-family: "Space Grotesk", "Noto Sans SC", system-ui, sans-serif; font-weight: 900; text-transform: uppercase; line-height: .95; }
    .html-neo-grid-bold .pill, .html-neo-grid-bold .tiles div, .html-neo-grid-bold blockquote, .html-neo-grid-bold .tags span { border: 2px solid var(--line); border-radius: 0; }
    .html-monochrome .frame { font-family: Jost, "Noto Sans SC", system-ui, sans-serif; }
    .html-monochrome h1 { font-family: Jost, "Noto Sans SC", system-ui, sans-serif; font-weight: 500; line-height: 1.05; }
    .html-monochrome blockquote { background: transparent; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); border-left: 0; }
    .html-vellum .frame { font-family: "DM Sans", "Noto Sans SC", system-ui, sans-serif; }
    .html-vellum h1 { font-family: "Cormorant Garamond", "Noto Serif SC", Georgia, serif; font-weight: 600; line-height: 1.0; }
    .html-vellum blockquote { font-family: "Cormorant Garamond", "Noto Serif SC", Georgia, serif; font-size: 30px; font-weight: 600; }
    .html-blue-professional .frame { font-family: Inter, "Noto Sans SC", system-ui, sans-serif; }
    .html-blue-professional h1 { font-family: "Space Grotesk", "Noto Sans SC", system-ui, sans-serif; font-weight: 760; color: var(--accent); }
    .html-blue-professional .pill, .html-blue-professional .tiles div, .html-blue-professional blockquote, .html-blue-professional .tags span { border-width: 1.5px; }
    .html-cartesian .frame { font-family: Inter, "Noto Sans SC", system-ui, sans-serif; }
    .html-cartesian h1 { font-family: "Playfair Display", "Noto Serif SC", Georgia, serif; font-weight: 500; line-height: 1.08; }
    .html-cartesian .frame::after { background: radial-gradient(circle at 76% 28%, transparent 0 120px, var(--line) 121px 122px, transparent 123px), linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--bg) 64%, transparent) 100%); }
    .html-grove .frame { font-family: Jost, "Noto Sans SC", system-ui, sans-serif; }
    .html-grove h1 { font-family: "Playfair Display", "Noto Serif SC", Georgia, serif; font-weight: 500; line-height: 1.08; }
    .html-grove .lead { font-weight: 360; }
    .html-raw-grid .frame { font-family: "Segoe UI", "Noto Sans SC", system-ui, sans-serif; }
    .html-raw-grid h1 { font-family: "Segoe UI", "Noto Sans SC", system-ui, sans-serif; font-weight: 900; text-transform: uppercase; line-height: 1.02; }
    .html-raw-grid .pill, .html-raw-grid .tiles div, .html-raw-grid blockquote, .html-raw-grid .tags span { border: 3px solid var(--line); border-radius: 0; }
    .fde-business-grid .frame { background: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px), radial-gradient(circle at 12% 12%, rgba(67,213,255,.24), transparent 30%), var(--bg2); background-size: 72px 72px, 72px 72px, auto, auto; }
    .fde-bold-poster h1 { font-family: Impact, "Arial Black", "Noto Sans SC", sans-serif; font-weight: 900; text-transform: uppercase; }
    .fde-bold-poster .pill { border-radius: 0; background: var(--accent); color: #fff; }
    .fde-nyt-data .frame { background-image: linear-gradient(rgba(0,0,0,.055) 1px, transparent 1px); background-size: 100% 96px; }
    .fde-nyt-data h1 { font-family: Georgia, "Times New Roman", "Noto Serif SC", serif; font-weight: 760; }
    .fde-nyt-data .pill { border-radius: 0; background: transparent; border-width: 1px 0; }
    .fde-glitch-title .frame { background: repeating-linear-gradient(0deg, rgba(255,255,255,.05), rgba(255,255,255,.05) 1px, transparent 1px, transparent 7px), radial-gradient(circle at 72% 20%, rgba(255,45,140,.24), transparent 28%), var(--bg2); }
    .fde-glitch-title h1 { text-shadow: 5px 0 var(--accent2), -5px 0 var(--accent); }
    .fde-light-leak .frame { background: radial-gradient(circle at 12% 18%, rgba(238,128,62,.45), transparent 32%), radial-gradient(circle at 86% 78%, rgba(247,230,199,.18), transparent 28%), var(--bg2); }
    .fde-liquid-hero .frame { background: radial-gradient(circle at 20% 25%, rgba(117,93,255,.40), transparent 34%), radial-gradient(circle at 78% 28%, rgba(61,221,192,.34), transparent 30%), radial-gradient(circle at 56% 88%, rgba(255,109,36,.22), transparent 28%), var(--bg2); }
    .fde-liquid-hero h1, .fde-liquid-hero .lead { text-align: center; margin-left: auto; margin-right: auto; }
    .fde-logo-outro h1, .fde-logo-outro .lead { text-align: center; margin-left: auto; margin-right: auto; }
    .fde-logo-outro .frame::after { background: transparent; border: 3px solid rgba(81,113,255,.32); border-radius: 50%; right: 12%; bottom: 16%; }
    .fde-vfx-cursor .frame, .fde-vfx-cursor h1, .fde-vfx-cursor .lead { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans SC", monospace; }
    .fde-vfx-cursor .pill::before { content: "$ "; }
    .fde-vfx-cursor h1::after { content: "_"; color: var(--accent); }
    .fde-pentagram-stat .frame { background: linear-gradient(90deg, rgba(221,30,43,.15) 1px, transparent 1px), linear-gradient(rgba(221,30,43,.12) 1px, transparent 1px), var(--bg2); background-size: 90px 90px; }
    .fde-pentagram-stat .topline span:last-child { font-size: 48px; color: var(--accent); }
    .fde-electric-studio .frame { background: linear-gradient(110deg, var(--bg) 0 58%, var(--accent) 58% 100%); }
    .fde-bold-signal .pill, .fde-bold-signal .tiles div:first-child { color: #fff; background: var(--accent); }
    .fde-build-minimal .frame::before { inset: 64px; }
    .fde-build-minimal h1 { font-family: Georgia, "Times New Roman", "Noto Serif SC", serif; font-weight: 650; }
    .fde-build-minimal .pill { background: transparent; border-width: 0 0 1px 0; border-radius: 0; padding-left: 0; }
    .fde-creative-voltage .frame { background: linear-gradient(105deg, var(--accent) 0 34%, var(--bg) 34% 100%); }
    .fde-creative-voltage h1 { transform: rotate(-1.2deg); }
    .fde-takram-organic .frame { background: radial-gradient(circle at 22% 18%, rgba(180,103,83,.18), transparent 30%), radial-gradient(circle at 78% 30%, rgba(101,141,119,.22), transparent 34%), var(--bg2); }
    .fde-takram-organic .frame::after { right: 10%; bottom: 14%; width: 360px; height: 360px; background: rgba(101,141,119,.12); border-radius: 42% 58% 61% 39%; }
    .swiss-blue .frame, .editorial-ink .frame, .magazine-cream .frame, .xhs-morandi .frame { background: var(--bg); }
    .swiss-blue .frame::before, .editorial-ink .frame::before, .magazine-cream .frame::before, .xhs-morandi .frame::before { opacity: .55; }
    .xhs-morandi .pill, .xhs-morandi .tiles div, .xhs-morandi blockquote { border-radius: 18px; }
  </style>
</head>
<body class="${routeId}">
  <main class="deck">
    <section class="frame cover">
      <div class="topline"><span>${esc(style.label)}</span><span>3:4 PREVIEW</span></div>
      <div class="pill"><b>00</b>${esc(plan.cover.label ?? plan.meta.topic)}</div>
      <p class="lead">${esc(plan.cover.subtitle ?? plan.meta.subtitle)}</p>
      <h1>${esc(coverTitle)}</h1>
      ${style.mode === 'liquid' ? renderGlobe() : ''}
      <div class="pixels">${renderPixels()}</div>
      <div class="tags"><span>${esc(plan.meta.topic)}</span><span>${esc(routeId)}</span></div>
    </section>
    ${frames.map((frame) => renderFrame(frame, style)).join('\n')}
  </main>
</body>
</html>
`;
};

fs.rmSync(outputDir, {recursive: true, force: true});
fs.mkdirSync(outputDir, {recursive: true});

const indexItems = [];
for (const routeId of routeIds) {
  const route = routes[routeId];
  const dir = path.join(outputDir, slug(routeId));
  fs.mkdirSync(dir, {recursive: true});
  const html = renderPage(routeId, route);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  indexItems.push({routeId, name: route.name, href: `${slug(routeId)}/index.html`, useFor: route.useFor ?? ''});
}

const indexHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FDE HTML Style Variants</title>
  <style>
    body { margin: 0; padding: 40px; background: #101010; color: #f5f5f5; font-family: Inter, "PingFang SC", system-ui, sans-serif; }
    h1 { margin: 0 0 8px; font-size: 34px; }
    p { margin: 0 0 28px; color: #b8b8b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    a { display: block; padding: 18px; border: 1px solid #333; border-radius: 10px; background: #181818; color: #f5f5f5; text-decoration: none; }
    b { display: block; margin-bottom: 8px; font-size: 18px; }
    span { color: #aaa; font-size: 13px; line-height: 1.4; }
  </style>
</head>
<body>
  <h1>FDE HTML Style Variants</h1>
  <p>${esc(plan.meta.title)} · ${routeIds.length} routes · 3:4 static HTML previews</p>
  <div class="grid">
    ${indexItems.map((item) => `<a href="${item.href}"><b>${esc(item.name)}</b><span>${esc(item.routeId)}<br>${esc(item.useFor)}</span></a>`).join('\n')}
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf8');

console.log(JSON.stringify({outputDir, routes: indexItems}, null, 2));
