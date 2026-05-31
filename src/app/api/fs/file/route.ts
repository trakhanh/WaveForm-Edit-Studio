import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path') || '';

    if (!filePath) {
      return new Response('Thiếu tham số path.', { status: 400 });
    }

    const normalizedPath = path.normalize(filePath);

    // Security check: Verify file exists and is indeed a file
    if (!fs.existsSync(normalizedPath)) {
      return new Response('Tệp tin không tồn tại.', { status: 404 });
    }

    const stat = fs.statSync(normalizedPath);
    if (!stat.isFile()) {
      return new Response('Đường dẫn được chọn không phải là tệp tin.', { status: 400 });
    }

    // Determine correct Content-Type based on extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.mkv') contentType = 'video/x-matroska';
    else if (ext === '.avi') contentType = 'video/x-msvideo';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.webp') contentType = 'image/webp';

    // Read file content
    const fileBuffer = fs.readFileSync(normalizedPath);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Lỗi khi đọc file cục bộ:', err);
    return new Response(`Lỗi máy chủ: ${err.message}`, { status: 500 });
  }
}
