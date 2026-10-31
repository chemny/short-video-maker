import type {VisualComponent,ComponentRender} from './componentTypes';
export type Caption = {
  displayStart?: number;
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
  contentShape?: string;
  visualComponent?: VisualComponent;
  componentRender?: ComponentRender;
  visualReuseReason?: string;
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
    | 'ending-card'
    | 'hook'
    | 'definition'
    | 'scenario-matrix'
    | 'diagnostic'
    | 'flow'
    | 'signal'
    | 'capability'
    | 'takeaway';
  voiceover: string;
  caption: string;
  captionIds?: string[];
  preservePauses?: boolean;
  minimumDurationSeconds?: number;
  pausePreservationReason?: string;
  evidence?: {claimIds: string[]; sourceIds: string[]; visualReason: string; visualOrigin?: 'official' | 'authored' | 'user'; mediaId?: string};
  visualBindings?: Array<{captionIds: string[]; kind: 'official-demo' | 'official-image' | 'authored-diagram' | 'authored-card' | 'user-media'; shows: string; reason: string; sourceStart?: number; sourceEnd?: number}>;
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
    kind?: 'image' | 'video';
    sourceStart?: number;
    sourceVolume?: number;
    fit?: 'contain' | 'cover';
    focalPoint?: {x: number; y: number};
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
  directorRender?: {version:number;sourceSha256:string;shots:any[]};
  meta: {
    directorVersion?: 'director-v1';
    productionWorkflow?: 'reviewed-v1';
    seriesLabel?: string;
    renderSource?: {kind:'authored-remotion';entry:string;composition:string;coverComposition?:string;layoutProtocol:'svm-layout-v1'};
    title: string;
    renderEngine?: 'remotion' | 'hyperframes';
    subtitle?: string;
    speaker?: string;
    topic: string;
    platforms: string[];
    language: string;
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    productionMode?: 'researched' | 'authored';
    productionVersion?: 'p0-v1';
    editorialWorkflow?: 'sentence-v1';
    editorialDate?: string;
    reportType?: 'product' | 'article' | 'daily';
  };
  style: {
    componentSystem?: 'semantic-v1' | 'off';
    layoutReadability?: 'phone-v1';
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
    layoutAudit?: boolean;
  };
  audio?: {
    intent?: 'silent' | 'narrated';
    sourceMode?: 'imported' | 'tts';
    timingSource?: 'provided' | 'asr-matched' | 'provider-matched';
    exportPipeline?: 'pcm-master-v1';
    provider?: string;
    model?: string;
    voice?: string;
    sourceVoiceover?: string;
    sourceBgm?: string;
    mix?: string;
    mixIncludesBgm?: boolean;
    processing?: {cleanup?: 'none' | 'light'; normalize?: boolean};
    timingRepair?: {enabled?: boolean; preserveWindows?: Array<{start: number; end: number; reason: string}>};
    acousticTiming?: {version: 'acoustic-v1'; report: string; sourceSha256: string; reportSha256: string};
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
    // Title over the existing content/audio timeline; does not prepend silence.
    overlaySeconds?: number;
  };
  captions: Caption[];
  scenes: Scene[];
  publish?: Record<string, unknown>;
};
