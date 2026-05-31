'use client';

import React from 'react';
import { JobStatus } from '@/types/job';
import { Clock, Hourglass, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

interface RenderProgressProps {
  progress: number;
  status: JobStatus;
  elapsedTime?: number; // in seconds
  remainingTime?: number; // in seconds
  error?: string;
  outputFilename?: string; // Path to exported video
  theme?: 'light' | 'dark';
}

export default function RenderProgress({ progress, status, elapsedTime = 0, remainingTime = 0, error, outputFilename, theme = 'dark' }: RenderProgressProps) {
  
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleOpenFileAction = async (action: 'folder' | 'play') => {
    if (!outputFilename) return;
    try {
      const res = await fetch('/api/fs/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, filePath: outputFilename })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Lỗi hệ thống: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Không thể kết nối với API: ${e.message}`);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'PENDING':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
            <Hourglass className="animate-pulse" size={16} />
            <span style={{ fontWeight: 'bold' }}>ĐANG CHỜ HÀNG ĐỢI</span>
          </div>
        );
      case 'PROCESSING':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1' }}>
            <RefreshCw className="animate-spin" size={16} style={{ animation: 'spin 2s linear infinite' }} />
            <span style={{ fontWeight: 'bold' }}>ĐANG KẾT XUẤT VIDEO</span>
          </div>
        );
      case 'COMPLETED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontWeight: 'bold' }}>ĐÃ HOÀN TẤT THÀNH CÔNG</span>
          </div>
        );
      case 'CANCELLED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
            <XCircle size={16} />
            <span style={{ fontWeight: 'bold' }}>ĐÃ HỦY XỬ LÝ</span>
          </div>
        );
      case 'FAILED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
            <AlertCircle size={16} />
            <span style={{ fontWeight: 'bold' }}>XẢY RA LỖI RENDER</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case 'COMPLETED':
        return 'linear-gradient(90deg, #10b981, #34d399)'; // Emerald
      case 'CANCELLED':
        return 'linear-gradient(90deg, #f59e0b, #fbbf24)'; // Amber
      case 'FAILED':
        return 'linear-gradient(90deg, #ef4444, #f87171)'; // Red
      case 'PROCESSING':
      default:
        return 'linear-gradient(90deg, #6366f1, #818cf8)'; // Indigo
    }
  };

  return (
    <div 
      className="store-card"
      style={{
        padding: '16px',
        backgroundColor: 'var(--bg-deep-card)',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        border: '1px solid var(--border-neon)',
        boxShadow: theme === 'light' ? '0 10px 40px rgba(15, 23, 42, 0.04)' : '0 10px 40px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* Top Status Indicators */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '10px'
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>TRẠNG THÁI HIỆN TẠI</span>
        {getStatusBadge()}
      </div>

      {/* Progress Slider Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: 'var(--text-pure)', fontSize: '14px', fontWeight: 'bold' }}>Tiến độ kết xuất</span>
          <span 
            style={{ 
              fontSize: '22px', 
              fontWeight: '900', 
              background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-indigo))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {progress}%
          </span>
        </div>
        
        {/* Progress Bar Track */}
        <div 
          style={{
            height: '10px',
            backgroundColor: 'var(--border-light)',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
            position: 'relative'
          }}
        >
          <div 
            style={{
              height: '100%',
              width: `${progress}%`,
              background: getProgressBarColor(),
              borderRadius: '6px',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: status === 'PROCESSING' ? '0 0 6px rgba(99, 102, 241, 0.4)' : 'none'
            }}
          />
        </div>
      </div>

      {/* Metrics Row (Elapsed and Remaining) */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginTop: '4px'
        }}
      >
        {/* Elapsed Time Block */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-light)'
          }}
        >
          <Clock size={16} style={{ color: 'var(--neon-indigo)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>THỜI GIAN ĐÃ CHẠY</span>
            <span style={{ fontSize: '15px', color: 'var(--text-bright)', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Remaining Time Block */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-light)'
          }}
        >
          <Hourglass size={16} style={{ color: 'var(--neon-purple)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>DỰ KIẾN CÒN LẠI (ETA)</span>
            <span style={{ fontSize: '15px', color: 'var(--text-bright)', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {status === 'PROCESSING' ? formatTime(remainingTime) : '00:00'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Message Block */}
      {status === 'FAILED' && error && (
        <div 
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '10px',
            color: '#f87171',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Completed Success Actions */}
      {status === 'COMPLETED' && outputFilename && (
        <div 
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            borderTop: '1px solid var(--border-light)',
            paddingTop: '16px'
          }}
        >
          <button
            onClick={() => handleOpenFileAction('folder')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'var(--bg-input)',
              border: '1.5px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text-bright)',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              transition: 'all 200ms ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-input)'}
          >
            📂 Mở thư mục chứa
          </button>
          <button
            onClick={() => handleOpenFileAction('play')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'var(--neon-emerald)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              transition: 'all 200ms ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            ▶ Phát video ngay
          </button>
        </div>
      )}
    </div>
  );
}
