'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RenderConfig } from '@/types/render';
import { RenderJob, JobStatus } from '@/types/job';
import { DEFAULT_PRESET, presetStorage } from '@/lib/presetStorage';
import { jobClient } from '@/lib/jobClient';
import RenderControls from '@/components/render/RenderControls';
import RenderProgress from '@/components/render/RenderProgress';
import LogConsole from '@/components/logs/LogConsole';
import { 
  Video, Image as ImageIcon, Music, Sliders, Type, Camera, 
  Settings, FolderOpen, Save, RefreshCw, Terminal, Network, Eye, Search, X, Check, Folder, FileAudio, FileVideo, FileImage, FileCode, ArrowLeft, XCircle, HelpCircle
} from 'lucide-react';

type ConfigTab = 'media' | 'background' | 'overlay' | 'waveform' | 'subtitles' | 'camera' | 'removebg' | 'render';
type PreviewTab = 'ffmpeg' | 'logs' | 'architecture';

// Interface for actual filesystem items returned by Node fs API
interface RealFileItem {
  name: string;
  type: 'dir' | 'file';
  ext?: string;
}

export default function Page() {
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Config state (Khôi phục cấu hình tự động tránh mất dữ liệu khi reload trang)
  const [config, setConfig] = useState<RenderConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('avm_current_config');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error('Lỗi khôi phục config từ localStorage:', e);
      }
    }
    return DEFAULT_PRESET;
  });
  
  const [presets, setPresets] = useState<Record<string, RenderConfig>>({});
  
  const [selectedPresetName, setSelectedPresetName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('avm_selected_preset_name') || 'Mặc định';
    }
    return 'Mặc định';
  });
  
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Theme State (Dark / Light Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('avm_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('avm_theme', nextTheme);
  };

  // Tự động lưu cấu hình config vào localStorage khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('avm_current_config', JSON.stringify(config));
    } catch (e) {
      console.error('Lỗi khi lưu config vào localStorage:', e);
    }
  }, [config]);

  // Tự động lưu tên Preset đang chọn vào localStorage khi có thay đổi
  useEffect(() => {
    localStorage.setItem('avm_selected_preset_name', selectedPresetName);
  }, [selectedPresetName]);
  
  // UI Tabs State
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab>('media');
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>('ffmpeg');

  // Job & Processing State
  const [activeJob, setActiveJob] = useState<RenderJob | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('PENDING');
  const [progress, setProgress] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [logs, setLogs] = useState<RenderJob['logs']>([]);
  const [error, setError] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // ACTUAL Filesystem Explorer modal state
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserField, setBrowserField] = useState<keyof RenderConfig['media'] | 'outputFilename' | 'subtitleFile' | 'rembgInputImage' | null>(null);
  const [currentDirPath, setCurrentDirPath] = useState<string>(''); 
  const [dirItems, setDirItems] = useState<RealFileItem[]>([]);
  const [browserMode, setBrowserMode] = useState<'file' | 'dir'>('file');
  const [isLoadingDir, setIsLoadingDir] = useState(false);

  // Expanded dynamic states for dual-panel Windows explorer
  const [browserDrives, setBrowserDrives] = useState<{ name: string; path: string }[]>([]);
  const [browserQuickAccess, setBrowserQuickAccess] = useState<{ name: string; path: string; icon: string }[]>([]);
  const [browserSearchQuery, setBrowserSearchQuery] = useState('');
  const [browserOutputFileName, setBrowserOutputFileName] = useState('output.mp4');
  const [isScanProjectMode, setIsScanProjectMode] = useState(false);
  const [isScanningProject, setIsScanningProject] = useState(false);

  // Active overlay index for multiple overlay images preview
  const [activeOverlayIdx, setActiveOverlayIdx] = useState<number>(0);
  const [selectedOverlayItemId, setSelectedOverlayItemId] = useState<string | null>(null);
  const [isRemovingBgMap, setIsRemovingBgMap] = useState<Record<string, boolean>>({});

  // Background removal tab states
  const [rembgInputPath, setRembgInputPath] = useState<string>('');
  const [rembgResultPath, setRembgResultPath] = useState<string>('');
  const [isRemovingBgSingle, setIsRemovingBgSingle] = useState<boolean>(false);

  // AI Subtitle Transcription states
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribingPercent, setTranscribingPercent] = useState<number>(0);
  const [transcribingLogs, setTranscribingLogs] = useState<string[]>([]);
  const [isTranscribeModalOpen, setIsTranscribeModalOpen] = useState<boolean>(false);
  const [transcribeModel, setTranscribeModel] = useState<string>('base');
  const [transcribeLanguage, setTranscribeLanguage] = useState<string>('auto');
  const [transcribeError, setTranscribeError] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sseSourceRef = useRef<EventSource | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const transcribeAbortControllerRef = useRef<AbortController | null>(null);

  // Asset preview caching refs
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const overlayImageRef = useRef<HTMLImageElement | null>(null);
  const lastBgVideoPath = useRef<string>('');
  const lastOverlayImagePath = useRef<string>('');
  const overlayImagesCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Load and cache all simultaneous overlay images
  useEffect(() => {
    if (!config.imageOverlay.enabled || !config.imageOverlay.items) return;
    
    const currentCache = overlayImagesCacheRef.current;
    
    // Clean up cache of items no longer in config.imageOverlay.items
    const activeIds = new Set(config.imageOverlay.items.map(item => item.id));
    for (const key of Array.from(currentCache.keys())) {
      if (!activeIds.has(key)) {
        currentCache.delete(key);
      }
    }
    
    // Load new items
    config.imageOverlay.items.forEach(item => {
      if (!item.enabled || !item.imagePath) return;
      
      const cached = currentCache.get(item.id);
      if (cached && cached.getAttribute('data-path') === item.imagePath) {
        return; // Already loaded correctly
      }
      
      const img = new Image();
      img.src = `/api/fs/file?path=${encodeURIComponent(item.imagePath)}`;
      img.setAttribute('data-path', item.imagePath);
      img.onload = () => {
        currentCache.set(item.id, img);
      };
      img.onerror = () => {
        currentCache.delete(item.id);
      };
    });
  }, [config.imageOverlay.items, config.imageOverlay.enabled]);

  // Automatically load local file streams when assets are selected
  useEffect(() => {
    const bgPath = config.media.backgroundVideos[0];
    if (bgPath) {
      if (bgPath !== lastBgVideoPath.current) {
        lastBgVideoPath.current = bgPath;
        const video = document.createElement('video');
        video.src = `/api/fs/file?path=${encodeURIComponent(bgPath)}`;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.autoplay = true;
        video.onloadeddata = () => {
          video.play().catch((err) => console.log('Video preview play error:', err));
        };
        bgVideoRef.current = video;
      }
    } else {
      bgVideoRef.current = null;
      lastBgVideoPath.current = '';
    }

    const imgPath = config.media.overlayImages[activeOverlayIdx] || config.media.overlayImages[0];
    if (imgPath) {
      if (imgPath !== lastOverlayImagePath.current) {
        lastOverlayImagePath.current = imgPath;
        const img = new Image();
        img.src = `/api/fs/file?path=${encodeURIComponent(imgPath)}`;
        img.onload = () => {
          overlayImageRef.current = img;
        };
        img.onerror = () => {
          overlayImageRef.current = null;
        };
      }
    } else {
      overlayImageRef.current = null;
      lastOverlayImagePath.current = '';
    }
  }, [config.media.backgroundVideos, config.media.overlayImages, activeOverlayIdx]);

  // Cycle through overlay images based on duration in frontend preview
  useEffect(() => {
    if (!config.imageOverlay.enabled || config.media.overlayImages.length <= 1) {
      setActiveOverlayIdx(0);
      return;
    }
    const durationMs = (config.imageOverlay.imageDuration || 5) * 1000;
    const interval = setInterval(() => {
      setActiveOverlayIdx((prev) => {
        if (config.imageOverlay.randomImageOrder) {
          return Math.floor(Math.random() * config.media.overlayImages.length);
        } else {
          return (prev + 1) % config.media.overlayImages.length;
        }
      });
    }, durationMs);
    return () => clearInterval(interval);
  }, [config.media.overlayImages, config.imageOverlay.imageDuration, config.imageOverlay.randomImageOrder, config.imageOverlay.enabled]);

  // Load presets on mount
  useEffect(() => {
    setPresets(presetStorage.getPresets());
  }, []);

  // Khôi phục kết nối tiến trình render khi reload trang
  useEffect(() => {
    const activeJobId = localStorage.getItem('activeJobId');
    if (!activeJobId) return;

    let sse: EventSource | null = null;

    jobClient.getJob(activeJobId)
      .then((job) => {
        if (job && (job.status === 'PENDING' || job.status === 'PROCESSING')) {
          setActiveJob(job);
          setJobStatus(job.status);
          setProgress(job.progress);
          setElapsedTime(job.elapsedTime ?? 0);
          setRemainingTime(job.remainingTime ?? 0);
          setLogs(job.logs);

          // Tự động chuyển giao diện sang tab kết xuất để người dùng theo dõi
          setActiveConfigTab('render');
          setActivePreviewTab('logs');

          sse = new EventSource(`/api/jobs/${job.id}/events`);
          sseSourceRef.current = sse;

          sse.onmessage = (event) => {
            try {
              const updatedJob: RenderJob = JSON.parse(event.data);
              setActiveJob(updatedJob);
              setJobStatus(updatedJob.status);
              setProgress(updatedJob.progress);
              setElapsedTime(updatedJob.elapsedTime ?? 0);
              setRemainingTime(updatedJob.remainingTime ?? 0);
              setLogs(updatedJob.logs);

              if (updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED' || updatedJob.status === 'CANCELLED') {
                sse?.close();
                localStorage.removeItem('activeJobId');
              }
            } catch (e) {
              console.error('Lỗi khôi phục SSE:', e);
            }
          };

          sse.onerror = () => {
            sse?.close();
          };
        } else {
          localStorage.removeItem('activeJobId');
        }
      })
      .catch((err) => {
        console.error('Lỗi khi kiểm tra tiến trình cũ:', err);
        localStorage.removeItem('activeJobId');
      });

    return () => {
      if (sse) {
        sse.close();
      }
    };
  }, []);

  // Fetch actual files and folders from Node.js Local Filesystem API
  useEffect(() => {
    if (isBrowserOpen) {
      const fetchActualDirectory = async () => {
        setIsLoadingDir(true);
        try {
          const response = await fetch(`/api/fs?path=${encodeURIComponent(currentDirPath)}`);
          if (response.ok) {
            const data = await response.json();
            setDirItems(data.items || []);
            setCurrentDirPath(data.currentPath || '');
            if (data.drives) setBrowserDrives(data.drives);
            if (data.quickAccess) setBrowserQuickAccess(data.quickAccess);
          } else {
            console.error('Lỗi phản hồi từ file system API');
          }
        } catch (e) {
          console.error('Không thể truy xuất dữ liệu đĩa cục bộ:', e);
        } finally {
          setIsLoadingDir(false);
        }
      };
      fetchActualDirectory();
    }
  }, [currentDirPath, isBrowserOpen]);

  // Update canvas preview
  useEffect(() => {
    const loop = () => {
      drawPreview();
      animationFrameId.current = requestAnimationFrame(loop);
    };
    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [config]);

  // Handle preset loading
  const handleLoadPreset = (name: string) => {
    const loaded = presets[name];
    if (loaded) {
      setConfig(JSON.parse(JSON.stringify(loaded)));
      setSelectedPresetName(name);
    }
  };

  // Handle preset saving
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const success = presetStorage.savePreset(newPresetName, config);
    if (success) {
      const updated = presetStorage.getPresets();
      setPresets(updated);
      setSelectedPresetName(newPresetName);
      setNewPresetName('');
    }
  };

  // Handle preset deletion
  const handleDeletePreset = (name: string) => {
    if (name === 'Mặc định') return;
    if (confirm(`Bạn có chắc chắn muốn xóa cấu hình Preset "${name}" không?`)) {
      const success = presetStorage.deletePreset(name);
      if (success) {
        const updated = presetStorage.getPresets();
        setPresets(updated);
        setSelectedPresetName('Mặc định');
        setConfig(JSON.parse(JSON.stringify(updated['Mặc định'] || DEFAULT_PRESET)));
      }
    }
  };

  // Handle preset overwriting/saving current
  const handleOverwritePreset = (name: string) => {
    if (name === 'Mặc định') return;
    const success = presetStorage.savePreset(name, config);
    if (success) {
      const updated = presetStorage.getPresets();
      setPresets(updated);
      alert(`Đã lưu thành công các thay đổi vào Preset "${name}"!`);
    }
  };

  const handleStartScanProjectMode = () => {
    setIsScanProjectMode(true);
    setBrowserField('voiceFile'); // placeholder to satisfy field validation
    setBrowserMode('dir');
    setBrowserSearchQuery('');
    setCurrentDirPath('');
    setIsBrowserOpen(true);
  };

  // AI Transcription execution function (Streams SSE via standard fetch reader)
  const stopAITranscription = () => {
    if (transcribeAbortControllerRef.current) {
      transcribeAbortControllerRef.current.abort();
      transcribeAbortControllerRef.current = null;
    }
    setTranscribingLogs((prev) => [...prev, "⚠️ Đang dừng tiến trình trích xuất âm thanh..."]);
    setIsTranscribing(false);
  };

  const startAITranscription = async () => {
    if (!config.media.voiceFile) {
      alert("⚠️ Vui lòng chọn tệp giọng đọc chính (VoiceFile) trước khi tạo phụ đề AI.");
      return;
    }

    setIsTranscribing(true);
    setTranscribingPercent(0);
    setTranscribingLogs(["Khởi động luồng dịch thuật tự động...", "Kết nối với máy chủ API..."]);
    setTranscribeError("");

    const controller = new AbortController();
    transcribeAbortControllerRef.current = controller;

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceFile: config.media.voiceFile,
          model: transcribeModel,
          language: transcribeLanguage
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `Lỗi máy chủ HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Không nhận được luồng dữ liệu phản hồi (Stream) từ máy chủ.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          
          const jsonStr = trimmed.slice(6);
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            if (data.error) {
              throw new Error(data.error);
            }
            
            if (data.percent !== undefined) {
              setTranscribingPercent(data.percent);
            }
            if (data.log) {
              setTranscribingLogs((prev) => [...prev, data.log]);
            }
            
            if (data.percent === 100 && data.outputPath) {
              // Automatically populate the generated subtitle path to our subtitle configuration
              setConfig((prev) => ({
                ...prev,
                subtitles: {
                  ...prev.subtitles,
                  enabled: true,
                  subtitleFile: data.outputPath
                }
              }));
              setTranscribingLogs((prev) => [...prev, `🎉 Hoàn tất! Phụ đề được tự động áp dụng.`]);
            }
          } catch (e: any) {
            console.error("Lỗi phân tích cú pháp SSE:", e);
            if (trimmed.includes('"error":')) {
              throw new Error(e.message || "Lỗi tiến trình Whisper");
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTranscribingLogs((prev) => [...prev, "⚠️ Đã dừng trích xuất phụ đề AI theo yêu cầu của bạn."]);
        return;
      }
      console.error("Lỗi khi chạy transcribe:", err);
      setTranscribeError(err.message || "Đã xảy ra lỗi không xác định.");
      setTranscribingLogs((prev) => [...prev, `❌ Thất bại: ${err.message}`]);
    } finally {
      transcribeAbortControllerRef.current = null;
    }
  };

  // Browser modal actions - actual selection
  const openPathBrowser = (field: keyof RenderConfig['media'] | 'outputFilename' | 'subtitleFile' | 'rembgInputImage', mode: 'file' | 'dir') => {
    setBrowserField(field);
    setBrowserMode(mode);
    setBrowserSearchQuery('');
    
    // Automatically locate the folder containing the existing file, or default to empty (workspace)
    let initialPath = '';
    if (field === 'rembgInputImage' && rembgInputPath) {
      const lastSlash = rembgInputPath.lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = rembgInputPath.substring(0, lastSlash);
    } else if (field === 'outputFilename' && config.media.outputFilename) {
      const lastSlash = config.media.outputFilename.lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = config.media.outputFilename.substring(0, lastSlash);
    } else if (field === 'voiceFile' && config.media.voiceFile) {
      const lastSlash = config.media.voiceFile.lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = config.media.voiceFile.substring(0, lastSlash);
    } else if (field === 'musicFiles' && config.media.musicFiles.length > 0 && config.media.musicFiles[0]) {
      const lastSlash = config.media.musicFiles[0].lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = config.media.musicFiles[0].substring(0, lastSlash);
    } else if (field === 'backgroundVideos' && config.media.backgroundVideos.length > 0 && config.media.backgroundVideos[0]) {
      const lastSlash = config.media.backgroundVideos[0].lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = config.media.backgroundVideos[0].substring(0, lastSlash);
    } else if (field === 'overlayImages' && config.media.overlayImages.length > 0 && config.media.overlayImages[0]) {
      const lastSlash = config.media.overlayImages[0].lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = config.media.overlayImages[0].substring(0, lastSlash);
    } else if (field === 'subtitleFile' && config.subtitles.subtitleFile) {
      const lastSlash = config.subtitles.subtitleFile.lastIndexOf('\\');
      if (lastSlash !== -1) initialPath = config.subtitles.subtitleFile.substring(0, lastSlash);
    }
    
    setCurrentDirPath(initialPath);
    setIsBrowserOpen(true);
  };

  const handleSelectPathItem = (item: RealFileItem) => {
    const slash = currentDirPath.endsWith('\\') || currentDirPath === '' ? '' : '\\';
    const targetPath = currentDirPath === '' ? item.name : `${currentDirPath}${slash}${item.name}`;

    if (item.type === 'dir') {
      setCurrentDirPath(targetPath);
    } else {
      // File selected
      applySelectedPath(targetPath);
    }
  };

  const applySelectedPath = (path: string) => {
    if (!browserField) return;

    if (browserField === 'outputFilename') {
      setConfig({
        ...config,
        media: { ...config.media, outputFilename: path }
      });
    } else if (browserField === 'voiceFile') {
      setConfig({
        ...config,
        media: { ...config.media, voiceFile: path }
      });
    } else if (browserField === 'musicFiles') {
      setConfig({
        ...config,
        media: { ...config.media, musicFiles: [path] }
      });
    } else if (browserField === 'backgroundVideos') {
      setConfig({
        ...config,
        media: { ...config.media, backgroundVideos: [path] } // select actual video
      });
    } else if (browserField === 'overlayImages') {
      const currentImages = config.media.overlayImages || [];
      const updatedImages = currentImages.includes(path) ? currentImages : [...currentImages, path];
      
      const newId = `overlay_${Math.random().toString(36).substring(2, 9)}`;
      const newItem = {
        id: newId,
        imagePath: path,
        enabled: true,
        width: 400,
        height: 300,
        lockAspectRatio: true,
        x: 960,
        y: 540,
        rotation: 0,
        opacity: 0.9,
        maskShape: 'circle' as const,
        inset: 10,
        feather: 0,
        bounceEnabled: false
      };
      
      const currentItems = config.imageOverlay.items || [];
      setConfig({
        ...config,
        media: { ...config.media, overlayImages: updatedImages },
        imageOverlay: {
          ...config.imageOverlay,
          items: [...currentItems, newItem]
        }
      });
      setSelectedOverlayItemId(newId);
    } else if (browserField === 'subtitleFile') {
      setConfig({
        ...config,
        subtitles: { ...config.subtitles, subtitleFile: path }
      });
    } else if (browserField === 'rembgInputImage') {
      setRembgInputPath(path);
      setRembgResultPath('');
    }

    setIsBrowserOpen(false);
  };

  const handleSelectCurrentFolder = async () => {
    if (isScanProjectMode) {
      setIsBrowserOpen(false);
      setIsScanningProject(true);
      try {
        const res = await fetch(`/api/fs/scan-project?path=${encodeURIComponent(currentDirPath)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setConfig((prev) => ({
              ...prev,
              media: {
                ...prev.media,
                voiceFile: data.voiceFile || prev.media.voiceFile,
                backgroundVideos: data.backgroundVideos.length > 0 ? data.backgroundVideos : prev.media.backgroundVideos,
                overlayImages: data.overlayImages.length > 0 ? data.overlayImages : prev.media.overlayImages,
                musicFiles: data.musicFiles.length > 0 ? data.musicFiles : prev.media.musicFiles,
                outputFilename: data.outputFilename || prev.media.outputFilename
              }
            }));
            // Show dynamic summary alert in Vietnamese
            alert(`⚡ TỰ ĐỘNG CẤU HÌNH DỰ ÁN THÀNH CÔNG!\n\n` +
                  `• Giọng đọc (Voice): ${data.voiceFile ? 'Đã tìm thấy ✓' : 'Không tìm thấy ✗'}\n` +
                  `• Video nền (Video): Đã quét thấy ${data.backgroundVideos.length} tệp ✓\n` +
                  `• Ảnh phủ (Image): Đã quét thấy ${data.overlayImages.length} tệp ✓\n` +
                  `• Nhạc nền (Music): Đã quét thấy ${data.musicFiles.length} tệp ✓\n\n` +
                  `Tất cả tài nguyên đã tự động được nạp vào cấu hình Studio!`);
          } else {
            alert(`Lỗi quét thư mục dự án: ${data.message}`);
          }
        } else {
          alert('Không thể kết nối với API quét thư mục dự án.');
        }
      } catch (err: any) {
        alert(`Lỗi hệ thống: ${err.message}`);
      } finally {
        setIsScanningProject(false);
        setIsScanProjectMode(false);
      }
      return;
    }

    const slash = currentDirPath.endsWith('\\') || currentDirPath === '' ? '' : '\\';
    const filename = browserOutputFileName.trim() || 'output.mp4';
    const fullPath = currentDirPath === '' ? filename : `${currentDirPath}${slash}${filename}`;
    applySelectedPath(fullPath);
  };

  const navigateUp = () => {
    const parts = currentDirPath.split('\\').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      const parent = parts.join('\\') + '\\';
      setCurrentDirPath(parent);
    } else if (parts.length === 1) {
      // Back to drives list
      setCurrentDirPath('');
    }
  };

  const addLog = (message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        level,
        message
      }
    ]);
  };

  const handleRemoveBackground = async (itemId: string, imagePath: string) => {
    if (!imagePath) return;
    setIsRemovingBgMap(prev => ({ ...prev, [itemId]: true }));
    addLog(`⏳ Đang chạy Rembg AI xóa nền cho ảnh phủ overlay (ID: ${itemId})...`, 'info');
    try {
      const res = await fetch('/api/fs/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.noBgPath) {
          // If it is a multiple overlay item
          if (itemId !== 'fallback') {
            const updated = (config.imageOverlay.items || []).map(it => 
              it.id === itemId ? { ...it, imagePath: data.noBgPath } : it
            );
            setConfig({
              ...config,
              imageOverlay: { ...config.imageOverlay, items: updated }
            });
            setSelectedOverlayItemId(itemId);
          } else {
            // Fallback cycle overlays
            // Replace in config.media.overlayImages
            const updatedImages = config.media.overlayImages.map(img => 
              img === imagePath ? data.noBgPath : img
            );
            setConfig({
              ...config,
              media: { ...config.media, overlayImages: updatedImages }
            });
          }
          addLog(`✅ Xóa nền ảnh phủ thành công! Tệp đích: ${data.noBgPath}`, 'success');
          alert('⚡ XỬ LÝ XÓA NỀN THÀNH CÔNG!\nẢnh đã xóa nền đã được nạp trực tiếp vào bản xem thử.');
        } else {
          addLog(`❌ Lỗi xóa nền ảnh phủ: ${data.message}`, 'error');
          alert(`Lỗi xóa nền: ${data.message}`);
        }
      } else {
        addLog('❌ Không thể kết nối với API xóa nền.', 'error');
        alert('Không thể kết nối với API xóa nền.');
      }
    } catch (err: any) {
      addLog(`❌ Lỗi hệ thống khi xóa nền: ${err.message}`, 'error');
      alert(`Lỗi hệ thống: ${err.message}`);
    } finally {
      setIsRemovingBgMap(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleOpenInRembgTab = (imagePath: string) => {
    setRembgInputPath(imagePath);
    setRembgResultPath('');
    setActiveConfigTab('removebg');
  };

  const handleAddProcessedToOverlay = () => {
    if (!rembgResultPath) return;
    const currentImages = config.media.overlayImages || [];
    const updatedImages = currentImages.includes(rembgResultPath) ? currentImages : [...currentImages, rembgResultPath];
    
    const newId = `overlay_${Math.random().toString(36).substring(2, 9)}`;
    const newItem = {
      id: newId,
      imagePath: rembgResultPath,
      enabled: true,
      width: 400,
      height: 300,
      lockAspectRatio: true,
      x: 960,
      y: 540,
      rotation: 0,
      opacity: 0.9,
      maskShape: 'circle' as const,
      inset: 10,
      feather: 0,
      bounceEnabled: false
    };
    
    const currentItems = config.imageOverlay.items || [];
    setConfig({
      ...config,
      media: { ...config.media, overlayImages: updatedImages },
      imageOverlay: {
        ...config.imageOverlay,
        items: [...currentItems, newItem]
      }
    });
    setSelectedOverlayItemId(newId);
    setActiveConfigTab('overlay');
    alert('🎉 Đã thêm ảnh sạch nền vào danh sách lớp ảnh phủ và chuyển sang Tab Ảnh phủ!');
  };

  const handleRemoveBackgroundSingle = async () => {
    if (!rembgInputPath) return;
    setIsRemovingBgSingle(true);
    setRembgResultPath('');
    addLog(`⏳ Bắt đầu tách nền AI cho ảnh: ${rembgInputPath}...`, 'info');
    try {
      const res = await fetch('/api/fs/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: rembgInputPath })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.noBgPath) {
          setRembgResultPath(data.noBgPath);
          addLog(`✅ Xóa nền thành công! Tệp đích: ${data.noBgPath}`, 'success');
          alert('⚡ XÓA NỀN THÀNH CÔNG!\nẢnh sạch nền đã sẵn sàng bên cột kết quả.');
        } else {
          addLog(`❌ Lỗi tách nền AI: ${data.message}`, 'error');
          alert(`Lỗi xóa nền: ${data.message}`);
        }
      } else {
        addLog('❌ Không thể kết nối với API xóa nền.', 'error');
        alert('Không thể kết nối với API xóa nền.');
      }
    } catch (err: any) {
      addLog(`❌ Lỗi hệ thống khi xóa nền: ${err.message}`, 'error');
      alert(`Lỗi hệ thống: ${err.message}`);
    } finally {
      setIsRemovingBgSingle(false);
    }
  };

  // Start rendering
  const handleStartRender = async () => {
    try {
      setProgress(0);
      setElapsedTime(0);
      setRemainingTime(0);
      setLogs([]);
      setError('');
      setJobStatus('PENDING');

      if (sseSourceRef.current) {
        sseSourceRef.current.close();
      }

      const job = await jobClient.startJob(config);
      setActiveJob(job);
      setJobStatus(job.status);
      setLogs(job.logs);

      // Lưu ID tiến trình để khôi phục khi reload trang
      localStorage.setItem('activeJobId', job.id);

      const sse = new EventSource(`/api/jobs/${job.id}/events`);
      sseSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const updatedJob: RenderJob = JSON.parse(event.data);
          setActiveJob(updatedJob);
          setJobStatus(updatedJob.status);
          setProgress(updatedJob.progress);
          setElapsedTime(updatedJob.elapsedTime ?? 0);
          setRemainingTime(updatedJob.remainingTime ?? 0);
          setLogs(updatedJob.logs);

          if (updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED' || updatedJob.status === 'CANCELLED') {
            sse.close();
            localStorage.removeItem('activeJobId');
          }
        } catch (e) {
          console.error('Lỗi parse SSE:', e);
        }
      };

      sse.onerror = () => {
        sse.close();
      };
    } catch (err: unknown) {
      console.error(err);
      setJobStatus('FAILED');
      setError(err instanceof Error ? err.message : 'Lỗi kết xuất không xác định');
      setLogs([{
        timestamp: new Date().toISOString(),
        level: 'error',
        message: err instanceof Error ? err.message : 'Lỗi khi khởi chạy'
      }]);
    }
  };

  const handleCancelRender = async () => {
    if (!activeJob) return;
    try {
      await jobClient.cancelJob(activeJob.id);
      if (sseSourceRef.current) {
        sseSourceRef.current.close();
      }
      setJobStatus('CANCELLED');
      localStorage.removeItem('activeJobId');
    } catch (err: unknown) {
      console.error('Hủy job thất bại:', err);
    }
  };

  // Canvas drawing
  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Draw Background (Video or default spheres)
    if (bgVideoRef.current && bgVideoRef.current.readyState >= 2) {
      ctx.save();
      
      // Black background for letterboxing pad bars
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      
      if (config.background.blurPercent > 0) {
        ctx.filter = `blur(${Math.round(config.background.blurPercent * 0.15)}px)`;
      }
      
      // Scale video keeping aspect ratio to fit (matching FFmpeg's force_original_aspect_ratio=decrease)
      const videoW = bgVideoRef.current.videoWidth;
      const videoH = bgVideoRef.current.videoHeight;
      const videoAspect = videoW / videoH;
      const canvasAspect = w / h;
      
      let drawW = w;
      let drawH = h;
      let dx = 0;
      let dy = 0;
      
      if (videoAspect > canvasAspect) {
        drawH = w / videoAspect;
        dy = (h - drawH) / 2;
      } else {
        drawW = h * videoAspect;
        dx = (w - drawW) / 2;
      }
      
      ctx.drawImage(bgVideoRef.current, dx, dy, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0a0d1a';
      ctx.fillRect(0, 0, w, h);

      // Glowing spheres
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.45, h * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.55, h * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Blur overlay
      if (config.background.blurPercent > 0) {
        ctx.fillStyle = `rgba(10, 13, 26, ${config.background.blurPercent / 150})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 2. Draw Image Overlay with selected shape
    // Helper function to interpolate between two hex colors
    const interpolateColor = (color1: string, color2: string, factor: number) => {
      const parseHex = (hex: string) => {
        const cleanHex = hex.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        return { r, g, b };
      };
      try {
        const c1 = parseHex(color1);
        const c2 = parseHex(color2);
        const r = Math.round(c1.r + factor * (c2.r - c1.r));
        const g = Math.round(c1.g + factor * (c2.g - c1.g));
        const b = Math.round(c1.b + factor * (c2.b - c1.b));
        return `rgb(${r}, ${g}, ${b})`;
      } catch (e) {
        return color1;
      }
    };

    // Draw custom image overlay
    const drawImageOverlay = () => {
      if (!config.imageOverlay.enabled) return;

      const drawSingleLayer = (
        imgElement: HTMLImageElement | null,
        cfgX: number,
        cfgY: number,
        cfgW: number,
        cfgH: number,
        cfgRotation: number,
        cfgOpacity: number,
        cfgShape: string,
        cfgFeather: number,
        cfgBounce: boolean
      ) => {
        ctx.save();
        
        const overlayX = (cfgX / 1920) * w;
        const overlayY = (cfgY / 1080) * h;
        
        let bounceScale = 1.0;
        if (cfgBounce) {
          const time = Date.now() * 0.003;
          // Giả lập nhịp giật uốn lượn khớp với sóng âm xem thử
          const rawAmp = 0.2 + 0.6 * Math.sin(time * 1.5) * (0.8 + 0.2 * Math.sin(time * 3.5));
          bounceScale = 1.0 + 0.12 * Math.max(0, rawAmp);
        }

        const imgW = (cfgW / 1920) * w * bounceScale;
        const imgH = (cfgH / 1080) * h * bounceScale;

        ctx.translate(overlayX, overlayY);
        ctx.rotate((cfgRotation * Math.PI) / 180);
        
        ctx.beginPath();
        if (cfgShape === 'circle') {
          ctx.arc(0, 0, Math.min(imgW, imgH) / 2, 0, Math.PI * 2);
        } else if (cfgShape === 'hexagon') {
          const r = Math.min(imgW, imgH) / 2;
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3 - Math.PI / 6;
            ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
          }
          ctx.closePath();
        } else if (cfgShape === 'rect_3_4') {
          const rW = imgH * (3/4);
          ctx.rect(-rW / 2, -imgH / 2, rW, imgH);
        } else if (cfgShape === 'rect_4_3') {
          const rH = imgW * (3/4);
          ctx.rect(-imgW / 2, -rH / 2, imgW, rH);
        } else if (cfgShape === 'square') {
          const r = Math.min(imgW, imgH);
          ctx.rect(-r / 2, -r / 2, r, r);
        } else {
          ctx.rect(-imgW / 2, -imgH / 2, imgW, imgH);
        }

        ctx.globalAlpha = cfgOpacity;

        if (imgElement) {
          ctx.clip();
          // Calculate cropping area to preserve original aspect ratio (Simulating Pillow's ImageOps.fit)
          const imgAspect = imgElement.width / imgElement.height;
          const targetAspect = imgW / imgH;
          let sx = 0, sy = 0, sw = imgElement.width, sh = imgElement.height;
          
          if (imgAspect > targetAspect) {
            // Source image is wider than target area
            sw = imgElement.height * targetAspect;
            sx = (imgElement.width - sw) / 2;
          } else {
            // Source image is taller than target area
            sh = imgElement.width / targetAspect;
            sy = (imgElement.height - sh) / 2;
          }
          ctx.drawImage(imgElement, sx, sy, sw, sh, -imgW / 2, -imgH / 2, imgW, imgH);
        } else {
          ctx.fillStyle = 'rgba(139, 92, 246, 0.15)'; 
          ctx.fill();
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 2;
          ctx.stroke();

          if (cfgFeather > 0) {
            ctx.shadowColor = '#8b5cf6';
            ctx.shadowBlur = cfgFeather;
            ctx.stroke();
          }

          ctx.font = 'bold 12px "Outfit", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('[ẢNH PHỦ ĐÃ LỌC]', 0, 0);
        }

        ctx.restore();
      };

      // 1. Draw multiple simultaneous items
      if (config.imageOverlay.overlayMode === 'custom' && config.imageOverlay.items && config.imageOverlay.items.length > 0) {
        config.imageOverlay.items.forEach(item => {
          if (!item.enabled) return;
          const cachedImg = overlayImagesCacheRef.current.get(item.id) || null;
          drawSingleLayer(
            cachedImg,
            item.x,
            item.y,
            item.width,
            item.height,
            item.rotation,
            item.opacity,
            item.maskShape,
            item.feather,
            item.bounceEnabled || false
          );
        });
        return;
      }

      // 2. Draw fallback single cycle image overlay
      drawSingleLayer(
        overlayImageRef.current,
        config.imageOverlay.x,
        config.imageOverlay.y,
        config.imageOverlay.width,
        config.imageOverlay.height,
        config.imageOverlay.rotation,
        config.imageOverlay.opacity,
        config.imageOverlay.maskShape,
        config.imageOverlay.feather,
        config.imageOverlay.bounceEnabled || false
      );
    };

    // Draw active audio waveform
    const drawWaveform = () => {
      if (!config.waveform.enabled) return;
      ctx.save();
      
      const waveX = (config.waveform.x / 1920) * w;
      const waveY = (config.waveform.y / 1080) * h;
      const waveW = (config.waveform.width / 1920) * w;
      const waveH = (config.waveform.height / 1080) * h;

      const bars = config.waveform.barsCount;
      const lineColor = config.waveform.lineColor;
      const fillColor = config.waveform.fillColor;
      const maxH = config.waveform.maxHeight * 0.45;
      const time = Date.now() * 0.003;

      ctx.translate(waveX, waveY);
      ctx.rotate((config.waveform.rotation * Math.PI) / 180);

      // Pre-compute simulated amplitudes (được nhân với hệ số nhạy để co giãn động theo thanh trượt)
      const amplitudes: number[] = [];
      const sens = config.waveform.sensitivity ?? 1.5;
      for (let i = 0; i < bars; i++) {
        const bellCurve = Math.sin((Math.PI * i) / bars);
        const jitter = 0.85 + 0.15 * Math.sin(time * 0.8 + i * 0.6);
        const rawAmp = 0.2 + 0.6 * Math.sin(time + i * 0.06) * (0.8 + 0.2 * Math.sin(time * 2.5 + i * 0.15));
        amplitudes.push(Math.max(2, rawAmp * bellCurve * jitter * maxH * (sens / 1.5)));
      }

      ctx.lineWidth = config.waveform.barWidth;
      const pathType = config.waveform.path;
      const isFlipped = config.waveform.flip || false;
      
      if (pathType === 'circle') {
        const r = Math.min(waveW, waveH) / 2;
        if (config.waveform.showBaseline) {
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
        }
        const direction = isFlipped ? -1 : 1;
        for (let i = 0; i < bars; i++) {
          const angle = (i * Math.PI * 2) / bars;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const barHeight = amplitudes[i];

          const factor = i / (bars - 1);
          const currentPrimaryColor = config.waveform.gradientEnabled 
            ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
            : lineColor;
          const currentMirrorColor = config.waveform.gradientEnabled
            ? currentPrimaryColor
            : fillColor;

          ctx.strokeStyle = currentPrimaryColor;
          ctx.beginPath();
          ctx.moveTo(r * cos, r * sin);
          ctx.lineTo((r + direction * barHeight) * cos, (r + direction * barHeight) * sin);
          ctx.stroke();

          if (config.waveform.mirror) {
            ctx.strokeStyle = currentMirrorColor;
            ctx.beginPath();
            ctx.moveTo(r * cos, r * sin);
            ctx.lineTo((r - direction * barHeight) * cos, (r - direction * barHeight) * sin);
            ctx.stroke();
          }
        }
      } else if (pathType === 'linear') {
        const startX = -waveW / 2;
        const step = waveW / bars;
        
        if (config.waveform.showBaseline) {
          ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(waveW / 2, 0); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
        }
        const direction = isFlipped ? 1 : -1;

        for (let i = 0; i < bars; i++) {
          const bx = startX + i * step;
          const barHeight = amplitudes[i];

          const factor = i / (bars - 1);
          const currentPrimaryColor = config.waveform.gradientEnabled 
            ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
            : lineColor;
          const currentMirrorColor = config.waveform.gradientEnabled
            ? currentPrimaryColor
            : fillColor;

          ctx.strokeStyle = currentPrimaryColor;
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.lineTo(bx, direction * barHeight);
          ctx.stroke();

          if (config.waveform.mirror) {
            ctx.strokeStyle = currentMirrorColor;
            ctx.beginPath();
            ctx.moveTo(bx, 0);
            ctx.lineTo(bx, -direction * barHeight);
            ctx.stroke();
          }
        }
      } else if (pathType === 'vertical') {
        const startY = -waveH / 2;
        const step = waveH / bars;
        
        if (config.waveform.showBaseline) {
          ctx.beginPath(); ctx.moveTo(0, startY); ctx.lineTo(0, waveH / 2); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
        }
        const direction = isFlipped ? -1 : 1;

        for (let i = 0; i < bars; i++) {
          const by = startY + i * step;
          const barHeight = amplitudes[i];

          const factor = i / (bars - 1);
          const currentPrimaryColor = config.waveform.gradientEnabled 
            ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
            : lineColor;
          const currentMirrorColor = config.waveform.gradientEnabled
            ? currentPrimaryColor
            : fillColor;

          ctx.strokeStyle = currentPrimaryColor;
          ctx.beginPath();
          ctx.moveTo(0, by);
          ctx.lineTo(direction * barHeight, by);
          ctx.stroke();

          if (config.waveform.mirror) {
            ctx.strokeStyle = currentMirrorColor;
            ctx.beginPath();
            ctx.moveTo(0, by);
            ctx.lineTo(-direction * barHeight, by);
            ctx.stroke();
          }
        }
      } else if (pathType === 'square' || pathType === 'rectangle') {
        const boxW = waveW;
        const boxH = waveH;
        const perimeter = 2 * (boxW + boxH);
        const step = perimeter / bars;

        if (config.waveform.showBaseline) {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
        }
        const direction = isFlipped ? -1 : 1;

        for (let i = 0; i < bars; i++) {
          const dist = i * step;
          let bx = 0, by = 0;
          let nx = 0, ny = 0;

          if (dist < boxW) {
            bx = -boxW / 2 + dist; by = -boxH / 2; nx = 0; ny = -1;
          } else if (dist < boxW + boxH) {
            bx = boxW / 2; by = -boxH / 2 + (dist - boxW); nx = 1; ny = 0;
          } else if (dist < 2 * boxW + boxH) {
            bx = boxW / 2 - (dist - boxW - boxH); by = boxH / 2; nx = 0; ny = 1;
          } else {
            bx = -boxW / 2; by = boxH / 2 - (dist - 2 * boxW - boxH); nx = -1; ny = 0;
          }

          const barHeight = amplitudes[i];
          const factor = i / (bars - 1);
          const currentPrimaryColor = config.waveform.gradientEnabled 
            ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
            : lineColor;
          const currentMirrorColor = config.waveform.gradientEnabled
            ? currentPrimaryColor
            : fillColor;
          
          ctx.strokeStyle = currentPrimaryColor;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + nx * direction * barHeight, by + ny * direction * barHeight);
          ctx.stroke();

          if (config.waveform.mirror) {
            ctx.strokeStyle = currentMirrorColor;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - nx * direction * barHeight, by - ny * direction * barHeight);
            ctx.stroke();
          }
        }
      } else if (pathType === 'triangle') {
        const side = waveW;
        const triH = side * (Math.sqrt(3) / 2);
        const p1 = { x: 0, y: -triH / 2 };
        const p2 = { x: side / 2, y: triH / 2 };
        const p3 = { x: -side / 2, y: triH / 2 };

        if (config.waveform.showBaseline) {
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath();
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
        }

        const sides = [
          { from: p1, to: p2, nx: Math.sqrt(3)/2, ny: 0.5 },
          { from: p2, to: p3, nx: 0, ny: 1 },
          { from: p3, to: p1, nx: -Math.sqrt(3)/2, ny: 0.5 }
        ];

        const barsPerSide = Math.floor(bars / 3);
        const direction = isFlipped ? -1 : 1;
        for (let s = 0; s < 3; s++) {
          const sideDef = sides[s];
          for (let b = 0; b < barsPerSide; b++) {
            const t = b / barsPerSide;
            const bx = sideDef.from.x + (sideDef.to.x - sideDef.from.x) * t;
            const by = sideDef.from.y + (sideDef.to.y - sideDef.from.y) * t;
            
            const idx = (s * barsPerSide + b) % bars;
            const barHeight = amplitudes[idx];
            const factor = idx / (bars - 1);
            const currentPrimaryColor = config.waveform.gradientEnabled 
              ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
              : lineColor;
            const currentMirrorColor = config.waveform.gradientEnabled
              ? currentPrimaryColor
              : fillColor;

            ctx.strokeStyle = currentPrimaryColor;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + sideDef.nx * direction * barHeight, by + sideDef.ny * direction * barHeight);
            ctx.stroke();

            if (config.waveform.mirror) {
              ctx.strokeStyle = currentMirrorColor;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx - sideDef.nx * direction * barHeight, by - sideDef.ny * direction * barHeight);
              ctx.stroke();
            }
          }
        }
      } else if (pathType === 'hexagon') {
        const r = Math.min(waveW, waveH) / 2;
        const hexPoints: {x: number, y: number}[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          hexPoints.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
        }

        if (config.waveform.showBaseline) {
          ctx.beginPath(); ctx.moveTo(hexPoints[0].x, hexPoints[0].y);
          for (let i = 1; i < 6; i++) ctx.lineTo(hexPoints[i].x, hexPoints[i].y);
          ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
        }

        const barsPerSide = Math.floor(bars / 6);
        const direction = isFlipped ? -1 : 1;
        for (let s = 0; s < 6; s++) {
          const from = hexPoints[s];
          const to = hexPoints[(s + 1) % 6];
          const midAngle = (s * Math.PI) / 3;
          const nx = Math.cos(midAngle);
          const ny = Math.sin(midAngle);

          for (let b = 0; b < barsPerSide; b++) {
            const t = b / barsPerSide;
            const bx = from.x + (to.x - from.x) * t;
            const by = from.y + (to.y - from.y) * t;
            
            const idx = (s * barsPerSide + b) % bars;
            const barHeight = amplitudes[idx];
            const factor = idx / (bars - 1);
            const currentPrimaryColor = config.waveform.gradientEnabled 
              ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
              : lineColor;
            const currentMirrorColor = config.waveform.gradientEnabled
              ? currentPrimaryColor
              : fillColor;

            ctx.strokeStyle = currentPrimaryColor;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + nx * direction * barHeight, by + ny * direction * barHeight);
            ctx.stroke();

            if (config.waveform.mirror) {
              ctx.strokeStyle = currentMirrorColor;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx - nx * direction * barHeight, by - ny * direction * barHeight);
              ctx.stroke();
            }
          }
        }
      } else if (pathType === 'custom') {
        const startX = -waveW / 2;
        const step = waveW / bars;
        const direction = isFlipped ? 1 : -1;

        for (let i = 0; i < bars; i++) {
          const bx = startX + i * step;
          const by = 20 * Math.sin((i / bars) * 4 * Math.PI + time * 1.8);
          const barHeight = amplitudes[i];
          const factor = i / (bars - 1);
          const currentPrimaryColor = config.waveform.gradientEnabled 
            ? interpolateColor(config.waveform.gradientStart, config.waveform.gradientEnd, factor)
            : lineColor;
          const currentMirrorColor = config.waveform.gradientEnabled
            ? currentPrimaryColor
            : fillColor;

          ctx.strokeStyle = currentPrimaryColor;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx, by + direction * barHeight);
          ctx.stroke();

          if (config.waveform.mirror) {
            ctx.strokeStyle = currentMirrorColor;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx, by - direction * barHeight);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    };

    // Thực hiện vẽ theo Z-index mong muốn (layerOrder) để mang ra trước/sau
    const layerOrder = config.waveform.layerOrder || 'waveform_on_top';
    if (layerOrder === 'image_on_top') {
      drawWaveform();
      drawImageOverlay();
    } else {
      drawImageOverlay();
      drawWaveform();
    }

    // 4. Subtitles
    if (config.subtitles.enabled) {
      // 1. Prepare preview text words based on settings
      let previewText = config.subtitles.previewText || 'Chào mừng bạn đến với WaveForm Studio!';
      const caseOpt = config.subtitles.textCase || 'uppercase';
      
      if (caseOpt === 'uppercase') {
        previewText = previewText.toUpperCase();
      } else if (caseOpt === 'lowercase') {
        previewText = previewText.toLowerCase();
      }
      
      const words = previewText.split(/\s+/).filter(Boolean);
      
      // 2. Set base canvas font properties
      ctx.font = `bold ${config.subtitles.fontSize * 0.45}px ${config.subtitles.fontFamily}`;
      ctx.textBaseline = 'bottom';
      
      const subX = w / 2;
      const subY = h - (config.subtitles.bottomMargin / 1080) * h;
      
      // 3. Animation cycle states
      const cycleDuration = 5000; // 5 seconds cycle
      const timeInCycle = Date.now() % cycleDuration;
      const activeDuration = 3500; // 3.5 seconds to highlight all words
      
      let activeIdx = -1;
      if (timeInCycle < activeDuration) {
        activeIdx = Math.floor((timeInCycle / activeDuration) * words.length);
      } else {
        activeIdx = words.length; // Hold full highlighted state at the end
      }
      
      const effect = config.subtitles.effect || 'none';
      const oneWordMode = config.subtitles.oneWordAtATime || false;
      const pColor = config.subtitles.primaryColor || '#ffff00';
      const sColor = config.subtitles.secondaryColor || '#c0c0c0';
      const oColor = config.subtitles.outlineColor || '#000000';
      
      // HELPER: Draw single word with outline
      const drawTextSegment = (text: string, tx: number, ty: number, color: string, scale: number = 1.0) => {
        ctx.save();
        ctx.translate(tx, ty);
        if (scale !== 1.0) {
          ctx.scale(scale, scale);
        }
        
        ctx.strokeStyle = oColor;
        ctx.lineWidth = 4;
        ctx.strokeText(text, 0, 0);
        
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };
      
      // -------------------------------------------------------------
      // RSVP MODE: ONE WORD AT A TIME (Stable center position)
      // -------------------------------------------------------------
      if (oneWordMode && words.length > 0) {
        // Find active word
        const activeWordIdx = Math.min(words.length - 1, Math.max(0, activeIdx));
        const activeWord = words[activeWordIdx];
        
        let scaleVal = 1.0;
        if (effect === 'pop') {
          // Dynamic scale pop effect
          const wordSlotTime = activeDuration / words.length;
          const wordTimeOffset = timeInCycle % wordSlotTime;
          const pct = wordTimeOffset / wordSlotTime;
          if (pct < 0.3) {
            scaleVal = 1.0 + 0.3 * Math.sin((pct / 0.3) * Math.PI);
          }
        }
        
        ctx.textAlign = 'center';
        // Add solid dark background box if opaque_box is set
        if (effect === 'opaque_box') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const textMetrics = ctx.measureText(activeWord);
          const fontH = config.subtitles.fontSize * 0.55;
          ctx.fillRect(subX - textMetrics.width / 2 - 12, subY - fontH - 4, textMetrics.width + 24, fontH + 8);
        }
        
        drawTextSegment(activeWord, subX, subY, pColor, scaleVal);
      }
      
      // -------------------------------------------------------------
      // NORMAL MODE: FULL SENTENCE DISPLAY WITH AUTO LINE-WRAPPING
      // -------------------------------------------------------------
      else if (words.length > 0) {
        const spaceWidth = ctx.measureText(" ").width;
        const wordMetrics = words.map(w => ctx.measureText(w).width);
        
        // Limit max width of a single line to 80% of canvas width to prevent edge overflow
        const baseMaxLineWidth = w * 0.8;
        
        let linesOfWords: { words: string[]; width: number; startIndex: number }[] = [];
        
        const wrapWords = (limit: number) => {
          const lines: { words: string[]; width: number; startIndex: number }[] = [];
          let currentLine: string[] = [];
          let currentLineWidth = 0;
          
          words.forEach((word, idx) => {
            const wWidth = wordMetrics[idx];
            const wordWidthWithSpace = wWidth + (currentLine.length > 0 ? spaceWidth : 0);
            
            if (currentLineWidth + wordWidthWithSpace > limit && currentLine.length > 0) {
              lines.push({ 
                words: currentLine, 
                width: currentLineWidth,
                startIndex: idx - currentLine.length
              });
              currentLine = [word];
              currentLineWidth = wWidth;
            } else {
              currentLine.push(word);
              currentLineWidth += wordWidthWithSpace;
            }
          });
          if (currentLine.length > 0) {
            lines.push({ 
              words: currentLine, 
              width: currentLineWidth,
              startIndex: words.length - currentLine.length
            });
          }
          return lines;
        };

        linesOfWords = wrapWords(baseMaxLineWidth);
        
        // Enforce maximum of 2 lines by dynamically widening the limit
        if (linesOfWords.length > 2) {
          let tempLimit = baseMaxLineWidth;
          while (linesOfWords.length > 2 && tempLimit < w * 1.5) {
            tempLimit += w * 0.05;
            linesOfWords = wrapWords(tempLimit);
          }
        }
        
        ctx.textAlign = 'left';
        const lineHeight = config.subtitles.fontSize * 0.55;
        
        // Fade effect opacity calculation
        if (effect === 'fade') {
          let opacity = 1.0;
          if (timeInCycle < 500) {
            opacity = timeInCycle / 500;
          } else if (timeInCycle > cycleDuration - 500) {
            opacity = (cycleDuration - timeInCycle) / 500;
          }
          ctx.globalAlpha = opacity;
        }
        
        let wordGlobalIdx = 0;
        linesOfWords.forEach((line, lineIdx) => {
          const lineY = subY - (linesOfWords.length - 1 - lineIdx) * lineHeight;
          let currentX = subX - line.width / 2;
          
          // Add solid dark background box behind each line individually if opaque_box is set
          if (effect === 'opaque_box') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(currentX - 12, lineY - lineHeight + 4, line.width + 24, lineHeight + 4);
          }
          
          line.words.forEach((word) => {
            const idx = wordGlobalIdx;
            const wWidth = wordMetrics[idx];
            
            let color = pColor;
            let scaleVal = 1.0;
            let shouldDraw = true;
            
            if (effect === 'word_reveal') {
              if (idx < activeIdx) {
                color = sColor; // Read words
              } else if (idx === activeIdx) {
                color = pColor; // Active word
              } else {
                shouldDraw = false; // Unread words are hidden
              }
            } else if (effect === 'karaoke') {
              if (idx <= activeIdx) {
                color = pColor;
              } else {
                color = sColor;
              }
            } else if (effect === 'pop') {
              if (idx === activeIdx) {
                color = pColor;
                scaleVal = 1.2;
              } else {
                color = sColor;
              }
            }
            
            if (shouldDraw) {
              drawTextSegment(word, currentX, lineY, color, scaleVal);
            }
            
            currentX += wWidth + spaceWidth;
            wordGlobalIdx++;
          });
        });
        
        ctx.globalAlpha = 1.0;
      }
    }

    // 5. Camera
    if (config.camera.enabled) {
      const cStyle = config.camera.style || 'classic_rec';
      const cColor = config.camera.color || '#ffffff';
      const rawPadding = config.camera.padding !== undefined ? config.camera.padding : 30;
      const rawThickness = config.camera.thickness !== undefined ? config.camera.thickness : 3;
      const rawScale = config.camera.scale !== undefined ? config.camera.scale : 1.0;

      // Scale relative to canvas size vs 1920 width
      const resScale = w / 1920;
      const padding = rawPadding * resScale;
      const thickness = Math.max(1, rawThickness * resScale);
      const scale = rawScale * resScale;

      ctx.strokeStyle = cColor;
      ctx.lineWidth = thickness;

      // STYLE 1: CLASSIC CAMERA REC HUD
      if (cStyle === 'classic_rec') {
        if (config.camera.showCorners) {
          const cl = 45 * scale;
          ctx.beginPath(); ctx.moveTo(padding, padding + cl); ctx.lineTo(padding, padding); ctx.lineTo(padding + cl, padding); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(w - padding, padding + cl); ctx.lineTo(w - padding, padding); ctx.lineTo(w - padding - cl, padding); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(padding, h - padding - cl); ctx.lineTo(padding, h - padding); ctx.lineTo(padding + cl, h - padding); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(w - padding, h - padding - cl); ctx.lineTo(w - padding, h - padding); ctx.lineTo(w - padding - cl, h - padding); ctx.stroke();
        }

        if (config.camera.showRecText) {
          ctx.font = `bold ${Math.round(26 * scale)}px monospace`;
          ctx.fillStyle = '#ef4444';
          ctx.textAlign = 'left';
          ctx.fillText('REC', padding + 50 * scale, padding + 34 * scale);

          if (config.camera.showBlinkingDot && Math.floor(Date.now() / 1000) % 2 === 0) {
            ctx.beginPath();
            ctx.arc(padding + 30 * scale, padding + 26 * scale, 6 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
          }
        }

        if (config.camera.showBattery) {
          const bx = w - padding - 60 * scale;
          const by = padding + 12 * scale;
          const bw = 40 * scale;
          const bh = 18 * scale;
          ctx.strokeStyle = cColor;
          ctx.lineWidth = Math.max(1, 2 * scale);
          ctx.strokeRect(bx, by, bw, bh);
          ctx.fillStyle = cColor;
          ctx.fillRect(bx + bw, by + 4 * scale, 3 * scale, bh - 8 * scale);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(bx + 3 * scale, by + 3 * scale, bw - 6 * scale, bh - 6 * scale);
        }

        if (config.camera.showTimecode) {
          ctx.font = `bold ${Math.round(20 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.globalAlpha = 0.7;
          ctx.textAlign = 'center';
          ctx.fillText('TC 00:00:18:24', w / 2, h - padding - 20 * scale);
          ctx.globalAlpha = 1.0;
        }
      }
      
      // STYLE 2: MODERN CINEMATIC HUD
      else if (cStyle === 'modern_cinema') {
        if (config.camera.showCorners) {
          // Draw thin rectangle box
          ctx.strokeStyle = cColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);
          ctx.globalAlpha = 1.0;

          // Corner tick marks
          const sz = 20 * scale;
          ctx.beginPath();
          ctx.moveTo(padding + sz, padding); ctx.lineTo(padding + sz, padding + sz);
          ctx.moveTo(w - padding - sz, padding); ctx.lineTo(w - padding - sz, padding + sz);
          ctx.moveTo(padding + sz, h - padding); ctx.lineTo(padding + sz, h - padding - sz);
          ctx.moveTo(w - padding - sz, h - padding); ctx.lineTo(w - padding - sz, h - padding - sz);
          ctx.stroke();
        }

        // Center crosshairs
        const cx = w / 2;
        const cy = h / 2;
        const r = 18 * scale;
        
        ctx.strokeStyle = cColor;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = cColor;
        ctx.globalAlpha = 1.0;
        ctx.fill();

        ctx.strokeStyle = cColor;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - r - 10, cy); ctx.lineTo(cx - r + 4, cy);
        ctx.moveTo(cx + r - 4, cy); ctx.lineTo(cx + r + 10, cy);
        ctx.moveTo(cx, cy - r - 10); ctx.lineTo(cx, cy - r + 4);
        ctx.moveTo(cx, cy + r - 4); ctx.lineTo(cx, cy + r + 10);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        if (config.camera.showRecText) {
          ctx.font = `${Math.round(14 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'left';
          ctx.fillText('RAW 4K DCI', padding + 15 * scale, padding + 25 * scale);
          ctx.globalAlpha = 0.6;
          ctx.fillText('LUT: CINEMA_GOLD', padding + 15 * scale, padding + 42 * scale);
          ctx.globalAlpha = 1.0;
        }

        if (config.camera.showBattery) {
          ctx.font = `${Math.round(14 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'right';
          ctx.fillText('FPS 24.000', w - padding - 15 * scale, padding + 25 * scale);
          ctx.globalAlpha = 0.6;
          ctx.fillText('1/48s  F2.8', w - padding - 15 * scale, padding + 42 * scale);
          ctx.globalAlpha = 1.0;
        }

        if (config.camera.showTimecode) {
          ctx.font = `bold ${Math.round(16 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'center';
          ctx.fillText('A-CAM  00:00:12:00', w / 2, h - padding - 15 * scale);
        }
      }

      // STYLE 3: VLOGGER DSLR HUD
      else if (cStyle === 'vlogger_dslr') {
        if (config.camera.showCorners) {
          const box_w = 220 * scale;
          const box_h = 140 * scale;
          const sz = 20 * scale;
          const cx = w / 2;
          const cy = h / 2;
          const x1 = cx - box_w / 2;
          const y1 = cy - box_h / 2;
          const x2 = cx + box_w / 2;
          const y2 = cy + box_h / 2;

          ctx.strokeStyle = cColor;
          ctx.lineWidth = 2;
          // AF Corners
          ctx.beginPath();
          ctx.moveTo(x1, y1 + sz); ctx.lineTo(x1, y1); ctx.lineTo(x1 + sz, y1);
          ctx.moveTo(x2, y1 + sz); ctx.lineTo(x2, y1); ctx.lineTo(x2 - sz, y1);
          ctx.moveTo(x1, y2 - sz); ctx.lineTo(x1, y2); ctx.lineTo(x1 + sz, y2);
          ctx.moveTo(x2, y2 - sz); ctx.lineTo(x2, y2); ctx.lineTo(x2 - sz, y2);
          ctx.stroke();

          // Target [ ]
          ctx.strokeStyle = cColor;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy - 6); ctx.lineTo(cx - 10, cy + 6);
          ctx.moveTo(cx + 10, cy - 6); ctx.lineTo(cx + 10, cy + 6);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        // EV Meter on Left Side
        const ex = padding + 15 * scale;
        const ey = h / 2;
        const eh = 120 * scale;
        ctx.strokeStyle = cColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ex, ey - eh / 2); ctx.lineTo(ex, ey + eh / 2);
        ctx.stroke();

        ctx.font = `${Math.round(12 * scale)}px monospace`;
        ctx.fillStyle = cColor;
        ctx.textAlign = 'left';
        for (let i = -2; i <= 2; i++) {
          const ty = ey + i * (eh / 4);
          ctx.beginPath();
          ctx.moveTo(ex, ty); ctx.lineTo(ex + 6 * scale, ty);
          ctx.stroke();
          ctx.fillText(`${i > 0 ? '+' : ''}${i}`, ex + 10 * scale, ty + 4 * scale);
        }
        ctx.globalAlpha = 1.0;

        // EV pointer red arrow
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(ex - 8, ey);
        ctx.lineTo(ex - 2, ey - 4);
        ctx.lineTo(ex - 2, ey + 4);
        ctx.fill();

        if (config.camera.showRecText) {
          ctx.font = `${Math.round(14 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'left';
          ctx.fillText('ISO 800  1/125s  F4.0', padding + 20 * scale, h - padding - 15 * scale);
        }

        if (config.camera.showBattery) {
          ctx.font = `${Math.round(14 * scale)}px monospace`;
          ctx.fillStyle = '#10b981';
          ctx.textAlign = 'right';
          ctx.fillText('• AF-S [AUTO]', w - padding - 20 * scale, h - padding - 15 * scale);
        }

        if (config.camera.showTimecode) {
          ctx.font = `bold ${Math.round(24 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'center';
          ctx.fillText('0:02:14', w / 2, padding + 24 * scale);
        }
      }

      // STYLE 4: RETRO VHS CAMCORDER
      else if (cStyle === 'retro_vhs') {
        if (config.camera.showCorners) {
          const sz = 30 * scale;
          ctx.strokeStyle = cColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(padding, padding + sz); ctx.lineTo(padding, padding); ctx.lineTo(padding + sz, padding);
          ctx.moveTo(w - padding, padding + sz); ctx.lineTo(w - padding, padding); ctx.lineTo(w - padding - sz, padding);
          ctx.moveTo(padding, h - padding - sz); ctx.lineTo(padding, h - padding); ctx.lineTo(padding + sz, h - padding);
          ctx.moveTo(w - padding, h - padding - sz); ctx.lineTo(w - padding, h - padding); ctx.lineTo(w - padding - sz, h - padding);
          ctx.stroke();
        }

        if (config.camera.showRecText) {
          ctx.font = `bold ${Math.round(24 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'left';
          ctx.fillText('PLAY ▶', padding + 20 * scale, padding + 30 * scale);
          ctx.font = `${Math.round(16 * scale)}px monospace`;
          ctx.globalAlpha = 0.7;
          ctx.fillText('SP 0:00:00', padding + 20 * scale, padding + 54 * scale);
          ctx.globalAlpha = 1.0;
        }

        if (config.camera.showBattery) {
          ctx.font = `bold ${Math.round(18 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'right';
          ctx.fillText('🔋 100%', w - padding - 20 * scale, padding + 30 * scale);
        }

        if (config.camera.showTimecode) {
          ctx.font = `bold ${Math.round(24 * scale)}px monospace`;
          ctx.fillStyle = cColor;
          ctx.textAlign = 'left';
          ctx.fillText('MAY 31 2026', padding + 20 * scale, h - padding - 30 * scale);

          ctx.textAlign = 'right';
          ctx.fillText('12:00:15', w - padding - 20 * scale, h - padding - 30 * scale);
        }

        // Glitches
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding + 10, h - padding + 5); ctx.lineTo(w - padding - 10, h - padding + 5);
        ctx.moveTo(padding + 10, h - padding + 12); ctx.lineTo(w - padding - 10, h - padding + 12);
        ctx.stroke();
      }
    }
  };

  const renderBreadcrumbs = () => {
    if (!currentDirPath) return <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Ổ đĩa máy tính</span>;
    const parts = currentDirPath.split('\\').filter(Boolean);
    const crumbs: { name: string; path: string }[] = [];
    
    let accumulated = '';
    parts.forEach((part) => {
      if (part.endsWith(':')) {
        accumulated = part + '\\';
      } else {
        accumulated = accumulated + (accumulated.endsWith('\\') ? '' : '\\') + part;
      }
      crumbs.push({ name: part, path: accumulated });
    });
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <span 
          onClick={() => setCurrentDirPath('')}
          style={{ color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          Máy tính
        </span>
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span style={{ color: 'var(--text-muted)' }}>➔</span>
            <span 
              onClick={() => setCurrentDirPath(crumb.path)}
              style={{
                color: idx === crumbs.length - 1 ? 'var(--neon-rose)' : '#38bdf8',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                if (idx !== crumbs.length - 1) e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {crumb.name}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (!hasMounted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0a0d1a',
        color: '#ffffff',
        fontFamily: 'monospace'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(139, 92, 246, 0.1)',
            borderTop: '4px solid #8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <span>ĐANG NẠP CẤU HÌNH HỆ THỐNG...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ gap: '24px' }}>
      
      {/* Top navbar (56px unified) */}
      <nav className="global-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px', color: 'var(--text-pure)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={18} style={{ color: 'var(--neon-purple)', filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.6))' }} />
            <span style={{ fontFamily: 'Inter', fontWeight: 800 }}>WaveForm Edit Studio</span>
          </div>
          <div style={{ width: '1.5px', height: '14px', background: 'var(--border-neon)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'Space Mono', color: 'var(--text-muted)' }}>
            <span>✍️ Tác giả:</span>
            <strong style={{ color: 'var(--text-pure)', fontWeight: 'bold' }}>Khánh, Sang, An Lê</strong>
          </div>
        </div>
        
        {/* Right side: Preset controls and Theme toggle integrated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          {/* Preset controls */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            background: 'rgba(124, 58, 237, 0.05)',
            border: '1.5px solid var(--border-neon)',
            borderRadius: '8px',
            padding: '4px 12px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderOpen size={14} style={{ color: 'var(--neon-purple)' }} />
              <select
                value={selectedPresetName}
                onChange={(e) => handleLoadPreset(e.target.value)}
                className="form-select"
                style={{ 
                  width: '160px', 
                  padding: '4px 8px', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  backgroundColor: 'transparent', 
                  border: 'none',
                  color: 'var(--text-pure)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {Object.keys(presets).map((name) => (
                  <option key={name} value={name} style={{ backgroundColor: 'var(--bg-space)', color: 'var(--text-pure)' }}>{name}</option>
                ))}
              </select>
            </div>
            
            {selectedPresetName !== 'Mặc định' && (
              <div style={{ height: '14px', width: '1px', background: 'var(--border-light)' }}></div>
            )}

            {selectedPresetName !== 'Mặc định' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleOverwritePreset(selectedPresetName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#10b981',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '700',
                    transition: 'all 200ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#10b981';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    e.currentTarget.style.color = '#10b981';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Save size={11} />
                  Lưu
                </button>
                
                <button
                  onClick={() => handleDeletePreset(selectedPresetName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(225, 29, 72, 0.3)',
                    background: 'rgba(225, 29, 72, 0.08)',
                    color: 'var(--neon-rose)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '700',
                    transition: 'all 200ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--neon-rose)';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(225, 29, 72, 0.3)';
                    e.currentTarget.style.color = 'var(--neon-rose)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <X size={11} />
                  Xóa
                </button>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-light)' }}></div>
          
          <button 
            onClick={() => setIsGuideOpen(true)}
            style={{
              background: theme === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.06)',
              border: theme === 'dark' ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(79, 70, 229, 0.15)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: theme === 'dark' ? '#a5b4fc' : 'var(--neon-indigo)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--neon-purple)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.06)';
              e.currentTarget.style.color = theme === 'dark' ? '#a5b4fc' : 'var(--neon-indigo)';
              e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.15)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <HelpCircle size={11} />
            📖 Hướng dẫn
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-light)' }}></div>
          
          <button 
            onClick={toggleTheme}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'var(--text-bright)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--neon-purple)';
              e.currentTarget.style.boxShadow = '0 0 8px rgba(139, 92, 246, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
          </button>
        </div>
      </nav>

      {/* Main Grid */}
      <main style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Section: Live Preview & Progress Metrics */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Glowing Preview Card */}
          <div 
            className="store-card" 
            style={{ 
              padding: '16px', 
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: 'var(--bg-deep-card)',
              border: '1px solid var(--border-neon)'
            }}
          >
            {/* Monitor Header Row (Outside Preview Canvas) */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid var(--border-light)', 
              paddingBottom: '10px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={13} style={{ color: 'var(--neon-purple)', filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))' }} />
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-pure)', letterSpacing: '0.8px', fontFamily: 'Inter' }}>
                  TRÌNH PHÁT MÔ PHỎNG LIVE
                </span>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                <span className="live-pulse" style={{ display: 'inline-block', width: '5px', height: '5px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 6px #10b981' }}></span>
                <span style={{ fontSize: '9px', fontFamily: 'Space Mono', color: '#10b981', fontWeight: 'bold', letterSpacing: '0.5px' }}>READY</span>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <canvas
                ref={canvasRef}
                width={1024}
                height={576}
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  backgroundColor: '#000000',
                  display: 'block'
                }}
              />
            </div>
          </div>

          {/* Render Controls */}
          <RenderControls 
            onStart={handleStartRender}
            onCancel={handleCancelRender}
            status={jobStatus}
          />

          {/* Render Progress */}
          <div id="render-progress-section">
            <RenderProgress 
              progress={progress}
              status={jobStatus}
              elapsedTime={elapsedTime}
              remainingTime={remainingTime}
              error={error}
              outputFilename={config.media.outputFilename}
              theme={theme}
            />
          </div>

          {/* Nhật ký xuất video (Logs) - Hiển thị trực tiếp, tối ưu hóa giao diện phẳng, hiện đại */}
          <div id="system-logs-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }} className="fade-in-el">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Terminal size={18} style={{ color: 'var(--neon-purple)', filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))' }} />
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-pure)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Space Mono' }}>
                  Nhật ký xuất video (System Logs)
                </span>
              </div>
              <span className="live-pulse" style={{ fontSize: '10px', color: 'var(--neon-purple)', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '10px', fontFamily: 'Space Mono', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                ● LIVE MONITOR
              </span>
            </div>
            <LogConsole logs={logs} />
          </div>

        </section>

        {/* Right Section: Form Configuration Accordions */}
        <section 
          className="store-card" 
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          {/* Tabs */}
          <div 
            style={{ 
              display: 'flex', 
              gap: '4px', 
              overflowX: 'auto', 
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-light)'
            }}
          >
            {['media', 'background', 'overlay', 'waveform', 'subtitles', 'camera', 'removebg', 'render'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveConfigTab(tab as ConfigTab)}
                className={`tab-button ${activeConfigTab === tab ? 'active' : ''}`}
                style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                {tab === 'media' && <Music size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'media' && 'Tập tin nguồn'}
                
                {tab === 'background' && <Video size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'background' && 'Nền'}
                
                {tab === 'overlay' && <ImageIcon size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'overlay' && 'Ảnh phủ'}
                
                {tab === 'waveform' && <Sliders size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'waveform' && 'Sóng âm'}
                
                {tab === 'subtitles' && <Type size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'subtitles' && 'Phụ đề'}
                
                {tab === 'camera' && <Camera size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'camera' && 'Khung'}
                
                {tab === 'render' && <Settings size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.6))' : 'none' }} />}
                {tab === 'render' && 'Cấu hình'}

                {tab === 'removebg' && <FileImage size={14} style={{ filter: activeConfigTab === tab ? 'drop-shadow(0 0 3px rgba(225, 29, 72, 0.6))' : 'none' }} />}
                {tab === 'removebg' && 'Xóa nền'}
              </button>
            ))}
          </div>

          {/* Form Content - High contrast labels */}
          <div className="fade-in-el" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Tab 1: Resources with local browse trigger */}
            {activeConfigTab === 'media' && (
              <>
                <div 
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.04)',
                    border: '1px dashed rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginBottom: '10px',
                    boxShadow: 'inset 0 0 10px rgba(16, 185, 129, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--neon-emerald)', fontFamily: 'var(--font-mono)' }}>
                      ⚡ KHỞI TẠO DỰ ÁN NHANH (AUTO-SCAN PROJECT FOLDER)
                    </span>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                      Chọn thư mục mẹ của dự án. Hệ thống sẽ tự động quét các thư mục con <strong>Voice</strong>, <strong>Video</strong>, <strong>Image</strong>, <strong>Music</strong> để thiết lập cấu hình Studio chỉ trong 1 Click!
                    </p>
                  </div>
                  <button
                    onClick={handleStartScanProjectMode}
                    disabled={isScanningProject}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--neon-emerald)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                      transition: 'all 200ms ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.15)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = 'brightness(1)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.35)';
                    }}
                  >
                    <FolderOpen size={14} />
                    {isScanningProject ? 'ĐANG TỰ ĐỘNG QUÉT DỰ ÁN...' : 'QUÉT THƯ MỤC DỰ ÁN MẸ'}
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                    TẸP GIỌNG ĐỌC CHÍNH (VOICEFILE)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={config.media.voiceFile}
                      readOnly
                      className="form-input"
                      style={{ flex: 1, color: '#38bdf8', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                    <button
                      onClick={() => openPathBrowser('voiceFile', 'file')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-neon)',
                        background: 'rgba(225, 29, 72, 0.08)',
                        color: 'var(--neon-rose)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                        e.currentTarget.style.borderColor = 'var(--border-neon)';
                        e.currentTarget.style.color = 'var(--neon-rose)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                      }}
                    >
                      Duyệt tệp...
                    </button>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                    VIDEO NỀN (BACKGROUNDVIDEOS)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={config.media.backgroundVideos.join(', ')}
                      readOnly
                      className="form-input"
                      style={{ flex: 1, color: '#38bdf8', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                    <button
                      onClick={() => openPathBrowser('backgroundVideos', 'file')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-neon)',
                        background: 'rgba(225, 29, 72, 0.08)',
                        color: 'var(--neon-rose)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                        e.currentTarget.style.borderColor = 'var(--border-neon)';
                        e.currentTarget.style.color = 'var(--neon-rose)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                      }}
                    >
                      Duyệt tệp...
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                    ẢNH PHỦ TRANG TRÍ (OVERLAYIMAGES)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Chưa chọn ảnh phủ nào. Click 'Thêm ảnh...' bên phải để thêm."
                      value={config.media.overlayImages.join(', ')}
                      readOnly
                      className="form-input"
                      style={{ flex: 1, color: '#38bdf8', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                    <button
                      onClick={() => openPathBrowser('overlayImages', 'file')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-neon)',
                        background: 'rgba(225, 29, 72, 0.08)',
                        color: 'var(--neon-rose)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                        e.currentTarget.style.borderColor = 'var(--border-neon)';
                        e.currentTarget.style.color = 'var(--neon-rose)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                      }}
                    >
                      Thêm ảnh...
                    </button>
                  </div>

                  {config.media.overlayImages.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginBottom: '10px'
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Danh sách tệp ảnh phủ ({config.media.overlayImages.length}):
                      </span>
                      {config.media.overlayImages.map((path, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono)',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.03)'
                        }}>
                          <span style={{ color: idx === activeOverlayIdx ? 'var(--neon-rose)' : 'var(--text-pure)', fontWeight: idx === activeOverlayIdx ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            [{idx + 1}] {path.split('\\').pop() || path} {idx === activeOverlayIdx ? '⚡ (Đang xem thử)' : ''}
                          </span>
                          <button
                            onClick={() => {
                              const updated = config.media.overlayImages.filter((_, i) => i !== idx);
                              setConfig({
                                ...config,
                                media: { ...config.media, overlayImages: updated }
                              });
                              if (activeOverlayIdx >= updated.length) {
                                setActiveOverlayIdx(Math.max(0, updated.length - 1));
                              }
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              color: '#ef4444',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              cursor: 'pointer',
                              fontWeight: '700',
                              fontSize: '11px',
                              transition: 'all 150ms ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#ef4444';
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                    NHẠC NỀN LỒNG (MUSICFILES)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={config.media.musicFiles.join(', ')}
                      readOnly
                      className="form-input"
                      style={{ flex: 1, color: '#38bdf8', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                    <button
                      onClick={() => openPathBrowser('musicFiles', 'file')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-neon)',
                        background: 'rgba(225, 29, 72, 0.08)',
                        color: 'var(--neon-rose)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                        e.currentTarget.style.borderColor = 'var(--border-neon)';
                        e.currentTarget.style.color = 'var(--neon-rose)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                      }}
                    >
                      Duyệt tệp...
                    </button>
                  </div>
                </div>

                <div className="slider-container" style={{ marginTop: '12px', marginBottom: '14px' }}>
                  <div className="slider-header">
                    <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>Âm lượng giọng đọc (Voice Volume)</span>
                    <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{Math.round((config.voiceVolume !== undefined ? config.voiceVolume : 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    value={config.voiceVolume !== undefined ? config.voiceVolume : 1.0}
                    onChange={(e) => setConfig({
                      ...config,
                      voiceVolume: Number(e.target.value)
                    })}
                    className="slider-input"
                  />
                </div>

                <div className="slider-container" style={{ marginTop: '0px', marginBottom: '16px' }}>
                  <div className="slider-header">
                    <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>Âm lượng nhạc nền (Music Volume)</span>
                    <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{Math.round((config.musicVolume !== undefined ? config.musicVolume : 0.5) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    value={config.musicVolume !== undefined ? config.musicVolume : 0.5}
                    onChange={(e) => setConfig({
                      ...config,
                      musicVolume: Number(e.target.value)
                    })}
                    className="slider-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', backgroundColor: 'var(--color-secondary)', border: '1px solid var(--border-light)', borderRadius: '10px', marginTop: '-10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={config.musicLoop !== undefined ? config.musicLoop : true}
                        onChange={(e) => setConfig({
                          ...config,
                          musicLoop: e.target.checked
                        })}
                        className="checkbox-input"
                      />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-pure)' }}>Lặp lại nhạc liên tục</span>
                    </label>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-pure)', whiteSpace: 'nowrap' }}>Tự tắt nhạc sau:</span>
                    <input
                      type="number"
                      min={0}
                      max={7200}
                      value={config.musicDuration !== undefined ? config.musicDuration : 0}
                      onChange={(e) => setConfig({
                        ...config,
                        musicDuration: Number(e.target.value)
                      })}
                      className="form-input"
                      style={{ width: '80px', padding: '4px 8px', fontSize: '12px', height: '28px', textAlign: 'center', backgroundColor: 'var(--bg-input)' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>giây (0 = chạy hết)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                    THƯ MỤC / TÊN VIDEO XUẤT RA (OUTPUTFILENAME)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={config.media.outputFilename}
                      readOnly
                      className="form-input"
                      style={{ flex: 1, color: '#38bdf8', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                    <button
                      onClick={() => openPathBrowser('outputFilename', 'dir')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-neon)',
                        background: 'rgba(225, 29, 72, 0.08)',
                        color: 'var(--neon-rose)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                        e.currentTarget.style.borderColor = 'var(--border-neon)';
                        e.currentTarget.style.color = 'var(--neon-rose)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                      }}
                    >
                      Chọn thư mục...
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Tab 2: Nền */}
            {activeConfigTab === 'background' && (
              <>
                <div className="slider-container">
                  <div className="slider-header">
                    <span style={{ color: '#ffffff' }}>Độ mờ nền (blurPercent)</span>
                    <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.background.blurPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={config.background.blurPercent}
                    onChange={(e) => setConfig({
                      ...config,
                      background: { ...config.background, blurPercent: Number(e.target.value) }
                    })}
                    className="slider-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff' }}>Phương thức mờ (blurMode)</label>
                  <select
                    value={config.background.blurMode}
                    onChange={(e) => setConfig({
                      ...config,
                      background: { ...config.background, blurMode: e.target.value as 'fast' | 'quality' }
                    })}
                    className="form-select"
                  >
                    <option value="fast">Mờ nhanh (BoxBlur 4x - Tối ưu 4 lần)</option>
                    <option value="quality">Mờ mượt mà (Quality BoxBlur)</option>
                  </select>
                </div>

                <div className="slider-container">
                  <div className="slider-header">
                    <span style={{ color: '#ffffff' }}>Thời lượng chuyển cảnh xfade</span>
                    <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.background.transitionDuration}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    value={config.background.transitionDuration}
                    onChange={(e) => setConfig({
                      ...config,
                      background: { ...config.background, transitionDuration: Number(e.target.value) }
                    })}
                    className="slider-input"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={config.background.randomVideoOrder}
                      onChange={(e) => setConfig({
                        ...config,
                        background: { ...config.background, randomVideoOrder: e.target.checked }
                      })}
                      className="checkbox-input"
                    />
                    <span>Trình tự phát video ngẫu nhiên</span>
                  </label>

                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={config.background.fillTimeline}
                      onChange={(e) => setConfig({
                        ...config,
                        background: { ...config.background, fillTimeline: e.target.checked }
                      })}
                      className="checkbox-input"
                    />
                    <span>Lặp video nền lấp đầy dòng thời gian chính</span>
                  </label>
                </div>
              </>
            )}

            {/* Tab 3: Ảnh phủ */}
            {activeConfigTab === 'overlay' && (
              <>
                <label className="checkbox-container" style={{ marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    checked={config.imageOverlay.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      imageOverlay: { ...config.imageOverlay, enabled: e.target.checked }
                    })}
                    className="checkbox-input"
                  />
                  <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Kích hoạt lớp ảnh phủ (Image Overlay)</span>
                </label>

                {config.imageOverlay.enabled && (
                  <>
                    {/* Bảng chọn Chế độ Ảnh Phủ */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label className="form-label" style={{ color: '#ffffff', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.5px' }}>
                        CHẾ ĐỘ LỚP ẢNH PHỦ (OVERLAY MODE)
                      </label>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                        <button
                          onClick={() => setConfig({
                            ...config,
                            imageOverlay: { ...config.imageOverlay, overlayMode: 'cycle' }
                          })}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: config.imageOverlay.overlayMode !== 'custom' ? 'var(--neon-purple)' : (theme === 'light' ? 'var(--border-light)' : 'rgba(255,255,255,0.08)'),
                            background: config.imageOverlay.overlayMode !== 'custom' ? (theme === 'light' ? 'var(--neon-purple)' : 'rgba(139, 92, 246, 0.15)') : 'transparent',
                            color: config.imageOverlay.overlayMode !== 'custom' ? '#ffffff' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '700',
                            textAlign: 'center',
                            transition: 'all 200ms ease',
                            boxShadow: config.imageOverlay.overlayMode !== 'custom' ? '0 0 10px rgba(139, 92, 246, 0.25)' : 'none'
                          }}
                        >
                          🔄 Xoay vòng ảnh (Cycle Mode)
                        </button>
                        <button
                          onClick={() => setConfig({
                            ...config,
                            imageOverlay: { ...config.imageOverlay, overlayMode: 'custom' }
                          })}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: config.imageOverlay.overlayMode === 'custom' ? 'var(--neon-purple)' : (theme === 'light' ? 'var(--border-light)' : 'rgba(255,255,255,0.08)'),
                            background: config.imageOverlay.overlayMode === 'custom' ? (theme === 'light' ? 'var(--neon-purple)' : 'rgba(139, 92, 246, 0.15)') : 'transparent',
                            color: config.imageOverlay.overlayMode === 'custom' ? '#ffffff' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '700',
                            textAlign: 'center',
                            transition: 'all 200ms ease',
                            boxShadow: config.imageOverlay.overlayMode === 'custom' ? '0 0 10px rgba(139, 92, 246, 0.25)' : 'none'
                          }}
                        >
                          🖼️ Nhiều ảnh đồng thời (Custom Layout)
                        </button>
                      </div>
                    </div>

                    {/* CHẾ ĐỘ 1: ĐỔI ẢNH XOAY VÒNG (CYCLE MODE) */}
                    {config.imageOverlay.overlayMode !== 'custom' && (
                      <>
                        {config.media.overlayImages.length > 0 && (
                          <div style={{
                            padding: '14px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                📸 ẢNH ĐANG XEM THỬ ({activeOverlayIdx + 1}/{config.media.overlayImages.length})
                              </span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => setActiveOverlayIdx(prev => Math.max(0, prev - 1))}
                                  disabled={activeOverlayIdx === 0}
                                  style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#ffffff', cursor: 'pointer' }}
                                >
                                  Trước
                                </button>
                                <button
                                  onClick={() => setActiveOverlayIdx(prev => Math.min(config.media.overlayImages.length - 1, prev + 1))}
                                  disabled={activeOverlayIdx === config.media.overlayImages.length - 1}
                                  style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#ffffff', cursor: 'pointer' }}
                                >
                                  Sau
                                </button>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--neon-rose)', fontWeight: 'bold', wordBreak: 'break-all' }}>
                              {config.media.overlayImages[activeOverlayIdx]?.split('\\').pop() || config.media.overlayImages[activeOverlayIdx]}
                            </span>
                            
                            <button
                              onClick={() => handleOpenInRembgTab(config.media.overlayImages[activeOverlayIdx])}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-neon)',
                                backgroundColor: 'rgba(225, 29, 72, 0.08)',
                                color: 'var(--neon-rose)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: '700',
                                boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                                transition: 'all 200ms ease',
                                marginTop: '4px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--neon-rose)';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                                e.currentTarget.style.color = 'var(--neon-rose)';
                                e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                              }}
                            >
                              ✨ Chuyển sang Tab Xóa Nền AI...
                            </button>
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label" style={{ color: '#ffffff' }}>Mặt nạ cắt viền ảnh (maskShape)</label>
                          <select
                            value={config.imageOverlay.maskShape}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, maskShape: e.target.value as any }
                            })}
                            className="form-select"
                          >
                            <option value="circle">Mặt nạ tròn (Circle)</option>
                            <option value="hexagon">Mặt nạ hình lục giác (Hexagon)</option>
                            <option value="rectangle">Hình chữ nhật gốc (Rectangle)</option>
                            <option value="rect_3_4">Khung đứng đứng (3:4)</option>
                            <option value="rect_4_3">Khung đứng ngang (4:3)</option>
                            <option value="square">Khung vuông (Square)</option>
                          </select>
                        </div>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: '#ffffff' }}>Độ nhòe mịn viền cắt (feather)</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.feather}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={50}
                            value={config.imageOverlay.feather}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, feather: Number(e.target.value) }
                            })}
                            className="slider-input"
                          />
                        </div>

                        <label className="checkbox-container" style={{ marginTop: '12px', marginBottom: '8px' }}>
                          <input
                            type="checkbox"
                            checked={config.imageOverlay.lockAspectRatio || false}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, lockAspectRatio: e.target.checked }
                            })}
                            className="checkbox-input"
                          />
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>Khóa tỷ lệ khung hình khi kéo (Lock Aspect Ratio)</span>
                        </label>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: '#ffffff' }}>Chiều rộng hình ảnh (width)</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.width}px</span>
                          </div>
                          <input
                            type="range"
                            min={100}
                            max={1920}
                            value={config.imageOverlay.width}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (config.imageOverlay.lockAspectRatio) {
                                const ratio = config.imageOverlay.height / config.imageOverlay.width;
                                setConfig({
                                  ...config,
                                  imageOverlay: {
                                    ...config.imageOverlay,
                                    width: val,
                                    height: Math.round(val * ratio)
                                  }
                                });
                              } else {
                                setConfig({
                                  ...config,
                                  imageOverlay: { ...config.imageOverlay, width: val }
                                });
                              }
                            }}
                            className="slider-input"
                          />
                        </div>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: '#ffffff' }}>Chiều cao hình ảnh (height)</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.height}px</span>
                          </div>
                          <input
                            type="range"
                            min={100}
                            max={1080}
                            value={config.imageOverlay.height}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (config.imageOverlay.lockAspectRatio) {
                                const ratio = config.imageOverlay.width / config.imageOverlay.height;
                                setConfig({
                                  ...config,
                                  imageOverlay: {
                                    ...config.imageOverlay,
                                    height: val,
                                    width: Math.round(val * ratio)
                                  }
                                });
                              } else {
                                setConfig({
                                  ...config,
                                  imageOverlay: { ...config.imageOverlay, height: val }
                                });
                              }
                            }}
                            className="slider-input"
                          />
                        </div>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: '#ffffff' }}>Vị trí ảnh theo chiều ngang (X)</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.x}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1920}
                            value={config.imageOverlay.x}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, x: Number(e.target.value) }
                            })}
                            className="slider-input"
                          />
                        </div>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: '#ffffff' }}>Vị trí ảnh theo chiều dọc (Y)</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.y}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1080}
                            value={config.imageOverlay.y}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, y: Number(e.target.value) }
                            })}
                            className="slider-input"
                          />
                        </div>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: '#ffffff' }}>Góc xoay hình ảnh</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.rotation}°</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={config.imageOverlay.rotation}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, rotation: Number(e.target.value) }
                            })}
                            className="slider-input"
                          />
                        </div>

                        <div className="slider-container">
                          <div className="slider-header">
                            <span style={{ color: 'var(--text-pure)' }}>Độ trong suốt hình ảnh</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{Math.round(config.imageOverlay.opacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={config.imageOverlay.opacity}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, opacity: Number(e.target.value) }
                            })}
                            className="slider-input"
                          />
                        </div>

                        <div className="slider-container" style={{ marginTop: '8px' }}>
                          <div className="slider-header">
                            <span style={{ color: 'var(--text-pure)' }}>Chu kỳ đổi ảnh phủ (giây)</span>
                            <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.imageOverlay.imageDuration || 5}s</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={300}
                            step={1}
                            value={config.imageOverlay.imageDuration || 5}
                            onChange={(e) => setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, imageDuration: Number(e.target.value) }
                            })}
                            className="slider-input"
                          />
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                            💡 Nếu tài nguyên có nhiều tệp Ảnh phủ, hệ thống sẽ tự động xoay vòng ảnh sau mỗi chu kỳ giây thiết lập tại đây.
                          </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={config.imageOverlay.randomImageOrder || false}
                              onChange={(e) => setConfig({
                                ...config,
                                imageOverlay: { ...config.imageOverlay, randomImageOrder: e.target.checked }
                              })}
                              className="checkbox-input"
                            />
                            <span>Đổi ảnh phủ ngẫu nhiên (Random Order)</span>
                          </label>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, paddingLeft: '28px', lineHeight: '1.4' }}>
                            💡 Nếu không chọn, ảnh phủ hiển thị tuần tự xoay vòng theo thứ tự số thứ tự (STT) danh sách tệp.
                          </p>

                          <label className="checkbox-container" style={{ marginTop: '6px' }}>
                            <input
                              type="checkbox"
                              checked={config.imageOverlay.bounceEnabled || false}
                              onChange={(e) => setConfig({
                                ...config,
                                imageOverlay: { ...config.imageOverlay, bounceEnabled: e.target.checked }
                              })}
                              className="checkbox-input"
                            />
                            <span style={{ fontWeight: 'bold', color: 'var(--neon-rose)' }}>⚡ Kích hoạt ảnh phủ giật nảy theo nhạc (Bounce to Music)</span>
                          </label>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, paddingLeft: '28px', lineHeight: '1.4' }}>
                            💡 Ảnh phủ sẽ tự động co giãn (giật nảy nhịp nhàng) đồng bộ tuyệt đối theo độ to nhỏ và tiết tấu của âm thanh!
                          </p>
                        </div>
                      </>
                    )}

                    {/* CHẾ ĐỘ 2: NHIỀU ẢNH PHỦ ĐỒNG THỜI (CUSTOM LAYOUT) */}
                    {config.imageOverlay.overlayMode === 'custom' && (
                      <>
                        {/* Danh sách các lớp ảnh phủ đang hoạt động */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                              DANH SÁCH LỚP ẢNH PHỦ ĐỒNG THỜI
                            </span>
                            <button
                              onClick={() => openPathBrowser('overlayImages', 'file')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-neon)',
                                background: 'rgba(225, 29, 72, 0.08)',
                                color: 'var(--neon-rose)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: '700',
                                transition: 'all 200ms ease'
                              }}
                            >
                              + Thêm ảnh phủ...
                            </button>
                          </div>

                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)'
                          }}>
                            {(!config.imageOverlay.items || config.imageOverlay.items.length === 0) ? (
                              <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
                                Chưa có ảnh phủ nào. Bấm "+ Thêm ảnh phủ..." để bắt đầu!
                              </div>
                            ) : (
                              config.imageOverlay.items.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={() => setSelectedOverlayItemId(item.id)}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: selectedOverlayItemId === item.id ? 'rgba(225, 29, 72, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                    border: selectedOverlayItemId === item.id ? '1px solid var(--neon-rose)' : '1px solid rgba(255, 255, 255, 0.03)',
                                    cursor: 'pointer',
                                    transition: 'all 150ms ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                    <input
                                      type="checkbox"
                                      checked={item.enabled}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        const updated = (config.imageOverlay.items || []).map(it => 
                                          it.id === item.id ? { ...it, enabled: e.target.checked } : it
                                        );
                                        setConfig({
                                          ...config,
                                          imageOverlay: { ...config.imageOverlay, items: updated }
                                        });
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{
                                      fontSize: '12px',
                                      fontFamily: 'var(--font-mono)',
                                      color: selectedOverlayItemId === item.id ? '#ffffff' : 'var(--text-pure)',
                                      fontWeight: selectedOverlayItemId === item.id ? 'bold' : 'normal',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {item.imagePath.split('\\').pop() || item.imagePath}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        const updated = (config.imageOverlay.items || []).filter(it => it.id !== item.id);
                                        setConfig({
                                          ...config,
                                          imageOverlay: { ...config.imageOverlay, items: updated }
                                        });
                                        if (selectedOverlayItemId === item.id) {
                                          setSelectedOverlayItemId(updated.length > 0 ? updated[0].id : null);
                                        }
                                      }}
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: 'none',
                                        color: '#ef4444',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Hiệu chỉnh thuộc tính lớp ảnh phủ được chọn */}
                        {(() => {
                          const selectedItem = (config.imageOverlay.items || []).find(it => it.id === selectedOverlayItemId);
                          if (!selectedItem) {
                            return (
                              <div style={{
                                padding: '16px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                textAlign: 'center',
                                fontSize: '12px',
                                color: 'var(--text-muted)'
                              }}>
                                💡 Vui lòng bấm vào một ảnh phủ trong danh sách trên để hiệu chỉnh thuộc tính riêng biệt (vị trí, kích thước, mặt nạ,...) của lớp ảnh đó.
                              </div>
                            );
                          }

                          const updateSelectedItem = (fields: Partial<typeof selectedItem>) => {
                            const updated = (config.imageOverlay.items || []).map(it => 
                              it.id === selectedItem.id ? { ...it, ...fields } : it
                            );
                            setConfig({
                              ...config,
                              imageOverlay: { ...config.imageOverlay, items: updated }
                            });
                          };

                          return (
                            <div style={{
                              padding: '16px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '16px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--neon-rose)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                                  ĐANG SỬA: {selectedItem.imagePath.split('\\').pop()}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  ID: {selectedItem.id}
                                </span>
                              </div>

                              <button
                                onClick={() => handleOpenInRembgTab(selectedItem.imagePath)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  padding: '10px 16px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-neon)',
                                  backgroundColor: 'rgba(225, 29, 72, 0.08)',
                                  color: 'var(--neon-rose)',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: '700',
                                  boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                                  transition: 'all 200ms ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--neon-rose)';
                                  e.currentTarget.style.color = '#ffffff';
                                  e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                                  e.currentTarget.style.color = 'var(--neon-rose)';
                                  e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                                }}
                              >
                                ✨ Chuyển sang Tab Xóa Nền AI...
                              </button>

                              <div className="form-group">
                                <label className="form-label" style={{ color: '#ffffff' }}>Mặt nạ cắt viền ảnh (maskShape)</label>
                                <select
                                  value={selectedItem.maskShape}
                                  onChange={(e) => updateSelectedItem({ maskShape: e.target.value as any })}
                                  className="form-select"
                                >
                                  <option value="circle">Mặt nạ tròn (Circle)</option>
                                  <option value="hexagon">Mặt nạ hình lục giác (Hexagon)</option>
                                  <option value="rectangle">Hình chữ nhật gốc (Rectangle)</option>
                                  <option value="rect_3_4">Khung đứng đứng (3:4)</option>
                                  <option value="rect_4_3">Khung đứng ngang (4:3)</option>
                                  <option value="square">Khung vuông (Square)</option>
                                </select>
                              </div>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: '#ffffff' }}>Độ nhòe mịn viền cắt (feather)</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{selectedItem.feather}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={50}
                                  value={selectedItem.feather}
                                  onChange={(e) => updateSelectedItem({ feather: Number(e.target.value) })}
                                  className="slider-input"
                                />
                              </div>

                              <label className="checkbox-container" style={{ marginTop: '4px', marginBottom: '4px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedItem.lockAspectRatio || false}
                                  onChange={(e) => updateSelectedItem({ lockAspectRatio: e.target.checked })}
                                  className="checkbox-input"
                                />
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>Khóa tỷ lệ khung hình khi kéo (Lock Aspect Ratio)</span>
                              </label>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: '#ffffff' }}>Chiều rộng hình ảnh (width)</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{selectedItem.width}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={50}
                                  max={1920}
                                  value={selectedItem.width}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (selectedItem.lockAspectRatio) {
                                      const ratio = selectedItem.height / selectedItem.width;
                                      updateSelectedItem({
                                        width: val,
                                        height: Math.round(val * ratio)
                                      });
                                    } else {
                                      updateSelectedItem({ width: val });
                                    }
                                  }}
                                  className="slider-input"
                                />
                              </div>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: '#ffffff' }}>Chiều cao hình ảnh (height)</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{selectedItem.height}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={50}
                                  max={1080}
                                  value={selectedItem.height}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (selectedItem.lockAspectRatio) {
                                      const ratio = selectedItem.width / selectedItem.height;
                                      updateSelectedItem({
                                        height: val,
                                        width: Math.round(val * ratio)
                                      });
                                    } else {
                                      updateSelectedItem({ height: val });
                                    }
                                  }}
                                  className="slider-input"
                                />
                              </div>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: '#ffffff' }}>Vị trí ảnh theo chiều ngang (X)</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{selectedItem.x}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1920}
                                  value={selectedItem.x}
                                  onChange={(e) => updateSelectedItem({ x: Number(e.target.value) })}
                                  className="slider-input"
                                />
                              </div>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: '#ffffff' }}>Vị trí ảnh theo chiều dọc (Y)</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{selectedItem.y}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1080}
                                  value={selectedItem.y}
                                  onChange={(e) => updateSelectedItem({ y: Number(e.target.value) })}
                                  className="slider-input"
                                />
                              </div>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: '#ffffff' }}>Góc xoay hình ảnh</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{selectedItem.rotation}°</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={360}
                                  value={selectedItem.rotation}
                                  onChange={(e) => updateSelectedItem({ rotation: Number(e.target.value) })}
                                  className="slider-input"
                                />
                              </div>

                              <div className="slider-container">
                                <div className="slider-header">
                                  <span style={{ color: 'var(--text-pure)' }}>Độ trong suốt hình ảnh</span>
                                  <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{Math.round(selectedItem.opacity * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1.0}
                                  step={0.05}
                                  value={selectedItem.opacity}
                                  onChange={(e) => updateSelectedItem({ opacity: Number(e.target.value) })}
                                  className="slider-input"
                                />
                              </div>

                              <label className="checkbox-container" style={{ marginTop: '6px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedItem.bounceEnabled || false}
                                  onChange={(e) => updateSelectedItem({ bounceEnabled: e.target.checked })}
                                  className="checkbox-input"
                                />
                                <span style={{ fontWeight: 'bold', color: 'var(--neon-rose)' }}>⚡ Kích hoạt giật nảy theo nhạc (Bounce to Music)</span>
                              </label>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* Tab 3.5: Xóa nền */}
            {activeConfigTab === 'removebg' && (
              <>
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(225, 29, 72, 0.04)',
                  border: '1px dashed rgba(225, 29, 72, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '16px',
                  boxShadow: 'inset 0 0 10px rgba(225, 29, 72, 0.05)'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--neon-rose)', fontFamily: 'var(--font-mono)' }}>
                    ⚡ DÀN XỬ LÝ XÓA NỀN ẢNH AI (REMBG STUDIO)
                  </span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                    Sử dụng mô hình AI Deep Learning (rembg) chuyên dụng để tự động tách nền, loại bỏ phông đục/hộp chữ nhật của ảnh phủ chỉ trong vài giây.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                    TẬP TIN ĐẦU VÀO (INPUT IMAGE)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <input
                      type="text"
                      readOnly
                      placeholder="Chưa chọn ảnh..."
                      value={rembgInputPath}
                      className="form-input"
                      style={{ flex: 1, textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    />
                    <button
                      onClick={() => openPathBrowser('rembgInputImage', 'file')}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-neon)',
                        background: 'rgba(139, 92, 246, 0.08)',
                        color: 'var(--neon-purple)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        transition: 'all 200ms ease',
                        boxShadow: '0 0 10px rgba(139, 92, 246, 0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--neon-purple)';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                        e.currentTarget.style.color = 'var(--neon-purple)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.1)';
                      }}
                    >
                      Chọn ảnh...
                    </button>
                    {rembgInputPath && (
                      <button
                        onClick={() => {
                          setRembgInputPath('');
                          setRembgResultPath('');
                          addLog('🧹 Đã xóa tệp ảnh khỏi không gian xử lý tách nền.', 'info');
                        }}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: '700',
                          transition: 'all 200ms ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>

                {rembgInputPath && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: rembgResultPath ? '1fr 1fr' : '1fr',
                    gap: '16px',
                    margin: '16px 0',
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    {/* Cột 1: Ảnh Gốc */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        🖼️ ẢNH GỐC ĐẦU VÀO
                      </span>
                      <div style={{
                        width: '100%',
                        height: '160px',
                        borderRadius: '8px',
                        backgroundColor: '#0a0d1a',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <img
                          src={`/api/fs/file?path=${encodeURIComponent(rembgInputPath)}`}
                          alt="Input Preview"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
                        {rembgInputPath.split('\\').pop()}
                      </span>
                    </div>

                    {/* Cột 2: Ảnh Kết Quả Xử Lý */}
                    {rembgResultPath && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }} className="fade-in-el">
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--neon-emerald)', fontFamily: 'var(--font-mono)' }}>
                          ✨ ẢNH ĐÃ XÓA NỀN (PNG)
                        </span>
                        <div style={{
                          width: '100%',
                          height: '160px',
                          borderRadius: '8px',
                          backgroundColor: '#0a0d1a',
                          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0), radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)',
                          backgroundSize: '16px 16px',
                          backgroundPosition: '0 0, 8px 8px',
                          border: '1px solid var(--neon-emerald)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          position: 'relative',
                          boxShadow: '0 0 15px rgba(16, 185, 129, 0.15)'
                        }}>
                          <img
                            src={`/api/fs/file?path=${encodeURIComponent(rembgResultPath)}`}
                            alt="Result Preview"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        </div>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--neon-emerald)', textAlign: 'center', wordBreak: 'break-all', fontWeight: 'bold' }}>
                          {rembgResultPath.split('\\').pop()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Các Nút Hành Động Xóa Nền */}
                {rembgInputPath && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    <button
                      onClick={handleRemoveBackgroundSingle}
                      disabled={isRemovingBgSingle}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--neon-rose)',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 4px 15px rgba(225, 29, 72, 0.35)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.filter = 'brightness(1.15)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(225, 29, 72, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.filter = 'brightness(1)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(225, 29, 72, 0.35)';
                      }}
                    >
                      ⚡ {isRemovingBgSingle ? 'ĐANG CHẠY REMBG TÁCH NỀN AI...' : 'BẮT ĐẦU XÓA NỀN BẰNG REMBG AI'}
                    </button>

                    {rembgResultPath && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }} className="fade-in-el">
                        <button
                          onClick={handleAddProcessedToOverlay}
                          style={{
                            flex: 1.3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--neon-emerald)',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            color: 'var(--neon-emerald)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            transition: 'all 200ms ease',
                            boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--neon-emerald)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                            e.currentTarget.style.color = 'var(--neon-emerald)';
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.1)';
                          }}
                        >
                          🖼️ Thêm trực tiếp vào Ảnh phủ (Overlay)
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(rembgResultPath);
                            alert('📋 Đã sao chép đường dẫn tuyệt đối của ảnh sạch nền vào Clipboard!');
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'transparent',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            transition: 'all 200ms ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          📋 Sao chép đường dẫn
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Tab 4: Sóng âm */}
            {activeConfigTab === 'waveform' && (
              <>
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={config.waveform.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      waveform: { ...config.waveform, enabled: e.target.checked }
                    })}
                    className="checkbox-input"
                  />
                  <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Kích hoạt sóng âm thanh (Waveform)</span>
                </label>

                {config.waveform.enabled && (
                  <>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ffffff' }}>Kiểu đường bao sóng âm (path)</label>
                      <select
                        value={config.waveform.path}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, path: e.target.value as any }
                        })}
                        className="form-select"
                      >
                        <option value="circle">Sóng hình tròn (Radial Circle)</option>
                        <option value="linear">Sóng hàng ngang (Horizontal Line)</option>
                        <option value="vertical">Sóng hàng dọc (Vertical Line)</option>
                        <option value="square">Sóng vuông bao quanh (Square)</option>
                        <option value="rectangle">Sóng chữ nhật bao quanh (Rectangle)</option>
                        <option value="triangle">Sóng tam giác bao quanh (Triangle)</option>
                        <option value="hexagon">Sóng lục giác bao quanh (Hexagon)</option>
                        <option value="custom">Sóng động nhấp nhô Sine (Custom Sine)</option>
                      </select>
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Căn chỉnh ngang X</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.x} px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1920}
                        value={config.waveform.x}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, x: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Căn chỉnh dọc Y</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.y} px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1080}
                        value={config.waveform.y}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, y: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Bao sóng chiều ngang (Width)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.width} px</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={1000}
                        value={config.waveform.width}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, width: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Bao sóng chiều dọc (Height)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.height} px</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={1000}
                        value={config.waveform.height}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, height: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Góc xoay sóng âm (rotation)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.rotation}°</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={config.waveform.rotation}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, rotation: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Số cột vẽ sóng (barsCount)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.barsCount} cột</span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={256}
                        step={8}
                        value={config.waveform.barsCount}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, barsCount: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Chiều rộng nét sóng (barWidth)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.barWidth} px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={config.waveform.barWidth}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, barWidth: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Chiều cao sóng cực đại (maxHeight)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.maxHeight} px</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={300}
                        value={config.waveform.maxHeight}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, maxHeight: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Độ nhạy nhận sóng âm (Sensitivity)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.waveform.sensitivity ?? 1.5}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={5.0}
                        step={0.1}
                        value={config.waveform.sensitivity ?? 1.5}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, sensitivity: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '6px' }}>
                      <label className="form-label" style={{ color: '#ffffff' }}>Nguồn phát sóng âm (Audio Source)</label>
                      <select
                        value={config.waveform.source || 'voice'}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, source: e.target.value as any }
                        })}
                        className="form-select"
                      >
                        <option value="mixed">Trộn giọng nói và nhạc nền (Cực kỳ nhạy - Khuyên dùng)</option>
                        <option value="voice">Chỉ cảm nhận giọng nói chính (Voice Only)</option>
                        <option value="music">Chỉ cảm nhận nhạc nền (Music Only)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#ffffff' }}>Màu sóng chính</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="color"
                            value={config.waveform.lineColor}
                            onChange={(e) => setConfig({
                              ...config,
                              waveform: { ...config.waveform, lineColor: e.target.value }
                            })}
                            className="color-input-dot"
                          />
                          <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' }}>{config.waveform.lineColor}</span>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#ffffff' }}>Màu sóng đối xứng</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="color"
                            value={config.waveform.fillColor}
                            onChange={(e) => setConfig({
                              ...config,
                              waveform: { ...config.waveform, fillColor: e.target.value }
                            })}
                            className="color-input-dot"
                          />
                          <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' }}>{config.waveform.fillColor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '6px' }}>
                      <label className="form-label" style={{ color: '#ffffff' }}>Thứ tự hiển thị lớp (Z-Index / Layering)</label>
                      <select
                        value={config.waveform.layerOrder || 'waveform_on_top'}
                        onChange={(e) => setConfig({
                          ...config,
                          waveform: { ...config.waveform, layerOrder: e.target.value as any }
                        })}
                        className="form-select"
                      >
                        <option value="waveform_on_top">Đưa SÓNG ÂM ra phía trước (Bring Waveform to Front)</option>
                        <option value="image_on_top">Đưa ẢNH PHỦ ra phía trước (Bring Image to Front)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.waveform.mirror}
                          onChange={(e) => setConfig({
                            ...config,
                            waveform: { ...config.waveform, mirror: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Vẽ đối xứng hai bên baseline (mirror)</span>
                      </label>

                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.waveform.flip || false}
                          onChange={(e) => setConfig({
                            ...config,
                            waveform: { ...config.waveform, flip: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Lật ngược chiều sóng (flip direction)</span>
                      </label>

                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.waveform.showBaseline}
                          onChange={(e) => setConfig({
                            ...config,
                            waveform: { ...config.waveform, showBaseline: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Hiển thị đường cơ sở (baseline)</span>
                      </label>

                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.waveform.gradientEnabled}
                          onChange={(e) => setConfig({
                            ...config,
                            waveform: { ...config.waveform, gradientEnabled: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Kích hoạt dải màu Gradient (Gradient Color)</span>
                      </label>
                    </div>

                    {config.waveform.gradientEnabled && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '6px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ color: '#ffffff' }}>Màu Gradient bắt đầu</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="color"
                              value={config.waveform.gradientStart}
                              onChange={(e) => setConfig({
                                ...config,
                                waveform: { ...config.waveform, gradientStart: e.target.value }
                              })}
                              className="color-input-dot"
                            />
                            <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' }}>{config.waveform.gradientStart}</span>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ color: '#ffffff' }}>Màu Gradient kết thúc</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="color"
                              value={config.waveform.gradientEnd}
                              onChange={(e) => setConfig({
                                ...config,
                                waveform: { ...config.waveform, gradientEnd: e.target.value }
                              })}
                              className="color-input-dot"
                            />
                            <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' }}>{config.waveform.gradientEnd}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Tab 5: Phụ đề */}
            {activeConfigTab === 'subtitles' && (
              <>
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={config.subtitles.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      subtitles: { ...config.subtitles, enabled: e.target.checked }
                    })}
                    className="checkbox-input"
                  />
                  <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Kích hoạt phụ đề giọng đọc AI</span>
                </label>

                {config.subtitles.enabled && (
                  <>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.5px' }}>
                        TỆP PHỤ ĐỀ SRT SẴN CÓ (SUBTITLEFILE)
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={config.subtitles.subtitleFile || ''}
                          readOnly
                          className="form-input"
                          style={{ flex: 1, color: '#38bdf8', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                          placeholder="Chưa chọn tệp phụ đề SRT..."
                        />
                        <button
                          onClick={() => openPathBrowser('subtitleFile', 'file')}
                          style={{
                            padding: '10px 18px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-neon)',
                            background: 'rgba(225, 29, 72, 0.08)',
                            color: 'var(--neon-rose)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            boxShadow: '0 0 10px rgba(225, 29, 72, 0.1)',
                            transition: 'all 200ms ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                            e.currentTarget.style.borderColor = 'var(--border-neon)';
                            e.currentTarget.style.color = 'var(--neon-rose)';
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.1)';
                          }}
                        >
                          Duyệt tệp SRT...
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!config.media.voiceFile) {
                              alert("⚠️ Bạn cần chọn tệp giọng đọc chính (VoiceFile) ở Tab GIỌNG ĐỌC trước khi tạo phụ đề AI!");
                              return;
                            }
                            setIsTranscribeModalOpen(true);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 18px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: theme === 'light' ? 'rgba(124, 58, 237, 0.25)' : 'rgba(139, 92, 246, 0.4)',
                            background: theme === 'light' ? 'rgba(124, 58, 237, 0.08)' : 'rgba(139, 92, 246, 0.1)',
                            color: theme === 'light' ? 'var(--neon-purple)' : '#a78bfa',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            boxShadow: '0 0 10px rgba(139, 92, 246, 0.1)',
                            transition: 'all 200ms ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, var(--neon-purple), var(--neon-indigo))';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = theme === 'light' ? 'rgba(124, 58, 237, 0.08)' : 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = theme === 'light' ? 'rgba(124, 58, 237, 0.25)' : 'rgba(139, 92, 246, 0.4)';
                            e.currentTarget.style.color = theme === 'light' ? 'var(--neon-purple)' : '#a78bfa';
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.1)';
                          }}
                        >
                          ✨ Tự động tạo phụ đề AI (Whisper)
                        </button>
                      </div>

                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                        💡 <strong>Ưu tiên dùng SRT:</strong> Nếu chọn tệp `.srt`, hệ thống sẽ tự động chuyển đổi sang `.ass` để ghép phụ đề chính xác 100% kèm hiệu ứng Karaoke/Nhảy chữ cực đẹp mắt và hoàn toàn miễn phí.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ffffff' }}>Hiệu ứng phụ đề (effect)</label>
                      <select
                        value={config.subtitles.effect}
                        onChange={(e) => setConfig({
                          ...config,
                          subtitles: { ...config.subtitles, effect: e.target.value as any }
                        })}
                        className="form-select"
                      >
                        <option value="karaoke">Hiệu ứng chữ chạy Karaoke tô màu từng từ (Khuyên dùng)</option>
                        <option value="word_reveal">Hiệu ứng chữ hiện từng từ + sáng lên theo giọng nói (Premium)</option>
                        <option value="pop">Hiệu ứng nhảy chữ từng từ Short/Tiktok (Bounce)</option>
                        <option value="fade">Hiệu ứng mờ dần chuyển câu (Fade 80ms)</option>
                        <option value="none">Chữ tĩnh mặc định (None)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ffffff' }}>Định dạng kiểu chữ (Text Case)</label>
                      <select
                        value={config.subtitles.textCase || 'uppercase'}
                        onChange={(e) => setConfig({
                          ...config,
                          subtitles: { ...config.subtitles, textCase: e.target.value as any }
                        })}
                        className="form-select"
                      >
                        <option value="uppercase">VIẾT HOA TOÀN BỘ (Premium Shorts/Reels)</option>
                        <option value="original">Giữ nguyên gốc từ bản dịch/AI (Original)</option>
                        <option value="lowercase">viết thường toàn bộ (lowercase)</option>
                      </select>
                    </div>

                    <label className="checkbox-container" style={{ marginTop: '4px' }}>
                      <input
                        type="checkbox"
                        checked={config.subtitles.oneWordAtATime || false}
                        onChange={(e) => setConfig({
                          ...config,
                          subtitles: { ...config.subtitles, oneWordAtATime: e.target.checked }
                        })}
                        className="checkbox-input"
                      />
                      <span style={{ fontWeight: 'bold' }}>Chữ chạy đơn từng từ ở chính giữa (Cố định vị trí)</span>
                    </label>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '-8px 0 4px 28px', lineHeight: '1.4' }}>
                      💡 <strong>Cố định vị trí:</strong> Khuyên dùng khi làm video ngắn Tiktok/Shorts. Giúp từng từ đơn nhấp nháy cố định ở chính giữa màn hình, loại bỏ hiện tượng nhảy lệch vị trí do câu dài câu ngắn.
                    </p>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Cỡ chữ hiển thị phụ đề</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.subtitles.fontSize} pt</span>
                      </div>
                      <input
                        type="range"
                        min={12}
                        max={72}
                        value={config.subtitles.fontSize}
                        onChange={(e) => setConfig({
                          ...config,
                          subtitles: { ...config.subtitles, fontSize: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div className="slider-container">
                      <div className="slider-header">
                        <span style={{ color: '#ffffff' }}>Vị trí lề dưới phụ đề (bottomMargin)</span>
                        <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{config.subtitles.bottomMargin} px</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={500}
                        step={10}
                        value={config.subtitles.bottomMargin}
                        onChange={(e) => setConfig({
                          ...config,
                          subtitles: { ...config.subtitles, bottomMargin: Number(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#ffffff', fontSize: '11px' }}>Màu chữ chính</label>
                        <input
                          type="color"
                          value={config.subtitles.primaryColor}
                          onChange={(e) => setConfig({
                            ...config,
                            subtitles: { ...config.subtitles, primaryColor: e.target.value }
                          })}
                          className="color-input-dot"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#ffffff', fontSize: '11px' }}>Màu chữ chờ (Karaoke)</label>
                        <input
                          type="color"
                          value={config.subtitles.secondaryColor || '#c0c0c0'}
                          onChange={(e) => setConfig({
                            ...config,
                            subtitles: { ...config.subtitles, secondaryColor: e.target.value }
                          })}
                          className="color-input-dot"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#ffffff', fontSize: '11px' }}>Màu viền chữ</label>
                        <input
                          type="color"
                          value={config.subtitles.outlineColor}
                          onChange={(e) => setConfig({
                            ...config,
                            subtitles: { ...config.subtitles, outlineColor: e.target.value }
                          })}
                          className="color-input-dot"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Tab 6: Camera */}
            {activeConfigTab === 'camera' && (
              <>
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={config.camera.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      camera: { ...config.camera, enabled: e.target.checked }
                    })}
                    className="checkbox-input"
                  />
                  <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Kích hoạt khung Camera ghi hình (Static overlay)</span>
                </label>

                {config.camera.enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '12px', paddingLeft: '16px', borderLeft: '2px solid var(--border-neon)' }}>
                    
                    {/* Presets dropdown */}
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ffffff' }}>Kiểu dáng khung (Camera Style Preset)</label>
                      <select
                        value={config.camera.style || 'classic_rec'}
                        onChange={(e) => setConfig({
                          ...config,
                          camera: { ...config.camera, style: e.target.value as any }
                        })}
                        className="form-select"
                      >
                        <option value="classic_rec">Classic REC HUD (Ghi hình cổ điển)</option>
                        <option value="modern_cinema">Modern Cinema (Điện ảnh hiện đại)</option>
                        <option value="vlogger_dslr">Vlogger DSLR (Màn hình ngắm cơ học)</option>
                        <option value="retro_vhs">Retro VHS (Cuộn băng Camcorder 1990s)</option>
                      </select>
                    </div>

                    {/* Color picker */}
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ffffff' }}>Màu sắc khung viền & Chữ</label>
                      <div className="color-picker-wrapper">
                        <input
                          type="color"
                          value={config.camera.color || '#ffffff'}
                          onChange={(e) => setConfig({
                            ...config,
                            camera: { ...config.camera, color: e.target.value }
                          })}
                          className="color-input-dot"
                        />
                        <input
                          type="text"
                          value={(config.camera.color || '#ffffff').toUpperCase()}
                          onChange={(e) => setConfig({
                            ...config,
                            camera: { ...config.camera, color: e.target.value }
                          })}
                          className="form-input"
                          style={{ width: '120px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>

                    {/* Padding slider */}
                    <div className="slider-container">
                      <div className="slider-header">
                        <span>Khoảng cách lề (Padding):</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-purple)' }}>{config.camera.padding !== undefined ? config.camera.padding : 30}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.camera.padding !== undefined ? config.camera.padding : 30}
                        onChange={(e) => setConfig({
                          ...config,
                          camera: { ...config.camera, padding: parseInt(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    {/* Thickness slider */}
                    <div className="slider-container">
                      <div className="slider-header">
                        <span>Độ dày nét vẽ (Thickness):</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-purple)' }}>{config.camera.thickness !== undefined ? config.camera.thickness : 3}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={config.camera.thickness !== undefined ? config.camera.thickness : 3}
                        onChange={(e) => setConfig({
                          ...config,
                          camera: { ...config.camera, thickness: parseInt(e.target.value) }
                        })}
                        className="slider-input"
                      />
                    </div>

                    {/* Scale slider */}
                    <div className="slider-container">
                      <div className="slider-header">
                        <span>Tỷ lệ thu phóng chi tiết (Scale):</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-purple)' }}>{(config.camera.scale !== undefined ? config.camera.scale : 1.0).toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="20"
                        step="1"
                        value={Math.round((config.camera.scale !== undefined ? config.camera.scale : 1.0) * 10)}
                        onChange={(e) => setConfig({
                          ...config,
                          camera: { ...config.camera, scale: parseInt(e.target.value) / 10 }
                        })}
                        className="slider-input"
                      />
                    </div>

                    {/* Quick Toggles */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.camera.showCorners}
                          onChange={(e) => setConfig({
                            ...config,
                            camera: { ...config.camera, showCorners: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Hiển thị góc ngắm / Khung AF</span>
                      </label>

                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.camera.showRecText}
                          onChange={(e) => setConfig({
                            ...config,
                            camera: { ...config.camera, showRecText: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Hiển thị nhãn REC / Trạng thái</span>
                      </label>

                      {config.camera.style === 'classic_rec' && (
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            checked={config.camera.showBlinkingDot}
                            onChange={(e) => setConfig({
                              ...config,
                              camera: { ...config.camera, showBlinkingDot: e.target.checked }
                            })}
                            className="checkbox-input"
                          />
                          <span>Bật chấm đỏ REC nhấp nháy</span>
                        </label>
                      )}

                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.camera.showBattery}
                          onChange={(e) => setConfig({
                            ...config,
                            camera: { ...config.camera, showBattery: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Hiển thị lượng pin 🔋</span>
                      </label>

                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={config.camera.showTimecode}
                          onChange={(e) => setConfig({
                            ...config,
                            camera: { ...config.camera, showTimecode: e.target.checked }
                          })}
                          className="checkbox-input"
                        />
                        <span>Hiển thị mốc thời gian (Timecode)</span>
                      </label>
                    </div>

                  </div>
                )}
              </>
            )}

            {/* Tab 7: Cài đặt xuất */}
            {activeConfigTab === 'render' && (
              <>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff' }}>Độ phân giải video (resolution)</label>
                  <select
                    value={config.render.resolution}
                    onChange={(e) => setConfig({
                      ...config,
                      render: { ...config.render, resolution: e.target.value as any }
                    })}
                    className="form-select"
                  >
                    <option value="1920x1080">Full HD (1920x1080 - 16:9)</option>
                    <option value="1280x720">HD Tiêu chuẩn (1280x720 - 16:9)</option>
                    <option value="1080x1920">Mobile Dọc (Tiktok/Reels 1080x1920 - 9:16)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff' }}>Bộ giải mã xuất video (encoder)</label>
                  <select
                    value={config.render.encoder}
                    onChange={(e) => setConfig({
                      ...config,
                      render: { ...config.render, encoder: e.target.value as any }
                    })}
                    className="form-select"
                  >
                    <option value="auto">Bộ giải mã Tự động (Tối ưu phần cứng)</option>
                    <option value="h264_nvenc">GPU tăng tốc H264 (NVIDIA NVENC)</option>
                    <option value="libx264">CPU giải mã phần mềm (x264 - Fallback)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff' }}>Tốc độ khung hình (FPS)</label>
                  <select
                    value={config.render.fps}
                    onChange={(e) => setConfig({
                      ...config,
                      render: { ...config.render, fps: Number(e.target.value) }
                    })}
                    className="form-select"
                  >
                    <option value="30">30 fps (Tiêu chuẩn)</option>
                    <option value="60">60 fps (Chuyển động mượt mà)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#ffffff' }}>Bộ đệm phân đoạn video (.render_cache)</label>
                  <select
                    value={config.render.cacheSize}
                    onChange={(e) => setConfig({
                      ...config,
                      render: { ...config.render, cacheSize: Number(e.target.value) }
                    })}
                    className="form-select"
                  >
                    <option value="5">Giới hạn 5 GB</option>
                    <option value="10">Giới hạn 10 GB (Khuyên dùng)</option>
                    <option value="20">Giới hạn 20 GB</option>
                  </select>
                </div>

                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={config.render.lowRamMode}
                    onChange={(e) => setConfig({
                      ...config,
                      render: { ...config.render, lowRamMode: e.target.checked }
                    })}
                    className="checkbox-input"
                  />
                  <span>Kích hoạt chế độ tiết kiệm RAM (Low RAM Mode)</span>
                </label>
              </>
            )}

          </div>

          {/* Preset Saving Section */}
          <div 
            style={{ 
              marginTop: '16px',
              borderTop: '1px solid var(--border-light)',
              paddingTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>LƯU PRESET CẤU HÌNH</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Nhập tên Preset mới..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="form-input"
                style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
              />
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: newPresetName.trim() ? 'var(--neon-purple)' : 'var(--border-light)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  color: newPresetName.trim() ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: newPresetName.trim() ? '0 0 10px rgba(139, 92, 246, 0.4)' : 'none'
                }}
              >
                <Save size={14} />
                Lưu lại
              </button>
            </div>
          </div>

        </section>

      </main>

      {/* REAL WINDOWS LOCAL FILESYSTEM BROWSER MODAL (2-COLUMN DUAL PANEL) */}
      {isBrowserOpen && (() => {
        const filteredItems = dirItems.filter((item) =>
          item.name.toLowerCase().includes(browserSearchQuery.toLowerCase())
        );
        return (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div 
              className="store-card"
              style={{
                width: '850px',
                height: '580px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backgroundColor: 'var(--bg-deep-card)',
                border: '1px solid var(--border-neon)',
                padding: '24px',
                boxShadow: '0 20px 80px rgba(225, 29, 72, 0.15)',
                borderRadius: '16px',
                backdropFilter: 'blur(30px)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--neon-rose)' }}>
                  <FolderOpen size={22} style={{ color: 'var(--neon-rose)' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-pure)', letterSpacing: '0.5px' }}>
                    {browserMode === 'file' ? 'DUYỆT TỆP CỤC BỘ (WINDOWS)' : 'CHỌN THƯ MỤC LƯU TRỮ'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsBrowserOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-pure)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Path Breadcrumbs Display */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  overflow: 'hidden'
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>ĐƯỜNG DẪN:</span>
                <div style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {renderBreadcrumbs()}
                </div>
                {currentDirPath && (
                  <button 
                    onClick={navigateUp}
                    style={{
                      backgroundColor: 'rgba(225, 29, 72, 0.08)',
                      border: '1px solid var(--border-neon)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--neon-rose)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 200ms ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--neon-rose)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                      e.currentTarget.style.color = 'var(--neon-rose)';
                    }}
                  >
                    <ArrowLeft size={10} /> Thư mục cha
                  </button>
                )}
              </div>

              {/* Dual Panel Grid (Left Sidebar + Right File List) */}
              <div 
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: '230px 1fr',
                  gap: '16px',
                  minHeight: 0
                }}
              >
                {/* Left Column: Sidebar (Quick Access & Drives) */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    backgroundColor: 'var(--color-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    padding: '14px',
                    overflowY: 'auto'
                  }}
                >
                  {/* Quick Access Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                      TRUY CẬP NHANH
                    </span>
                    {browserQuickAccess.map((qa, index) => {
                      const isActive = currentDirPath === qa.path;
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setCurrentDirPath(qa.path);
                            setBrowserSearchQuery('');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            color: isActive ? '#ffffff' : 'var(--text-normal)',
                            backgroundColor: isActive ? 'var(--neon-rose)' : 'transparent',
                            border: isActive ? '1px solid var(--neon-rose)' : '1px solid transparent',
                            transition: 'all 200ms ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'var(--border-light)';
                              e.currentTarget.style.color = 'var(--text-pure)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-normal)';
                            }
                          }}
                        >
                          {qa.icon === 'home' && <FolderOpen size={14} style={{ color: '#818cf8' }} />}
                          {qa.icon === 'desktop' && <Camera size={14} style={{ color: '#f43f5e' }} />}
                          {qa.icon === 'downloads' && <RefreshCw size={14} style={{ color: '#10b981' }} />}
                          {qa.icon === 'documents' && <Save size={14} style={{ color: '#fbbf24' }} />}
                          {qa.icon === 'workspace' && <Sliders size={14} style={{ color: '#38bdf8' }} />}
                          <span style={{ fontWeight: isActive ? 'bold' : '500', fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{qa.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hard Drives Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                      THIẾT BỊ & Ổ ĐĨA
                    </span>
                    {browserDrives.map((drv, index) => {
                      const isActive = currentDirPath === drv.path;
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setCurrentDirPath(drv.path);
                            setBrowserSearchQuery('');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            color: isActive ? '#ffffff' : 'var(--text-normal)',
                            backgroundColor: isActive ? 'var(--neon-rose)' : 'transparent',
                            border: isActive ? '1px solid var(--neon-rose)' : '1px solid transparent',
                            transition: 'all 200ms ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'var(--border-light)';
                              e.currentTarget.style.color = 'var(--text-pure)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-normal)';
                            }
                          }}
                        >
                          <FolderOpen size={14} style={{ color: 'var(--neon-rose)' }} />
                          <span style={{ fontWeight: isActive ? 'bold' : '500', fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{drv.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Active Folder Files List + Search Filter */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minWidth: 0,
                    minHeight: 0
                  }}
                >
                  {/* Live Filter Search Input */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Tìm nhanh tệp tin hoặc thư mục..."
                      value={browserSearchQuery}
                      onChange={(e) => setBrowserSearchQuery(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        paddingLeft: '38px',
                        fontSize: '13px',
                        height: '38px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    <Search size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    {browserSearchQuery && (
                      <button
                        onClick={() => setBrowserSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Items List Body */}
                  <div 
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      border: '1px solid var(--border-light)',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-input)',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0
                    }}
                  >
                    {isLoadingDir ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                        <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--neon-rose)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>Đang quét đĩa cứng...</span>
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                        {browserSearchQuery ? 'Không tìm thấy tệp phù hợp.' : 'Thư mục rỗng hoặc không có quyền truy cập.'}
                      </div>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const isFolder = item.type === 'dir';
                        return (
                          <div
                            key={idx}
                            onClick={() => handleSelectPathItem(item)}
                            style={{
                              padding: '10px 16px',
                              borderBottom: '1px solid var(--border-light)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              transition: 'all 150ms ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--border-light)';
                              e.currentTarget.style.paddingLeft = '20px';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.paddingLeft = '16px';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              {isFolder ? (
                                <Folder size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
                              ) : item.ext && ['mp3', 'wav'].includes(item.ext) ? (
                                <FileAudio size={16} style={{ color: '#34d399', flexShrink: 0 }} />
                              ) : item.ext && ['mp4', 'mkv', 'avi'].includes(item.ext) ? (
                                <FileVideo size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                              ) : item.ext && ['png', 'jpg', 'jpeg'].includes(item.ext) ? (
                                <FileImage size={16} style={{ color: 'var(--neon-rose)', flexShrink: 0 }} />
                              ) : (
                                <FileCode size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                              )}
                              <span 
                                style={{ 
                                  fontWeight: isFolder ? 'bold' : 'normal', 
                                  color: isFolder ? 'var(--text-pure)' : 'var(--text-bright)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {item.name}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                              {isFolder ? 'Thư mục' : item.ext ? `${item.ext} tệp` : 'Tệp'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal actions footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  QUÉT ĐƯỢC: <strong style={{ color: 'var(--text-pure)' }}>{filteredItems.length}</strong> MỤC PHÙ HỢP
                </span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setIsBrowserOpen(false)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-light)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-bright)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      transition: 'all 200ms ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-input)'}
                  >
                    HỦY BỎ
                  </button>
                  {browserMode === 'dir' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 'bold' }}>TÊN FILE VIDEO:</span>
                        <input
                          type="text"
                          value={browserOutputFileName}
                          onChange={(e) => setBrowserOutputFileName(e.target.value)}
                          className="form-input"
                          style={{
                            width: '160px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            height: '34px',
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-neon)',
                            borderRadius: '6px',
                            color: 'var(--text-pure)',
                            outline: 'none',
                            transition: 'all 200ms ease'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--neon-rose)'}
                          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-neon)'}
                        />
                      </div>
                      <button
                        onClick={handleSelectCurrentFolder}
                        disabled={!currentDirPath}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--neon-emerald)',
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: '700',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                          transition: 'all 200ms ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                      >
                        <Check size={14} />
                        CHỌN THƯ MỤC NÀY
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* GORGEOUS APPLE-STYLE GLASSMORPHIC AI WHISPER TRANSCRIBE MODAL */}
      {isTranscribeModalOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            className="store-card"
            style={{
              width: '600px',
              backgroundColor: 'var(--bg-deep-card)',
              border: '1px solid var(--border-neon)',
              padding: '24px',
              boxShadow: '0 20px 80px rgba(139, 92, 246, 0.15)',
              borderRadius: '16px',
              backdropFilter: 'blur(30px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a78bfa' }}>
                <FileAudio size={22} style={{ color: '#a78bfa' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-pure)', letterSpacing: '0.5px' }}>
                  TẠO PHỤ ĐỀ TỰ ĐỘNG BẰNG AI (WHISPER)
                </h3>
              </div>
              <button 
                onClick={() => !isTranscribing && setIsTranscribeModalOpen(false)}
                disabled={isTranscribing}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: isTranscribing ? 'not-allowed' : 'pointer', 
                  color: 'var(--text-muted)',
                  opacity: isTranscribing ? 0.4 : 1
                }}
                onMouseEnter={(e) => { if (!isTranscribing) e.currentTarget.style.color = 'var(--text-pure)' }}
                onMouseLeave={(e) => { if (!isTranscribing) e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Input Voice File Display */}
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>TỆP GIỌNG ĐỌC NGUỒN:</span>
              <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '12px', wordBreak: 'break-all', fontWeight: '600' }}>
                {config.media.voiceFile}
              </span>
            </div>

            {!isTranscribing ? (
              <>
                {/* Configuration panel */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>MÔ HÌNH AI WHISPER</label>
                    <select
                      value={transcribeModel}
                      onChange={(e) => setTranscribeModel(e.target.value)}
                      className="form-select"
                      style={{ fontSize: '13px', padding: '10px' }}
                    >
                      <option value="tiny">Tiny (Siêu nhanh, Nhẹ nhất)</option>
                      <option value="base">Base (Cân bằng, khuyên dùng)</option>
                      <option value="small">Small (Chính xác, nặng hơn)</option>
                      <option value="medium">Medium (Cực kì chính xác, rất nặng)</option>
                      <option value="large">Large (Hoàn hảo, yêu cầu GPU khỏe)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>NGÔN NGỮ NGUỒN</label>
                    <select
                      value={transcribeLanguage}
                      onChange={(e) => setTranscribeLanguage(e.target.value)}
                      className="form-select"
                      style={{ fontSize: '13px', padding: '10px' }}
                    >
                      <option value="auto">Tự động nhận diện</option>
                      <option value="vi">Tiếng Việt (Vietnamese)</option>
                      <option value="en">Tiếng Anh (English)</option>
                      <option value="zh">Tiếng Trung (Chinese)</option>
                      <option value="ja">Tiếng Nhật (Japanese)</option>
                      <option value="ko">Tiếng Hàn (Korean)</option>
                      <option value="fr">Tiếng Pháp (French)</option>
                      <option value="es">Tiếng Tây Ban Nha (Spanish)</option>
                    </select>
                  </div>
                </div>

                <div 
                  style={{ 
                    fontSize: '12px', 
                    color: 'var(--text-muted)', 
                    backgroundColor: 'rgba(139, 92, 246, 0.05)', 
                    border: '1px solid rgba(139, 92, 246, 0.15)',
                    padding: '12px', 
                    borderRadius: '8px',
                    lineHeight: '1.5'
                  }}
                >
                  💡 <strong>Gợi ý:</strong> Mô hình <strong>Base</strong> chạy siêu tốc và cho kết quả rất tốt với tiếng Việt. Quá trình chạy lần đầu sẽ tải mô hình AI về hệ thống (mất vài phút tùy tốc độ mạng), các lần sau sẽ khởi chạy ngay lập tức.
                </div>

                {/* Footer action buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setIsTranscribeModalOpen(false)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-light)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-bright)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      transition: 'all 200ms ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-input)'}
                  >
                    HỦY BỎ
                  </button>
                  <button
                    type="button"
                    onClick={startAITranscription}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 24px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--neon-purple)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                      transition: 'all 200ms ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    <Check size={14} />
                    BẮT ĐẦU TRÍCH XUẤT
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Transcribing progress pane */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} />
                      {transcribingPercent < 100 ? 'Đang phân tích xử lý...' : 'Hoàn thành kết xuất phụ đề!'}
                    </span>
                    <span style={{ color: '#a78bfa', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      {transcribingPercent}%
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${transcribingPercent}%`, 
                        backgroundColor: 'var(--neon-purple)', 
                        boxShadow: '0 0 10px var(--neon-purple)',
                        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                      }} 
                    />
                  </div>
                </div>

                {/* Log Terminal Console */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={12} />
                    NHẬT KÝ AI WORKER:
                  </span>
                  <div 
                    style={{
                      height: '180px',
                      backgroundColor: '#090a0c',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: '#34d399',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      whiteSpace: 'pre-wrap',
                      scrollBehavior: 'smooth'
                    }}
                    ref={(el) => {
                      if (el) {
                        el.scrollTop = el.scrollHeight;
                      }
                    }}
                  >
                    {transcribingLogs.map((logLine, idx) => (
                      <div key={idx} style={{ 
                        color: logLine.startsWith('❌') ? 'var(--neon-rose)' : logLine.startsWith('🎉') ? 'var(--neon-emerald)' : '#34d399',
                        borderLeft: logLine.startsWith('❌') ? '2px solid var(--neon-rose)' : logLine.startsWith('🎉') ? '2px solid var(--neon-emerald)' : 'none',
                        paddingLeft: logLine.startsWith('❌') || logLine.startsWith('🎉') ? '6px' : '0'
                      }}>
                        {logLine}
                      </div>
                    ))}
                  </div>
                </div>

                {transcribeError && (
                  <div 
                    style={{ 
                      fontSize: '12px', 
                      color: 'var(--neon-rose)', 
                      backgroundColor: 'rgba(225, 29, 72, 0.08)', 
                      border: '1px solid rgba(225, 29, 72, 0.2)',
                      padding: '10px 14px', 
                      borderRadius: '8px',
                      fontWeight: '500'
                    }}
                  >
                    ⚠️ {transcribeError}
                  </div>
                )}

                {/* Cancel/Stop Button while transcription is actively running */}
                {(!transcribeError && transcribingPercent < 100) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                    <button
                      type="button"
                      onClick={stopAITranscription}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(225, 29, 72, 0.12)',
                        border: '1.5px solid rgba(225, 29, 72, 0.3)',
                        color: 'var(--neon-rose)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--neon-rose)';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(225, 29, 72, 0.12)';
                        e.currentTarget.style.color = 'var(--neon-rose)';
                      }}
                    >
                      <XCircle size={14} />
                      DỪNG TRÍCH XUẤT
                    </button>
                  </div>
                )}

                {/* Close Button when Error occurs or is completed */}
                {(transcribeError || transcribingPercent === 100) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTranscribing(false);
                        setIsTranscribeModalOpen(false);
                      }}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '6px',
                        backgroundColor: transcribeError ? 'rgba(225, 29, 72, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: 'none',
                        color: transcribeError ? 'var(--neon-rose)' : 'var(--neon-emerald)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        transition: 'all 200ms ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                    >
                      ĐÓNG CỬA SỔ
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}
      
      {/* ❓ Hướng dẫn sử dụng popup modal */}
      {isGuideOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(5, 5, 8, 0.65)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.25s ease-out'
          }}
          onClick={() => setIsGuideOpen(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              backgroundColor: 'var(--bg-deep-card)',
              border: '1px solid var(--border-neon)',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Cross icon button */}
            <button
              onClick={() => setIsGuideOpen(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-pure)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--neon-rose)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-input)';
                e.currentTarget.style.color = 'var(--text-pure)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }}
            >
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
              <HelpCircle size={24} style={{ color: 'var(--neon-purple)', filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.5))' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-bright)', fontFamily: 'var(--font-sans)', letterSpacing: '0.5px' }}>HƯỚNG DẪN SỬ DỤNG PHẦN MỀM</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>WAVEFORM EDIT STUDIO v3.0.0-PRO</span>
              </div>
            </div>

            {/* Modal Scrollable Contents */}
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                paddingRight: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                fontSize: '14px',
                color: 'var(--text-pure)',
                lineHeight: '1.6',
                scrollBehavior: 'smooth'
              }}
            >
              {/* Section 1: Intro */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ margin: 0, color: 'var(--neon-purple)', fontFamily: 'var(--font-sans)', fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🌟</span> Giới thiệu chung
                </h4>
                <p style={{ margin: 0, fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--text-normal)' }}>
                  <strong style={{ color: 'var(--text-bright)' }}>WaveForm Edit Studio</strong> là phần mềm all-in-one chuyên nghiệp chạy cục bộ giúp bạn tạo ra những video sóng âm nhạc, podcast, truyện đọc với hiệu ứng sóng âm động, ảnh phủ nhún nhảy theo nhạc, phụ đề AI chạy chữ karaoke và khung ngắm HUD máy quay thời thượng.
                </p>
              </div>

              {/* Section 2: Steps flow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--neon-purple)', fontFamily: 'var(--font-sans)', fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚀</span> Quy trình 5 bước dựng video nhanh
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  {[
                    { 
                      step: "1", 
                      title: "Nạp nguyên liệu đầu vào", 
                      desc: <>Tại tab <strong style={{ color: 'var(--text-bright)' }}>Tập tin nguồn</strong>, chọn Video nền, Giọng đọc (Audio MP3/WAV), và các Ảnh phủ muốn chèn.</> 
                    },
                    { 
                      step: "2", 
                      title: "Thiết kế sóng nhạc và hiệu ứng", 
                      desc: <>Tinh chỉnh kiểu dáng dải <strong style={{ color: 'var(--text-bright)' }}>Sóng âm</strong> (tròn, thẳng, tam giác, lục giác), chọn dải màu Gradient, bật nhịp nhún nhảy theo nhạc cho <strong style={{ color: 'var(--text-bright)' }}>Ảnh phủ</strong>.</> 
                    },
                    { 
                      step: "3", 
                      title: "Tự động trích xuất phụ đề AI", 
                      desc: <>Tại tab <strong style={{ color: 'var(--text-bright)' }}>Phụ đề</strong>, bật phụ đề giọng đọc AI ➔ bấm <strong style={{ color: 'var(--text-bright)' }}>Tự động tạo phụ đề AI (Whisper)</strong> ➔ chọn mô hình và bắt đầu chạy.</> 
                    },
                    { 
                      step: "4", 
                      title: "Trang trí bằng khung máy ảnh", 
                      desc: <>Tại tab <strong style={{ color: 'var(--text-bright)' }}>Khung</strong>, kích hoạt HUD và chọn phong cách máy quay yêu thích (Classic REC, DSLR, Cinema hoặc retro VHS) để tăng tính nghệ thuật.</> 
                    },
                    { 
                      step: "5", 
                      title: "Kết xuất sản phẩm chất lượng cao", 
                      desc: <>Tại tab <strong style={{ color: 'var(--text-bright)' }}>Cấu hình</strong>, chọn khung hình (Ngang <code style={{ fontFamily: 'var(--font-mono)', padding: '2px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px' }}>16:9</code> hoặc Dọc TikTok <code style={{ fontFamily: 'var(--font-mono)', padding: '2px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px' }}>9:16</code>), chọn bitrate và bấm <strong style={{ color: 'var(--text-bright)' }}>Bắt đầu ghép video</strong>. Video sẽ được xuất chuẩn xác!</> 
                    }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: 'var(--color-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--neon-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>
                        {item.step}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-sans)' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-bright)', fontSize: '13px' }}>{item.title}</span>
                        <span style={{ color: 'var(--text-normal)', fontSize: '12px', lineHeight: '1.5' }}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Pro tips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--neon-purple)', fontFamily: 'var(--font-sans)', fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💡</span> Mẹo thiết kế chuyên nghiệp & Đồng bộ hoá
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-normal)' }}>
                  <li><strong style={{ color: 'var(--text-bright)' }}>Chống méo dẹt hình ảnh:</strong> Hệ thống tự động crop và giữ tỷ lệ gốc của ảnh phủ. Hãy chỉnh tọa độ X/Y của từng ảnh phủ trong chế độ Custom để phân bổ đều trên video.</li>
                  <li><strong style={{ color: 'var(--text-bright)' }}>Tối ưu Phụ đề 2 dòng:</strong> Thuật toán mới tự động ngắt dòng tối đa 2 dòng. Nên chọn hiệu ứng <strong style={{ color: 'var(--neon-purple)' }}>Word Reveal (Premium)</strong> và thiết lập Màu chính là Vàng rực (<code style={{ fontFamily: 'var(--font-mono)', padding: '2px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px' }}>#FACC15</code>), Màu phụ là Trắng (<code style={{ fontFamily: 'var(--font-mono)', padding: '2px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px' }}>#FFFFFF</code>) để nổi bật nhất.</li>
                  <li><strong style={{ color: 'var(--text-bright)' }}>Xóa nền chân dung cực nhanh:</strong> Hãy qua tab <strong style={{ color: 'var(--text-bright)' }}>Xóa nền AI</strong>, tải ảnh thô lên và bấm nút chạy để hệ thống tự động lọc nền thành ảnh PNG sạch sẽ.</li>
                  <li><strong style={{ color: 'var(--text-bright)' }}>Sửa lỗi server restart:</strong> Nếu server bị ngắt kết nối làm mất Job RAM (lỗi 404), hệ thống tự động dọn sạch localStorage và đưa màn hình về trạng thái sẵn sàng cực kỳ mượt mà.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '16px', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--neon-purple)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                  cursor: 'pointer',
                  transition: 'all 200ms ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                ĐÃ HIỂU, BẮT ĐẦU LÀM VIDEO!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer System Credits */}
      <footer 
        style={{ 
          marginTop: '32px', 
          borderTop: '1px solid var(--border-light)', 
          paddingTop: '20px', 
          textAlign: 'center', 
          color: 'var(--text-muted)',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}
      >
        <span>WaveForm Edit App v3.0.0-prod | Powered by local Node.js FS Engine</span>
      </footer>
    </div>
  );
}
