import { NextRequest } from 'next/server';
import { mockJobStore } from '@/lib/mockJobStore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = mockJobStore.getJob(id);

  if (!job) {
    return new Response(
      JSON.stringify({ success: false, message: 'Không tìm thấy Job.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      // Send initial state immediately
      const initialJob = mockJobStore.getJob(id);
      if (initialJob) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialJob)}\n\n`));
      }

      let lastLogsCount = initialJob?.logs.length ?? 0;

      const interval = setInterval(() => {
        const activeJob = mockJobStore.getJob(id);
        if (!activeJob) {
          controller.close();
          clearInterval(interval);
          return;
        }

        // Send updates if there's progress or new logs
        const currentLogsCount = activeJob.logs.length;
        if (currentLogsCount !== lastLogsCount || activeJob.progress > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(activeJob)}\n\n`));
          lastLogsCount = currentLogsCount;
        }

        // Close stream on completion
        if (
          activeJob.status === 'COMPLETED' ||
          activeJob.status === 'FAILED' ||
          activeJob.status === 'CANCELLED'
        ) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Clean up interval when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    }
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'none'
    }
  });
}
