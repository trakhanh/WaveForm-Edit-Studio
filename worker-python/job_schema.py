from pydantic import BaseModel, Field
from typing import List, Optional, Union

class MediaConfig(BaseModel):
    voiceFile: str
    backgroundVideos: List[str] = Field(default_factory=list)
    overlayImages: List[str] = Field(default_factory=list)
    musicFiles: List[str] = Field(default_factory=list)
    outputFilename: str

class BackgroundConfig(BaseModel):
    blurPercent: int = Field(default=20, ge=0, le=100)
    blurMode: str = Field(default="fast") # "fast" or "quality"
    transitionType: str = Field(default="fade")
    transitionDuration: float = Field(default=1.0)
    randomVideoOrder: bool = Field(default=True)
    fillTimeline: bool = Field(default=True)

class ImageOverlayItem(BaseModel):
    id: str
    imagePath: str
    enabled: bool = Field(default=True)
    width: int = Field(default=600)
    height: int = Field(default=450)
    lockAspectRatio: bool = Field(default=True)
    x: int = Field(default=960)
    y: int = Field(default=540)
    rotation: int = Field(default=0, ge=0, le=360)
    opacity: float = Field(default=0.9, ge=0.0, le=1.0)
    maskShape: str = Field(default="circle")
    inset: int = Field(default=10)
    feather: int = Field(default=0)
    bounceEnabled: bool = Field(default=False)

class ImageOverlayConfig(BaseModel):
    enabled: bool = Field(default=True)
    width: int = Field(default=600)
    height: int = Field(default=450)
    lockAspectRatio: bool = Field(default=True)
    x: int = Field(default=960)
    y: int = Field(default=540)
    rotation: int = Field(default=0, ge=0, le=360)
    opacity: float = Field(default=0.9, ge=0.0, le=1.0)
    maskShape: str = Field(default="circle")
    inset: int = Field(default=10)
    feather: int = Field(default=0)
    imageDuration: float = Field(default=5.0)
    imageTransitionDuration: float = Field(default=1.0)
    randomImageOrder: bool = Field(default=False)
    bounceEnabled: bool = Field(default=False)
    items: Optional[List[ImageOverlayItem]] = Field(default_factory=list)
    overlayMode: str = Field(default="cycle")

class WaveformConfig(BaseModel):
    enabled: bool = Field(default=True)
    source: str = Field(default="voice")
    path: str = Field(default="circle")
    flip: bool = Field(default=False)
    x: int = Field(default=960)
    y: int = Field(default=540)
    width: int = Field(default=300)
    height: int = Field(default=300)
    barsCount: int = Field(default=64)
    barWidth: int = Field(default=4)
    sensitivity: float = Field(default=1.5)
    maxHeight: int = Field(default=120)
    rotation: int = Field(default=0)
    mirror: bool = Field(default=True)
    showBaseline: bool = Field(default=False)
    gradientEnabled: bool = Field(default=True)
    lineColor: str = Field(default="#ffffff")
    fillColor: str = Field(default="#6366f1")
    gradientStart: str = Field(default="#818cf8")
    gradientEnd: str = Field(default="#4f46e5")
    layerOrder: str = Field(default="waveform_on_top")

class SubtitlesConfig(BaseModel):
    enabled: bool = Field(default=False)
    geminiApiKey: str = Field(default="")
    subtitleFile: Optional[str] = Field(default="")
    effect: str = Field(default="karaoke")
    fontFamily: str = Field(default="Inter")
    fontSize: int = Field(default=28)
    primaryColor: str = Field(default="#ffff00")
    secondaryColor: str = Field(default="#c0c0c0")
    outlineColor: str = Field(default="#000000")
    bottomMargin: int = Field(default=150)
    previewText: str = Field(default="")
    textCase: str = Field(default="uppercase")
    oneWordAtATime: bool = Field(default=False)

class CameraConfig(BaseModel):
    enabled: bool = Field(default=True)
    showCorners: bool = Field(default=True)
    showRecText: bool = Field(default=True)
    showBlinkingDot: bool = Field(default=True)
    showBattery: bool = Field(default=True)
    showTimecode: bool = Field(default=True)
    style: str = Field(default="classic_rec")
    color: str = Field(default="#ffffff")
    padding: int = Field(default=30)
    thickness: int = Field(default=3)
    scale: float = Field(default=1.0)

class RenderSettingsConfig(BaseModel):
    resolution: str = Field(default="1920x1080")
    fps: int = Field(default=30)
    encoder: str = Field(default="auto") # "auto", "h264_nvenc", "libx264"
    bitrate: str = Field(default="6M")
    audioCodec: str = Field(default="AAC")
    cpuThreads: Union[str, int] = Field(default="auto")
    lowRamMode: bool = Field(default=False)
    cacheSize: int = Field(default=10)

class RenderConfig(BaseModel):
    media: MediaConfig
    background: BackgroundConfig
    imageOverlay: ImageOverlayConfig
    waveform: WaveformConfig
    subtitles: SubtitlesConfig
    camera: CameraConfig
    render: RenderSettingsConfig
    musicVolume: Optional[float] = Field(default=0.5)
    voiceVolume: Optional[float] = Field(default=1.0)
    musicLoop: Optional[bool] = Field(default=True)
    musicDuration: Optional[float] = Field(default=0.0)
