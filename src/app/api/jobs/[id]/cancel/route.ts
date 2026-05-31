import { NextRequest, NextResponse } from 'next/server';
import { mockJobStore } from '@/lib/mockJobStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = mockJobStore.cancelJob(id);
  
  if (!success) {
    return NextResponse.json(
      { success: false, message: 'Hủy xử lý thất bại hoặc Job đã hoàn tất.' },
      { status: 400 }
    );
  }
  
  return NextResponse.json({ success: true, message: 'Đã hủy xử lý video thành công.' });
}
