import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const motherPath = searchParams.get('path') || '';

    if (!motherPath) {
      return NextResponse.json(
        { success: false, message: 'Thiếu đường dẫn thư mục mẹ.' },
        { status: 400 }
      );
    }

    const targetPath = path.normalize(motherPath);

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        { success: false, message: 'Thư mục mẹ không tồn tại.' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { success: false, message: 'Đường dẫn được chọn không phải là một thư mục.' },
        { status: 400 }
      );
    }

    // 1. Scan direct subfolders case-insensitively
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    
    // Maps to track target directories
    let voiceDir: string | null = null;
    let videoDir: string | null = null;
    let imageDir: string | null = null;
    let musicDir: string | null = null;

    for (const item of items) {
      if (item.isDirectory()) {
        const nameLower = item.name.toLowerCase();
        const fullSubPath = path.join(targetPath, item.name);
        
        if (nameLower === 'voice') voiceDir = fullSubPath;
        else if (nameLower === 'video') videoDir = fullSubPath;
        else if (nameLower === 'image') imageDir = fullSubPath;
        else if (nameLower === 'music') musicDir = fullSubPath;
      }
    }

    // Helper to read matched file formats from a folder
    const scanFiles = (dir: string | null, extensions: string[]): string[] => {
      if (!dir || !fs.existsSync(dir)) return [];
      try {
        const fileNames = fs.readdirSync(dir);
        return fileNames
          .filter(name => {
            const ext = path.extname(name).toLowerCase();
            return extensions.includes(ext);
          })
          .map(name => path.join(dir, name));
      } catch {
        return [];
      }
    };

    // 2. Scan each standard subfolder
    const voiceFiles = scanFiles(voiceDir, ['.mp3', '.wav', '.m4a']);
    const videoFiles = scanFiles(videoDir, ['.mp4', '.mkv', '.avi', '.mov']);
    const imageFiles = scanFiles(imageDir, ['.png', '.jpg', '.jpeg', '.webp']);
    const musicFiles = scanFiles(musicDir, ['.mp3', '.wav', '.m4a']);

    // Determine results
    const voiceFile = voiceFiles.length > 0 ? voiceFiles[0] : '';
    const backgroundVideos = videoFiles;
    const overlayImages = imageFiles;
    const resolvedMusicFiles = musicFiles;
    
    // Generate default output filename in the mother directory
    const outputFilename = path.join(targetPath, 'output.mp4');

    return NextResponse.json({
      success: true,
      scannedPath: targetPath,
      voiceFile,
      backgroundVideos,
      overlayImages,
      musicFiles: resolvedMusicFiles,
      outputFilename,
      summary: {
        voiceFound: voiceFiles.length > 0,
        videosCount: videoFiles.length,
        imagesCount: imageFiles.length,
        musicCount: musicFiles.length
      }
    });

  } catch (err: any) {
    console.error('Lỗi khi quét thư mục dự án:', err);
    return NextResponse.json(
      { success: false, message: `Lỗi máy chủ: ${err.message}` },
      { status: 500 }
    );
  }
}
