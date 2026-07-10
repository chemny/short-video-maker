export type Caption = {
  id: string;
  start: number;
  end: number;
  text: string;
  lines?: Array<{
    text: string;
    scale?: number;
    weight?: number;
  }>;
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
  // 卡片正文：一句支撑/延伸（不重复旁白）。缺省时回退到旁白摘要。
  body?: string;
  // 标签：精选关键词，限定为旁白里实际说到的词。
  // 作者写 string[]；TTS 步骤用词时间戳富集成 {text, at} 以实现真·音频同步。
  tags?: Array<string | {text: string; at?: number | null}>;
  // 视觉流程节点：给 app-workflow 等模板使用，不参与逐词同步。
  steps?: string[];
  visual?: {
    asset?: string;
    prompt?: string;
    alt?: string;
    // 裸图模式（image-overlay 专用）：图片已是成品整图（如自带文字的设计卡片），
    // 只满屏显示 + 轻微缓动，不叠加标题/正文/标签/蒙层。底部跟读字幕仍由全局层渲染。
    bare?: boolean;
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
  data?: {
    metric?: {value: number; unit?: string; label: string};
    comparison?: {before: number; after: number; label: string};
    stats?: Array<{value: string; label: string}>;
  };
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
    preset?: 'warm-note' | 'mono-tech' | 'soft-product' | 'dark-cinematic';
    layoutSystem?: 'spoken-card-v1' | 'xhs-card-v1';
    editorialVariant?:
      | 'swiss-blue'
      | 'editorial-ink'
      | 'magazine-cream'
      | 'xhs-morandi'
      | 'html-cobalt-grid'
      | 'html-editorial-forest'
      | 'html-signal'
      | 'html-liquid-dark'
      | 'html-soft-editorial';
    fontFamily?: string;
    background: string;
    textPrimary: string;
    textSecondary?: string;
    accent: string;
    captionPosition: 'bottom' | 'middle';
    captionMode: 'sentence' | 'word';
    captionScale?: number;
    captionTheme?: 'auto' | 'dark-on-light' | 'light-on-dark';
    motionIntensity: 'low' | 'medium' | 'high';
    chrome?: {
      header?: 'none' | 'minimal' | 'editorial';
      footer?: 'none' | 'caption-only' | 'tags' | 'progress';
      showSceneNumber?: boolean;
      showTopic?: boolean;
      showSceneLabel?: boolean;
      showLedger?: boolean;
    };
    // 给底部字幕加深色毛玻璃底衬，保证在浅色画面（如奶油底手绘卡）上也清晰可读。
    captionBackdrop?: boolean;
    // 一次性"视觉背景设定"：全文核心论点 + 统一主体/场景/世界观。
    // 生图时前置到每个 prompt（封面+场景），保证图与全文上下文接地、六张成一套。
    imageContext?: string;
    globe?: {
      cx?: number;
      cy?: number;
      radius?: number;
      maxOpacity?: number;
      speed?: number;
      polarCapDeg?: number;
    };
    safeAreaOverlay?: boolean;
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
    // 视频开头封面停留秒数（标题卡）。默认 2s；设为 0 关闭。
    introSeconds?: number;
  };
  captions: Caption[];
  scenes: Scene[];
  publish?: Record<string, unknown>;
};
