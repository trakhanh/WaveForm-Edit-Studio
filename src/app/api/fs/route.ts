import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let dirPath = searchParams.get('path') || '';

    // Quick access lists
    const homeDir = os.homedir();
    const quickAccess = [
      { name: 'Trang chủ', path: homeDir, icon: 'home' },
      { name: 'Màn hình chính', path: path.join(homeDir, 'Desktop'), icon: 'desktop' },
      { name: 'Thư mục Tải về', path: path.join(homeDir, 'Downloads'), icon: 'downloads' },
      { name: 'Thư mục Tài liệu', path: path.join(homeDir, 'Documents'), icon: 'documents' },
      { name: 'Thư mục dự án', path: process.cwd(), icon: 'workspace' }
    ].filter(item => {
      try {
        return fs.existsSync(item.path);
      } catch {
        return false;
      }
    });

    // Detect all active Windows drives
    const drives: { name: string; path: string }[] = [];
    const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const char of driveLetters) {
      const drive = `${char}:\\`;
      try {
        if (fs.existsSync(drive)) {
          drives.push({ name: `Ổ đĩa (${char}:)`, path: drive });
        }
      } catch {}
    }

    if (!dirPath) {
      // Default to the project directory for immediate discovery
      dirPath = process.cwd();
    }

    const targetPath = path.normalize(dirPath);

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        { success: false, message: 'Đường dẫn thư mục không tồn tại trên hệ thống.', drives, quickAccess },
        { status: 400 }
      );
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { success: false, message: 'Đường dẫn được chọn không phải là một thư mục.', drives, quickAccess },
        { status: 400 }
      );
    }

    // Read directories sync and map types
    const dirents = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = dirents
      .map((dirent) => {
        try {
          return {
            name: dirent.name,
            type: dirent.isDirectory() ? 'dir' : 'file',
            ext: dirent.isFile() ? path.extname(dirent.name).substring(1).toLowerCase() : undefined
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({
      success: true,
      currentPath: path.resolve(targetPath),
      items,
      drives,
      quickAccess
    });
  } catch (err: any) {
    console.error('Lỗi khi duyệt file system:', err);
    return NextResponse.json(
      { success: false, message: `Lỗi truy xuất thư mục: ${err.message}` },
      { status: 500 }
    );
  }
}

