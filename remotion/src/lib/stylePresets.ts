import {VideoPlan} from './types';

export type VisualPresetId = 'warm-note' | 'mono-tech' | 'soft-product' | 'dark-cinematic';

export type VisualPreset = {
  id: VisualPresetId;
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentAlt: string;
  line: string;
  shadow: string;
};

const PRESETS: Record<VisualPresetId, VisualPreset> = {
  'warm-note': {
    id: 'warm-note',
    background: '#F7F1E6',
    surface: '#FFF9EC',
    surfaceAlt: '#EFE3CE',
    textPrimary: '#20201C',
    textSecondary: '#676052',
    accent: '#D08A17',
    accentAlt: '#2F6B5F',
    line: '#D8C8AC',
    shadow: '0 20px 60px rgba(70, 54, 24, 0.16)',
  },
  'mono-tech': {
    id: 'mono-tech',
    background: '#F2F2EF',
    surface: '#FFFFFF',
    surfaceAlt: '#E3E3DE',
    textPrimary: '#111111',
    textSecondary: '#5D5D58',
    accent: '#111111',
    accentAlt: '#007A7A',
    line: '#C9C9C2',
    shadow: '0 20px 56px rgba(0, 0, 0, 0.12)',
  },
  'soft-product': {
    id: 'soft-product',
    background: '#EEF6F4',
    surface: '#FFFFFF',
    surfaceAlt: '#DDEEEA',
    textPrimary: '#12211F',
    textSecondary: '#526864',
    accent: '#1E887A',
    accentAlt: '#E3A72F',
    line: '#BFD7D2',
    shadow: '0 22px 64px rgba(20, 84, 76, 0.15)',
  },
  'dark-cinematic': {
    id: 'dark-cinematic',
    background: '#0E1114',
    surface: '#171C20',
    surfaceAlt: '#252B31',
    textPrimary: '#F6F3EA',
    textSecondary: '#AFAAA0',
    accent: '#E5B84A',
    accentAlt: '#6DB6C9',
    line: '#31383F',
    shadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
  },
};

export const resolvePreset = (plan: VideoPlan): VisualPreset => {
  const id = plan.style.preset;
  const preset = id && id in PRESETS ? PRESETS[id as VisualPresetId] : PRESETS['soft-product'];
  return {
    ...preset,
    background: plan.style.background || preset.background,
    textPrimary: plan.style.textPrimary || preset.textPrimary,
    textSecondary: plan.style.textSecondary || preset.textSecondary,
    accent: plan.style.accent || preset.accent,
  };
};

export const sceneLabel: Record<string, string> = {
  hook: '开场',
  definition: '定义',
  explain: '解析',
  example: '案例',
  benefits: '价值',
  howto: '步骤',
  risk: '提醒',
  ending: '总结',
  thesis: '核心',
  analysis: '分析',
  process: '流程',
  framework: '框架',
  step: '步骤',
  mistake: '避坑',
};

export const shortText = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export const tagText = (tag: SceneTag): string => (typeof tag === 'string' ? tag : tag.text);

type SceneTag = string | {text: string; at?: number | null};
