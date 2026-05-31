import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const { voiceFile, model = 'small', language = 'auto' } = await req.json();

    if (!voiceFile) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu đường dẫn tệp giọng đọc voiceFile.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedInputPath = path.normalize(voiceFile);
    if (!fs.existsSync(normalizedInputPath)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tệp giọng đọc đầu vào không tồn tại.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Xác định đường dẫn file SRT đầu ra (cùng thư mục với file âm thanh)
    const ext = path.extname(normalizedInputPath);
    const dir = path.dirname(normalizedInputPath);
    const base = path.basename(normalizedInputPath, ext);
    const outputPath = path.join(dir, `${base}.srt`);

    const pythonExecutable = 'python';
    const scriptPath = path.join(process.cwd(), 'worker-python', 'transcribe_whisper.py');

    const pythonProcess = spawn(pythonExecutable, [
      '-u',
      scriptPath,
      '--input', normalizedInputPath,
      '--output', outputPath,
      '--model', model,
      '--language', language
    ]);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let stdoutBuffer = '';

        pythonProcess.stdout.on('data', (chunk) => {
          stdoutBuffer += chunk.toString();
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            controller.enqueue(encoder.encode(`data: ${line.trim()}\n\n`));
          }
        });

        pythonProcess.stderr.on('data', (chunk) => {
          const errLog = chunk.toString().trim();
          if (errLog) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ percent: 0, log: `[stderr]: ${errLog}` })}\n\n`)
            );
          }
        });

        pythonProcess.on('close', (code) => {
          if (stdoutBuffer.trim()) {
            controller.enqueue(encoder.encode(`data: ${stdoutBuffer.trim()}\n\n`));
          }

          if (code !== 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ percent: 0, error: `Tiến trình Whisper kết thúc với mã lỗi: ${code}` })}\n\n`)
            );
          }
          controller.close();
        });

        // Hủy tiến trình Python nếu client ngắt kết nối
        req.signal.addEventListener('abort', () => {
          try {
            pythonProcess.kill();
          } catch (e) {}
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'none'
      }
    });

  } catch (err: any) {
    console.error('Lỗi khi transcribe:', err);
    return new Response(
      JSON.stringify({ success: false, message: `Lỗi máy chủ khi tạo phụ đề: ${err.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
