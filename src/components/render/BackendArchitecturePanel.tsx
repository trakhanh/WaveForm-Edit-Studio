'use client';

import React, { useState } from 'react';
import { backendPlan } from '@/lib/backendPlan';
import { Network, Server, ArrowRight, ShieldCheck, ChevronRight, Cpu } from 'lucide-react';

export default function BackendArchitecturePanel() {
  const [activeSpec, setActiveSpec] = useState<number | null>(null);

  return (
    <div 
      style={{
        padding: '24px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '16px' }}>
        <Network size={22} style={{ color: '#10b981' }} />
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#f1f5f9', letterSpacing: '0.5px' }}>
            {backendPlan.title}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            {backendPlan.description}
          </p>
        </div>
      </div>

      {/* Visually Stunning HTML/CSS Architecture Flowchart */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 40px 1fr 40px 1fr',
          alignItems: 'center',
          gap: '12px',
          padding: '20px',
          backgroundColor: '#07080e',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          overflowX: 'auto'
        }}
      >
        {/* Card 1: Client Browser */}
        <div 
          style={{
            padding: '16px',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc' }}>
            <Server size={16} />
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>1. Trình duyệt Web</span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            React Next.js UI thực hiện cấu hình các preset, preview canvas, và kết nối Server-Sent Events (SSE) để nhận log thời gian thực.
          </span>
        </div>

        {/* Arrow 1 */}
        <div style={{ display: 'flex', justifyContent: 'center', color: '#6366f1' }}>
          <ArrowRight size={20} />
        </div>

        {/* Card 2: API Gateway & Queue */}
        <div 
          style={{
            padding: '16px',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(10, 185, 129, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 0 15px rgba(10, 185, 129, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
            <ShieldCheck size={16} />
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>2. API & Queue Layer</span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Next.js API Routes đóng vai trò điều phối, tạo Job và đẩy tức thì vào hàng đợi (Redis/BullMQ) trong vòng chưa đầy 100ms.
          </span>
        </div>

        {/* Arrow 2 */}
        <div style={{ display: 'flex', justifyContent: 'center', color: '#10b981' }}>
          <ArrowRight size={20} />
        </div>

        {/* Card 3: Python Render Worker */}
        <div 
          style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
            <Cpu size={16} />
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>3. Python Worker</span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Dịch vụ ngầm chuyên dụng chạy FFmpeg thật, sinh sóng âm (8kHz wav), xử lý mặt nạ ảnh bằng Pillow và ghi nhãn phụ đề ASS.
          </span>
        </div>
      </div>

      {/* Accordion List for 9 Production Specifications */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
          ĐẶC TẢ CHI TIẾT HỆ THỐNG SẢN XUẤT (PRODUCTION SPECS)
        </span>
        
        {backendPlan.specifications.map((spec, idx) => {
          const isOpen = activeSpec === idx;
          return (
            <div 
              key={idx}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                overflow: 'hidden',
                transition: 'all 0.2s'
              }}
            >
              {/* Accordion Toggle */}
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  cursor: 'pointer',
                  backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.03)' : 'transparent'
                }}
                onClick={() => setActiveSpec(isOpen ? null : idx)}
                onMouseEnter={(e) => {
                  if (!isOpen) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)';
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ color: isOpen ? '#6366f1' : '#f1f5f9', fontWeight: 'bold', fontSize: '14px' }}>
                  {spec.title}
                </span>
                <ChevronRight 
                  size={16} 
                  style={{ 
                    color: '#64748b', 
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s' 
                  }} 
                />
              </div>

              {/* Accordion Content */}
              {isOpen && (
                <div 
                  style={{
                    padding: '16px 18px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.03)',
                    color: '#94a3b8',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {spec.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
