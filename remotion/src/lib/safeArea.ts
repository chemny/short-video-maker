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

export const resolveSafeArea = (
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
      contentBottom: 420,
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
      contentBottom: 270,
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
      contentBottom: 150,
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
