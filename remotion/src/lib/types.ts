export type Caption = {
  id: string;
  start: number;
  end: number;
  text: string;
  keywords?: string[];
};

export type Scene = {
  id: string;
  start: number;
  end: number;
  type: string;
  layout:
    | 'full-image-title'
    | 'image-with-caption'
    | 'text-card'
    | 'quote-card'
    | 'data-card'
    | 'step-list'
    | 'ending-card';
  voiceover: string;
  caption: string;
  visual?: {
    asset?: string;
    prompt?: string;
    alt?: string;
  };
  motion?: {
    type:
      | 'none'
      | 'slow-zoom-in'
      | 'slow-zoom-out'
      | 'pan-left'
      | 'pan-right'
      | 'fade-up';
    intensity?: number;
  };
  transition?: string;
};

export type VideoPlan = {
  meta: {
    title: string;
    subtitle?: string;
    topic: string;
    platforms: string[];
    language: string;
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
  };
  style: {
    template: string;
    fontFamily?: string;
    background: string;
    textPrimary: string;
    textSecondary?: string;
    accent: string;
    captionPosition: 'bottom' | 'middle';
    captionMode: 'sentence' | 'word';
    motionIntensity: 'low' | 'medium' | 'high';
  };
  audio?: {
    voiceover?: string;
    bgm?: string;
    voiceVolume?: number;
    bgmVolume?: number;
    duckBgm?: boolean;
  };
  cover: {
    title: string;
    subtitle?: string;
    label?: string;
    backgroundAsset?: string;
    layout: 'bold-title';
  };
  captions: Caption[];
  scenes: Scene[];
  publish?: Record<string, unknown>;
};
