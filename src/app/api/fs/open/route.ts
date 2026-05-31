import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, filePath } = body;

    if (!filePath) {
      return NextResponse.json({ success: false, message: 'Đường dẫn tệp tin không hợp lệ.' }, { status: 400 });
    }

    const normPath = path.normalize(filePath);

    if (!fs.existsSync(normPath)) {
      return NextResponse.json({ success: false, message: 'Tệp tin không tồn tại trên hệ thống.' }, { status: 400 });
    }

    if (action === 'folder') {
      // explorer.exe /select,"C:\path\to\video.mp4"
      // Mở thư mục cha và tự động bôi đậm/chọn file video đó
      exec(`explorer.exe /select,"${normPath}"`);
      return NextResponse.json({ success: true, message: 'Đã mở thư mục thành công.' });
    } else if (action === 'play') {
      // cmd.exe /c start "" "C:\path\to\video.mp4"
      // Phát video trên trình phát media mặc định của hệ điều hành Windows
      exec(`cmd.exe /c start "" "${normPath}"`);
      return NextResponse.json({ success: true, message: 'Đang khởi chạy phát video...' });
    } else {
      return NextResponse.json({ success: false, message: 'Hành động không được hỗ trợ.' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Lỗi khi mở tệp:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
