import { RenderConfig } from '../types/render';
import { RenderJob } from '../types/job';

export const jobClient = {
  async startJob(config: RenderConfig): Promise<RenderJob> {
    const response = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Lỗi khi bắt đầu yêu cầu render');
    }
    
    return response.json();
  },
  
  async getJob(id: string): Promise<RenderJob | null> {
    const response = await fetch(`/api/jobs/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Không thể tải trạng thái yêu cầu');
    }
    return response.json();
  },
  
  async cancelJob(id: string): Promise<boolean> {
    const response = await fetch(`/api/jobs/${id}/cancel`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Lỗi khi yêu cầu hủy');
    }
    
    const result = await response.json();
    return result.success;
  }
};
