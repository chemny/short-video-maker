import {VideoPlan} from './types';

export type SafeAreaProfile = {
  name: '9:16' | '3:4' | '16:9' | 'generic';
  baseMarginTop: number;
  baseMarginBottom: number;
  baseMarginLeft: number;
  baseMarginRight: number;
  contentTop: number;
  contentBottom: number;
  contentLeft: number;
  contentRight: number;
  captionBottom: number;
  captionLeft: number;
  captionRight: number;
  platformRightRail: number;
};

const baseSafeArea = (
  width: number,
  height: number,
  _platforms: VideoPlan['meta']['platforms'] = [],
): SafeAreaProfile => {
  const ratio = width / height;

  if (ratio <= 0.62) {
    const baseMargin = 80;
    return {
      name: '9:16',
      baseMarginTop: 156,
      baseMarginBottom: 330,
      baseMarginLeft: baseMargin,
      baseMarginRight: baseMargin,
      contentTop: 156,
      contentBottom: 600,
      contentLeft: baseMargin,
      contentRight: baseMargin,
      captionBottom: 430,
      captionLeft: baseMargin,
      captionRight: baseMargin,
      platformRightRail: 0,
    };
  }

  if (ratio < 0.9) {
    const baseMargin = 82;
    return {
      name: '3:4',
      baseMarginTop: 76,
      baseMarginBottom: 136,
      baseMarginLeft: baseMargin,
      baseMarginRight: baseMargin,
      contentTop: 76,
      contentBottom: 300,
      contentLeft: baseMargin,
      contentRight: baseMargin,
      captionBottom: 136,
      captionLeft: baseMargin,
      captionRight: baseMargin,
      platformRightRail: 0,
    };
  }

  if (ratio >= 1.45) {
    return {
      name: '16:9',
      baseMarginTop: 72,
      baseMarginBottom: 82,
      baseMarginLeft: 122,
      baseMarginRight: 122,
      contentTop: 72,
      contentBottom: 230,
      contentLeft: 122,
      contentRight: 122,
      captionBottom: 82,
      captionLeft: 140,
      captionRight: 140,
      platformRightRail: 0,
    };
  }

  return {
    name: 'generic',
    baseMarginTop: 80,
    baseMarginBottom: 110,
    baseMarginLeft: 82,
    baseMarginRight: 82,
    contentTop: 80,
    contentBottom: 190,
    contentLeft: 82,
    contentRight: 82,
    captionBottom: 110,
    captionLeft: 82,
    captionRight: 82,
    platformRightRail: 0,
  };
};

export const resolveSafeArea = (width: number, height: number, platforms: VideoPlan['meta']['platforms'] = []): SafeAreaProfile => {
  const base = baseSafeArea(width, height, platforms);
  const reference = base.name === '16:9' ? [1920, 1080] : base.name === '9:16' ? [1080, 1920] : [1080, 1440];
  const scale = Math.min(width / reference[0], height / reference[1]);
  const result = Object.fromEntries(Object.entries(base).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value * scale) : value])) as SafeAreaProfile;
  // Conservative UI allowance, not a guarantee for every app/version.
  if (base.name === '9:16' && platforms.some((p) => ['douyin', 'xiaohongshu'].includes(p))) {
    result.platformRightRail = Math.round(72 * scale);
    result.contentRight += result.platformRightRail;
    result.captionRight += result.platformRightRail;
  }
  return result;
};
