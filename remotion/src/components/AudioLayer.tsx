import {Audio} from '@remotion/media';
import {staticFile} from 'remotion';
import {VideoPlan} from '../lib/types';

const localAsset = (path: string) => staticFile(path.replace(/^public\//, ''));

export const AudioLayer = ({plan}: {plan: VideoPlan}) => {
  const audio = plan.audio;

  return (
    <>
      {audio?.voiceover ? (
        <Audio src={localAsset(audio.voiceover)} volume={audio.voiceVolume ?? 1} />
      ) : null}
      {audio?.bgm ? (
        <Audio src={localAsset(audio.bgm)} volume={audio.bgmVolume ?? 0.12} loop />
      ) : null}
    </>
  );
};
