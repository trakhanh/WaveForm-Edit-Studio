import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PRESET } from '@/lib/presetStorage';

// Server-side presets store (in memory)
const presetsStore: Record<string, typeof DEFAULT_PRESET> = {
  'Mặc định': DEFAULT_PRESET
};

export async function GET() {
  return NextResponse.json(presetsStore);
}

export async function POST(req: NextRequest) {
  try {
    const { name, config } = await req.json();
    
    if (!name || !config) {
      return NextResponse.json(
        { success: false, message: 'Thiếu tên hoặc nội dung cấu hình Preset.' },
        { status: 400 }
      );
    }
    
    presetsStore[name] = config;
    return NextResponse.json({ success: true, message: `Lưu Preset '${name}' thành công.` });
  } catch (err: unknown) {
    console.error('Lỗi khi lưu preset:', err);
    return NextResponse.json(
      { success: false, message: 'Dữ liệu Preset không hợp lệ.' },
      { status: 500 }
    );
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    
    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Thiếu tên Preset cần xóa.' },
        { status: 400 }
      );
    }
    
    if (name === 'Mặc định') {
      return NextResponse.json(
        { success: false, message: 'Không được phép xóa Preset Mặc định.' },
        { status: 403 }
      );
    }
    
    if (presetsStore[name]) {
      delete presetsStore[name];
      return NextResponse.json({ success: true, message: `Đã xóa Preset '${name}' thành công.` });
    }
    
    return NextResponse.json(
      { success: false, message: 'Không tìm thấy Preset yêu cầu.' },
      { status: 404 }
    );
  } catch (err: unknown) {
    console.error('Lỗi khi xóa preset:', err);
    return NextResponse.json(
      { success: false, message: 'Lỗi máy chủ.' },
      { status: 500 }
    );
  }
}
