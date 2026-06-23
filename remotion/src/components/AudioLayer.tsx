import {Audio} from '@remotion/media';
import {interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {VideoPlan} from '../lib/types';

const localAsset = (path: string) => staticFile(path.replace(/^public\//, ''));
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

export const AudioLayer = ({plan}: {plan: VideoPlan}) => {
  const audio = plan.audio;
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // BGM 淡入淡出：基于正片时长（= 旁白时长），首 1s 淡入、末 1.5s 淡出，避免硬起硬停。
  const contentFrames = Math.max(1, Math.round((plan.meta?.durationSeconds ?? 0) * fps));
  const base = audio?.bgmVolume ?? 0.35;
  const bgmVolume = () => {
    const fadeIn = interpolate(frame, [0, Math.round(fps * 1)], [0, base], clamp);
    const fadeOut = interpolate(
      frame,
      [contentFrames - Math.round(fps * 1.5), contentFrames],
      [base, 0],
      clamp,
    );
    return Math.max(0, Math.min(fadeIn, fadeOut));
  };

  return (
    <>
      {audio?.voiceover ? (
        <Audio src={localAsset(audio.voiceover)} volume={audio.voiceVolume ?? 1} />
      ) : null}
      {audio?.bgm ? <Audio src={localAsset(audio.bgm)} volume={bgmVolume} loop /> : null}
    </>
  );
};
