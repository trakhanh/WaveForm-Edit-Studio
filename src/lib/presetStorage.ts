import { RenderConfig } from '../types/render';

export const DEFAULT_PRESET: RenderConfig = {
  media: {
    voiceFile: 'voiceFile.mp3',
    backgroundVideos: ['video_bg_01.mp4', 'video_bg_02.mp4', 'video_bg_03.mp4'],
    overlayImages: ['overlay_img_01.png', 'overlay_img_02.png'],
    musicFiles: ['background_music.mp3'],
    outputFilename: 'hoan_tat_video.mp4'
  },
  background: {
    blurPercent: 20,
    blurMode: 'fast',
    transitionType: 'fade',
    transitionDuration: 1.0,
    randomVideoOrder: true,
    fillTimeline: true
  },
  imageOverlay: {
    enabled: true,
    width: 600,
    height: 450,
    lockAspectRatio: true,
    x: 960,
    y: 540,
    rotation: 0,
    opacity: 0.9,
    maskShape: 'circle',
    inset: 10,
    feather: 0,
    imageDuration: 5.0,
    imageTransitionDuration: 1.0,
    randomImageOrder: false,
    bounceEnabled: false,
    items: [],
    overlayMode: 'cycle'
  },
  waveform: {
    enabled: true,
    source: 'voice',
    path: 'circle',
    flip: false,
    x: 960,
    y: 540,
    width: 300,
    height: 300,
    barsCount: 64,
    barWidth: 4,
    sensitivity: 1.5,
    maxHeight: 120,
    rotation: 0,
    mirror: true,
    showBaseline: false,
    gradientEnabled: true,
    lineColor: '#ffffff',
    fillColor: '#6366f1',
    gradientStart: '#818cf8',
    gradientEnd: '#4f46e5',
    layerOrder: 'waveform_on_top'
  },
  subtitles: {
    enabled: false,
    geminiApiKey: 'GEMINI_API_KEY_LOCAL',
    subtitleFile: '',
    effect: 'karaoke',
    fontFamily: 'Inter',
    fontSize: 28,
    primaryColor: '#ffff00', // Yellow
    secondaryColor: '#c0c0c0', // Grey for karaoke fill
    outlineColor: '#000000', // Black outline
    bottomMargin: 150,
    previewText: 'Chào mừng bạn đến với WaveForm Edit App!',
    textCase: 'uppercase',
    oneWordAtATime: false
  },
  camera: {
    enabled: true,
    showCorners: true,
    showRecText: true,
    showBlinkingDot: true,
    showBattery: true,
    showTimecode: true,
    style: 'classic_rec',
    color: '#ffffff',
    padding: 30,
    thickness: 3,
    scale: 1.0
  },
  render: {
    resolution: '1920x1080',
    fps: 30,
    encoder: 'auto',
    bitrate: '6M',
    audioCodec: 'AAC',
    cpuThreads: 'auto',
    lowRamMode: false,
    cacheSize: 10
  },
  musicVolume: 0.5,
  voiceVolume: 1.0,
  musicLoop: true,
  musicDuration: 0
};

export const presetStorage = {
  getDefaultPreset(): RenderConfig {
    return JSON.parse(JSON.stringify(DEFAULT_PRESET));
  },
  
  getPresets(): Record<string, RenderConfig> {
    if (typeof window === 'undefined') return { 'Mặc định': DEFAULT_PRESET };
    
    try {
      const stored = localStorage.getItem('avm_presets');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Lỗi khi đọc presets từ localStorage:', e);
    }
    
    return { 'Mặc định': DEFAULT_PRESET };
  },
  
  savePreset(name: string, config: RenderConfig): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const presets = this.getPresets();
      presets[name] = config;
      localStorage.setItem('avm_presets', JSON.stringify(presets));
      return true;
    } catch (e) {
      console.error('Lỗi khi ghi preset vào localStorage:', e);
      return false;
    }
  },
  
  deletePreset(name: string): boolean {
    if (typeof window === 'undefined') return false;
    if (name === 'Mặc định') return false;
    
    try {
      const presets = this.getPresets();
      if (presets[name]) {
        delete presets[name];
        localStorage.setItem('avm_presets', JSON.stringify(presets));
        return true;
      }
    } catch (e) {
      console.error('Lỗi khi xóa preset khỏi localStorage:', e);
    }
    return false;
  }
};
