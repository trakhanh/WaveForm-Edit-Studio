import { RenderConfig } from '../types/render';
import { RenderJob, LogMessage, JobStatus } from '../types/job';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// Global RAM store for active jobs and active processes
const globalJobs = new Map<string, RenderJob>();
const globalProcesses = new Map<string, ChildProcess>();

export const mockJobStore = {
  safePushLog(job: RenderJob, level: LogMessage['level'], message: string) {
    if (!message) return;

    // 1. Check if we can merge in-place to avoid duplicate incremental updates
    const lastLog = job.logs[job.logs.length - 1];
    
    // Helper to identify dynamic progress logs
    const isProgressLog = (msg: string) => {
      return msg.includes("Đang tiến hành dựng sóng âm") || 
             msg.includes("Đang đóng gói và mã hóa video") ||
             msg.includes("dựng sóng âm:");
    };

    if (lastLog && isProgressLog(lastLog.message) && isProgressLog(message)) {
      // If they are the same step, update in-place
      const getStepType = (msg: string) => {
        if (msg.includes("dựng sóng âm")) return "wave";
        if (msg.includes("đóng gói") || msg.includes("mã hóa")) return "ffmpeg";
        return "other";
      };

      if (getStepType(lastLog.message) === getStepType(message)) {
        lastLog.message = message;
        lastLog.level = level;
        lastLog.timestamp = new Date().toISOString();
        return;
      }
    }

    // 2. Otherwise append a new log
    job.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message
    });

    // 3. Cap maximum log count to prevent RAM bloat and network payload issues (SSE transfer)
    const MAX_LOGS = 150;
    if (job.logs.length > MAX_LOGS) {
      const headerLogs = job.logs.slice(0, 10);
      const recentLogs = job.logs.slice(-(MAX_LOGS - 11));
      job.logs = [
        ...headerLogs,
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: '... [Nhật ký cũ đã được rút gọn để tối ưu hóa hiệu suất] ...'
        },
        ...recentLogs
      ];
    }
  },

  createJob(config: RenderConfig): RenderJob {
    const id = `job_${Math.random().toString(36).substring(2, 9)}`;
    const newJob: RenderJob = {
      id,
      config,
      status: 'PENDING',
      progress: 0,
      createdAt: new Date().toISOString(),
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Tạo yêu cầu ghép video mới. Trạng thái: Đang chờ trong hàng đợi.'
        }
      ]
    };

    globalJobs.set(id, newJob);
    this.startRealJob(id);
    return newJob;
  },

  getJob(id: string): RenderJob | undefined {
    return globalJobs.get(id);
  },

  cancelJob(id: string): boolean {
    const job = globalJobs.get(id);
    if (!job) return false;

    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return false;
    }

    job.status = 'CANCELLED';
    this.safePushLog(job, 'warn', 'Nhận tín hiệu hủy yêu cầu từ người dùng. Đang chấm dứt các tiến trình liên quan...');

    // Kill background process if active
    const child = globalProcesses.get(id);
    if (child) {
      try {
        // Send terminate signal
        child.kill();
        globalProcesses.delete(id);
        this.safePushLog(job, 'error', 'Đã dừng tiến trình Python Worker thành công.');
      } catch (err: any) {
        this.safePushLog(job, 'warn', `Lỗi khi kết thúc tiến trình Python: ${err.message}`);
      }
    }

    this.safePushLog(job, 'error', 'Đã hủy xử lý ghép video thành công. Trạng thái: CANCELLED.');

    globalJobs.set(id, job);
    return true;
  },

  startRealJob(id: string) {
    const job = globalJobs.get(id);
    if (!job) return;

    job.status = 'PROCESSING';
    job.startedAt = new Date().toISOString();
    this.safePushLog(job, 'info', 'Nhận Job từ hàng đợi và chuyển sang trạng thái PROCESSING.');
    globalJobs.set(id, job);

    // Prepare temp_jobs directory
    const tempJobsDir = path.join(process.cwd(), 'temp_jobs');
    if (!fs.existsSync(tempJobsDir)) {
      fs.mkdirSync(tempJobsDir, { recursive: true });
    }

    const configPath = path.join(tempJobsDir, `job_${id}.json`);
    try {
      fs.writeFileSync(configPath, JSON.stringify(job.config, null, 2), 'utf-8');
    } catch (e: any) {
      this.failJob(id, `Lỗi khi ghi tệp cấu hình tạm thời: ${e.message}`);
      return;
    }

    // Spawn Python background worker
    const pythonExecutable = 'python';
    const scriptPath = path.join(process.cwd(), 'worker-python', 'worker.py');
    
    this.addJobLog(id, 'info', 'Đang khởi chạy tiến trình Python worker...');
    
    const child = spawn(pythonExecutable, ['-u', scriptPath, '--config', configPath], {
      cwd: process.cwd()
    });

    globalProcesses.set(id, child);

    let stdoutBuffer = '';

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      // Save the last incomplete line back to the buffer
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.percent !== undefined) {
            const pct = parsed.percent;
            const logMsg = parsed.log || '';
            
            if (parsed.error) {
              this.failJob(id, parsed.error);
            } else if (pct === 100) {
              this.completeJob(id, job.config.media.outputFilename);
            } else {
              this.updateJobProgress(id, pct, logMsg);
            }
          }
        } catch (e) {
          // Fallback if not JSON format
          this.addJobLog(id, 'info', `[Python stdout]: ${line.trim()}`);
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const errorMsg = chunk.toString().trim();
      if (errorMsg) {
        // Log standard worker logs or FFmpeg outputs
        this.addJobLog(id, 'info', `[FFmpeg/Worker log]: ${errorMsg}`);
      }
    });

    child.on('close', (code) => {
      globalProcesses.delete(id);
      
      // Clean up config file
      try {
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
      } catch (e) {
        console.error('Lỗi khi xóa tệp cấu hình tạm:', e);
      }

      const activeJob = globalJobs.get(id);
      if (activeJob && activeJob.status === 'PROCESSING') {
        if (code === 0) {
          this.completeJob(id, job.config.media.outputFilename);
        } else {
          this.failJob(id, `Tiến trình Python worker dừng bất thường với mã thoát: ${code}`);
        }
      }
    });

    child.on('error', (err) => {
      globalProcesses.delete(id);
      
      // Clean up config file
      try {
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
      } catch (e) {}

      this.failJob(id, `Không thể kích hoạt Python worker: ${err.message}`);
    });
  },

  updateJobProgress(id: string, progress: number, logMessage: string) {
    const job = globalJobs.get(id);
    if (!job) return;
    
    job.status = 'PROCESSING';
    job.progress = progress;
    if (logMessage) {
      this.safePushLog(job, 'info', logMessage);
    }
    
    if (job.startedAt) {
      const elapsed = Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000);
      job.elapsedTime = elapsed;
      if (progress > 0 && progress < 100) {
        const totalEstimatedTime = (elapsed / progress) * 100;
        job.remainingTime = Math.max(0, Math.round(totalEstimatedTime - elapsed));
      }
    }
    
    globalJobs.set(id, job);
  },

  failJob(id: string, error: string) {
    const job = globalJobs.get(id);
    if (!job) return;
    
    job.status = 'FAILED';
    this.safePushLog(job, 'error', error);
    
    globalJobs.set(id, job);
  },

  completeJob(id: string, outputPath?: string) {
    const job = globalJobs.get(id);
    if (!job) return;
    
    job.status = 'COMPLETED';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.remainingTime = 0;
    
    const finalPath = outputPath || job.config.media.outputFilename;
    this.safePushLog(job, 'success', `Hoàn tất kết xuất video thành công! Tệp tin đầu ra được xuất tại: ${finalPath}`);
    
    globalJobs.set(id, job);
  },

  addJobLog(id: string, level: 'info' | 'warn' | 'error' | 'success', message: string) {
    const job = globalJobs.get(id);
    if (!job) return;
    
    this.safePushLog(job, level, message);
    globalJobs.set(id, job);
  }
};
