import {VideoPlan} from './types';

// 封面 intro 停留秒数：默认 0.5s（够当缩略图+短暂聚焦，不拖沓），
// 可用 cover.introSeconds 覆盖（0 = 关闭）。
export const coverIntroSeconds = (plan: VideoPlan): number => {
  const v = plan.cover?.introSeconds;
  return typeof v === 'number' && v >= 0 ? v : 0.5;
};

export const coverIntroFrames = (plan: VideoPlan, fps: number): number =>
  Math.round(coverIntroSeconds(plan) * fps);
