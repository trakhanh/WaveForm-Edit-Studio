import { NextRequest, NextResponse } from 'next/server';
import { mockJobStore } from '@/lib/mockJobStore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = mockJobStore.getJob(id);
  
  if (!job) {
    return NextResponse.json(
      { success: false, message: 'Không tìm thấy mã Job yêu cầu.' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(job);
}
