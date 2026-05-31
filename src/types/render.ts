export interface MediaConfig {
  voiceFile: string;
  backgroundVideos: string[];
  overlayImages: string[];
  musicFiles: string[];
  outputFilename: string;
}

export interface BackgroundConfig {
  blurPercent: number; // 0 to 100
  blurMode: 'fast' | 'quality';
  transitionType: string; // e.g., 'fade'
  transitionDuration: number; // in seconds, default 1.0
  randomVideoOrder: boolean;
  fillTimeline: boolean;
}

export interface ImageOverlayItem {
  id: string;
  imagePath: string;
  enabled: boolean;
  width: number;
  height: number;
  lockAspectRatio: boolean;
  x: number; // center X
  y: number; // center Y
  rotation: number; // 0-360
  opacity: number; // 0.0 - 1.0
  maskShape: 'rectangle' | 'rect_3_4' | 'rect_4_3' | 'square' | 'circle' | 'hexagon';
  inset: number;
  feather: number;
  bounceEnabled?: boolean;
}

export interface ImageOverlayConfig {
  enabled: boolean;
  width: number;
  height: number;
  lockAspectRatio: boolean;
  x: number; // center X
  y: number; // center Y
  rotation: number; // 0-360
  opacity: number; // 0.0 - 1.0
  maskShape: 'rectangle' | 'rect_3_4' | 'rect_4_3' | 'square' | 'circle' | 'hexagon';
  inset: number;
  feather: number;
  imageDuration: number; // seconds
  imageTransitionDuration: number; // seconds
  randomImageOrder: boolean;
  bounceEnabled?: boolean;
  items?: ImageOverlayItem[];
  overlayMode?: 'cycle' | 'custom';
}

export interface WaveformConfig {
  enabled: boolean;
  source: 'voice' | 'mixed' | 'music';
  path: 'linear' | 'circle' | 'square' | 'rectangle' | 'triangle' | 'hexagon' | 'custom' | 'vertical';
  flip?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  barsCount: number;
  barWidth: number;
  sensitivity: number;
  maxHeight: number;
  rotation: number;
  mirror: boolean;
  showBaseline: boolean;
  gradientEnabled: boolean;
  lineColor: string; // Hex format
  fillColor: string; // Hex format
  gradientStart: string; // Hex format
  gradientEnd: string; // Hex format
  layerOrder: 'waveform_on_top' | 'image_on_top';
}

export interface SubtitlesConfig {
  enabled: boolean;
  geminiApiKey: string;
  subtitleFile?: string;
  effect: 'karaoke' | 'pop' | 'fade' | 'slide_up' | 'glow_pulse' | 'opaque_box' | 'word_reveal' | 'none';
  fontFamily: string;
  fontSize: number;
  primaryColor: string; // Hex format
  secondaryColor: string; // Hex format
  outlineColor: string; // Hex format
  bottomMargin: number; // in pixels, default 150
  previewText: string;
  textCase: 'original' | 'uppercase' | 'lowercase';
  oneWordAtATime: boolean;
}

export interface CameraConfig {
  enabled: boolean;
  showCorners: boolean;
  showRecText: boolean;
  showBlinkingDot: boolean;
  showBattery: boolean;
  showTimecode: boolean;
  style: 'classic_rec' | 'modern_cinema' | 'vlogger_dslr' | 'retro_vhs';
  color: string;
  padding: number;
  thickness: number;
  scale: number;
}

export interface RenderSettingsConfig {
  resolution: '1920x1080' | '1280x720' | '1080x1920';
  fps: number; // e.g., 30
  encoder: 'auto' | 'h264_nvenc' | 'libx264';
  bitrate: string; // e.g., '6M'
  audioCodec: string; // e.g., 'AAC'
  cpuThreads: 'auto' | number;
  lowRamMode: boolean;
  cacheSize: number; // in GB, e.g. 10
}

export interface RenderConfig {
  media: MediaConfig;
  background: BackgroundConfig;
  imageOverlay: ImageOverlayConfig;
  waveform: WaveformConfig;
  subtitles: SubtitlesConfig;
  camera: CameraConfig;
  render: RenderSettingsConfig;
  musicVolume?: number;
  voiceVolume?: number;
  musicLoop?: boolean;
  musicDuration?: number;
}
