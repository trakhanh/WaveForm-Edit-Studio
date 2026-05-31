import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imagePath = body.imagePath || '';

    if (!imagePath) {
      return NextResponse.json(
        { success: false, message: 'Thiếu đường dẫn hình ảnh cần xóa nền (imagePath).' },
        { status: 400 }
      );
    }

    const normalizedInputPath = path.normalize(imagePath);

    if (!fs.existsSync(normalizedInputPath)) {
      return NextResponse.json(
        { success: false, message: 'Hình ảnh đầu vào không tồn tại.' },
        { status: 404 }
      );
    }

    // Determine the output path (insert _nobg suffix before extension, save as .png)
    const ext = path.extname(normalizedInputPath);
    const dir = path.dirname(normalizedInputPath);
    const base = path.basename(normalizedInputPath, ext);
    const outputPath = path.join(dir, `${base}_nobg.png`);

    // Execute the Python background removal helper
    const pythonExecutable = 'python';
    const scriptPath = path.join(process.cwd(), 'worker-python', 'remove_bg.py');

    const pythonProcess = spawn(pythonExecutable, [
      scriptPath,
      '--input', normalizedInputPath,
      '--output', outputPath
    ]);

    let stderr = '';
    let stdout = '';

    await new Promise<void>((resolve, reject) => {
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `Python exit code: ${code}`));
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      return NextResponse.json(
        { success: false, message: 'Tệp xuất ra không được tạo.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      originalPath: normalizedInputPath,
      noBgPath: outputPath,
      message: 'Xóa nền hình ảnh thành công!'
    });

  } catch (err: any) {
    console.error('Lỗi khi xóa nền hình ảnh:', err);
    return NextResponse.json(
      { success: false, message: `Lỗi máy chủ khi xóa nền: ${err.message}` },
      { status: 500 }
    );
  }
}
