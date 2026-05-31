import { NextRequest, NextResponse } from 'next/server';
import { mockJobStore } from '@/lib/mockJobStore';
import { RenderConfig } from '@/types/render';

export async function POST(req: NextRequest) {
  try {
    const config: RenderConfig = await req.json();
    
    if (!config.media?.voiceFile) {
      return NextResponse.json(
        { success: false, message: 'Thiếu tệp giọng đọc voiceFile đầu vào.' },
        { status: 400 }
      );
    }

    const job = mockJobStore.createJob(config);
    return NextResponse.json(job, { status: 201 });
  } catch (err: unknown) {
    console.error('Lỗi khi start job:', err);
    return NextResponse.json(
      { success: false, message: 'Dữ liệu cấu hình không hợp lệ.' },
      { status: 500 }
    );
  }
}
