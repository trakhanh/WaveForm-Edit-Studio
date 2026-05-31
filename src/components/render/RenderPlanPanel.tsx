'use client';

import React, { useState, useEffect } from 'react';
import { RenderConfig } from '@/types/render';
import { generateFfmpegPlan } from '@/lib/ffmpegPlan';
import { Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface RenderPlanPanelProps {
  config: RenderConfig;
}

export default function RenderPlanPanel({ config }: RenderPlanPanelProps) {
  const [planMarkdown, setPlanMarkdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setPlanMarkdown(generateFfmpegPlan(config));
  }, [config]);

  const handleCopy = () => {
    navigator.clipboard.writeText(planMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      style={{
        backgroundColor: 'rgba(30, 41, 59, 0.3)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Panel Header */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={18} style={{ color: '#818cf8' }} />
          <span style={{ color: '#f1f5f9', fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px' }}>
            KẾ HOẠCH BỘ LỌC FFMEG CHI TIẾT
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      {expanded && (
        <div 
          style={{
            padding: '20px',
            maxHeight: '400px',
            overflowY: 'auto',
            color: '#e2e8f0',
            fontSize: '14px',
            lineHeight: '1.7',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Custom rendered markdown styled with standard elements */}
          <div className="markdown-body">
            {planMarkdown.split('\n\n').map((block, blockIdx) => {
              if (block.startsWith('### ')) {
                return (
                  <h3 key={blockIdx} style={{ color: '#818cf8', fontSize: '16px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px', borderBottom: '1px solid rgba(129, 140, 248, 0.2)', paddingBottom: '6px' }}>
                    {block.substring(4)}
                  </h3>
                );
              }
              if (block.startsWith('#### ')) {
                return (
                  <h4 key={blockIdx} style={{ color: '#a5b4fc', fontSize: '14px', fontWeight: 'bold', marginTop: '12px', marginBottom: '6px' }}>
                    {block.substring(5)}
                  </h4>
                );
              }
              if (block.startsWith('- ')) {
                return (
                  <ul key={blockIdx} style={{ paddingLeft: '20px', margin: '8px 0' }}>
                    {block.split('\n').map((item, itemIdx) => (
                      <li key={itemIdx} style={{ marginBottom: '4px', color: '#cbd5e1' }}>
                        {item.substring(2).replace(/\*\*(.*?)\*\*/g, '$1').replace(/\`(.*?)\`/g, '$1')}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.includes('```bash')) {
                // Code block extraction
                const codeLines = block
                  .replace(/```bash\n/, '')
                  .replace(/\n```/, '')
                  .trim();
                return (
                  <pre 
                    key={blockIdx}
                    style={{
                      backgroundColor: 'rgba(10, 11, 16, 0.8)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontFamily: 'Consolas, monospace',
                      fontSize: '13px',
                      overflowX: 'auto',
                      margin: '12px 0',
                      color: '#38bdf8' // Blue code color
                    }}
                  >
                    <code>{codeLines}</code>
                  </pre>
                );
              }
              return (
                <p key={blockIdx} style={{ color: '#94a3b8', marginBottom: '10px' }}>
                  {block.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\`(.*?)\`/g, '$1')}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
