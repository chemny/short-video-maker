import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {CoverStill} from '../CoverStill';
import {VideoPlan} from '../lib/types';

const ease = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.out(Easing.cubic)};

/**
 * 视频开头的封面标题卡：复用 CoverStill 画面，frame 0 即满屏可见（缩略图用），
 * 无淡入、无缩放，仅末尾几帧淡出平滑切入正片第一个场景。
 */
export const CoverIntro = ({plan, durationInFrames}: {plan: VideoPlan; durationInFrames: number}) => {
  const frame = useCurrentFrame();

  // frame 0 即满屏封面（缩略图要用），不做淡入、不做缩放；仅末尾几帧淡出，平滑切入正片。
  const opacity = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], ease);

  return (
    <AbsoluteFill style={{opacity}}>
      <CoverStill plan={plan} />
    </AbsoluteFill>
  );
};
