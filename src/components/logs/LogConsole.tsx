'use client';

import React, { useEffect, useRef } from 'react';
import { LogMessage } from '@/types/job';

interface LogConsoleProps {
  logs: LogMessage[];
}

export default function LogConsole({ logs }: LogConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new log additions
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogLevelStyle = (level: LogMessage['level']) => {
    switch (level) {
      case 'success':
        return { text: '#10b981', symbol: '✔' }; // Emerald Green
      case 'warn':
        return { text: '#f59e0b', symbol: '⚠' }; // Amber Yellow
      case 'error':
        return { text: '#ef4444', symbol: '✘' }; // Bright Red
      case 'info':
      default:
        return { text: '#a5b4fc', symbol: '●' }; // Indigo Light
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('vi-VN', { hour12: false });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div 
      className="log-console-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '280px',
        backgroundColor: '#0a0b10', // Pitch dark
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.8), 0 4px 20px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
        fontSize: '13px',
        lineHeight: '1.6'
      }}
    >
      {/* Console Header */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#12131a',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
        </div>
        <span style={{ color: '#6366f1', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>
          NHẬT KÝ RENDER VIDEO CHUẨN REALTIME
        </span>
        <span style={{ color: '#4b5563', fontSize: '11px' }}>utf-8</span>
      </div>

      {/* Console Output */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          scrollBehavior: 'smooth'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#4b5563', fontStyle: 'italic', textAlign: 'center', marginTop: '60px' }}>
            Hệ thống đang sẵn sàng. Chờ lệnh bắt đầu ghép video...
          </div>
        ) : (
          logs.map((log, idx) => {
            const levelStyle = getLogLevelStyle(log.level);
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: '#e2e8f0',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                {/* Timestamp */}
                <span style={{ color: '#4b5563', flexShrink: 0, userSelect: 'none' }}>
                  [{formatTimestamp(log.timestamp)}]
                </span>
                
                {/* Level Indicator */}
                <span style={{ color: levelStyle.text, fontWeight: 'bold', flexShrink: 0 }}>
                  {levelStyle.symbol}
                </span>

                {/* Message */}
                <span style={{ wordBreak: 'break-all', color: log.level === 'success' ? '#34d399' : '#e2e8f0' }}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
