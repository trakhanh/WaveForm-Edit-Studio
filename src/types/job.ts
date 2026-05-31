import { RenderConfig } from './render';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface LogMessage {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface RenderJob {
  id: string;
  config: RenderConfig;
  status: JobStatus;
  progress: number; // 0 to 100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  elapsedTime?: number; // in seconds
  remainingTime?: number; // in seconds (ETA)
  logs: LogMessage[];
}
