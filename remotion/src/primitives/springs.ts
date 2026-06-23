import {SpringConfig} from 'remotion';

/** 统一 spring 预设，保证全局动感一致 */
export const Springs = {
  /** 快速弹入，适合徽章、小元素 */
  snappy:  {damping: 200, stiffness: 260, mass: 1, overshootClamping: false} satisfies SpringConfig,
  /** 标准入场，适合标题、卡片 */
  default: {damping: 160, stiffness: 180, mass: 1, overshootClamping: false} satisfies SpringConfig,
  /** 柔和入场，适合正文、说明 */
  gentle:  {damping: 140, stiffness: 120, mass: 1, overshootClamping: false} satisfies SpringConfig,
  /** 有弹性的冲击感，适合大数字完成时 */
  punch:   {damping:  12, stiffness: 200, mass: 1, overshootClamping: false} satisfies SpringConfig,
  /** 慢进慢出，适合背景、装饰层 */
  lazy:    {damping: 220, stiffness:  80, mass: 1, overshootClamping: false} satisfies SpringConfig,
} as const;
