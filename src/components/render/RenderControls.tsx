'use client';

import React from 'react';
import { JobStatus } from '@/types/job';
import { Play, Square, Loader2 } from 'lucide-react';

interface RenderControlsProps {
  onStart: () => void;
  onCancel: () => void;
  status: JobStatus;
}

export default function RenderControls({ onStart, onCancel, status }: RenderControlsProps) {
  const isProcessing = status === 'PROCESSING';

  return (
    <div 
      className="store-card"
      style={{
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: 'var(--bg-deep-card)',
        border: '1px solid var(--border-neon)',
        borderRadius: '12px',
        backdropFilter: 'blur(25px)',
        boxShadow: '0 8px 32px rgba(225, 29, 72, 0.08)'
      }}
    >
      {/* Primary Pill CTA - Start rendering */}
      <button
        onClick={onStart}
        disabled={isProcessing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 20px',
          borderRadius: '9999px', // pill shape
          border: 'none',
          background: isProcessing 
            ? 'rgba(255, 255, 255, 0.05)' 
            : 'linear-gradient(135deg, var(--neon-rose), var(--neon-purple))',
          color: isProcessing ? 'var(--text-muted)' : '#ffffff',
          fontWeight: '700',
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.5px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          boxShadow: isProcessing ? 'none' : '0 4px 20px rgba(225, 29, 72, 0.45)',
          transition: 'all 200ms ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.filter = 'brightness(1.15)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(225, 29, 72, 0.65)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(225, 29, 72, 0.45)';
          }
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            <span>ĐANG XỬ LÝ...</span>
          </>
        ) : (
          <>
            <Play size={16} fill="currentColor" />
            <span>BẮT ĐẦU GHÉP VIDEO</span>
          </>
        )}
      </button>

      {/* Secondary Ghost Pill CTA - Cancel rendering */}
      <button
        onClick={onCancel}
        disabled={!isProcessing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 20px',
          borderRadius: '9999px',
          border: isProcessing ? '1.5px solid var(--neon-rose)' : '1.5px solid var(--border-light)',
          backgroundColor: isProcessing ? 'rgba(225, 29, 72, 0.08)' : 'var(--bg-input)',
          color: isProcessing ? 'var(--neon-rose)' : 'var(--text-muted)',
          fontWeight: '700',
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.5px',
          cursor: isProcessing ? 'pointer' : 'not-allowed',
          transition: 'all 200ms ease',
          outline: 'none',
          opacity: isProcessing ? 1 : 0.4,
          boxShadow: isProcessing ? '0 0 12px rgba(225, 29, 72, 0.15)' : 'none'
        }}
        onMouseEnter={(e) => {
          if (isProcessing) {
            e.currentTarget.style.backgroundColor = 'var(--neon-rose)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = 'var(--neon-rose)';
          }
        }}
        onMouseLeave={(e) => {
          if (isProcessing) {
            e.currentTarget.style.backgroundColor = 'rgba(225, 29, 72, 0.08)';
            e.currentTarget.style.borderColor = 'var(--neon-rose)';
            e.currentTarget.style.color = 'var(--neon-rose)';
          }
        }}
      >
        <Square size={16} fill={isProcessing ? 'currentColor' : 'none'} />
        <span>HỦY XỬ LÝ</span>
      </button>
    </div>
  );
}

