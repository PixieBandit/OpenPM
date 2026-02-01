
import React from 'react';
import { AgentState } from '../types';

interface AvatarProps {
  type: 'nova' | 'spark' | 'quartz';
  state: AgentState;
  size?: 'sm' | 'md' | 'lg';
}

export const AgentAvatar: React.FC<AvatarProps> = ({ type, state, size = 'md' }) => {
  const getThemeColors = () => {
    if (state === 'ERROR') return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.6)]', halo: 'rgba(244,63,94,0.4)' };
    if (state === 'SUCCESS') return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]', halo: 'rgba(16,185,129,0.3)' };
    if (type === 'nova') return { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', glow: 'shadow-[0_0_15px_rgba(99,102,241,0.3)]', halo: 'rgba(99,102,241,0.5)' };
    if (type === 'spark') return { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', glow: 'shadow-[0_0_15px_rgba(20,184,166,0.3)]', halo: 'rgba(20,184,166,0.5)' };
    return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]', halo: 'rgba(245,158,11,0.5)' };
  };

  const colors = getThemeColors();
  const sizeClasses = { sm: 'w-10 h-10 p-1', md: 'w-16 h-16 p-2', lg: 'w-24 h-24 p-3' };
  const isActive = state !== 'IDLE';

  return (
    <div className={`relative ${sizeClasses[size]} flex items-center justify-center rounded-[1.25rem] border ${colors.border} ${colors.bg} transition-all duration-500 ${isActive ? colors.glow + ' scale-105' : ''}`}>
      <style>{`
        @keyframes scanline { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(100%); opacity: 0; } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.2); opacity: 0; } }
        @keyframes thinking-glow { 0%, 100% { opacity: 0.4; filter: blur(4px); } 50% { opacity: 0.8; filter: blur(8px); } }
        @keyframes working-pulse { 0% { box-shadow: 0 0 0 0 ${colors.halo}; transform: scale(1); } 50% { box-shadow: 0 0 20px 10px transparent; transform: scale(1.05); } 100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); } }
        @keyframes data-stream { 0% { opacity: 0.2; transform: translateY(-10px) scale(0.5); } 50% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0.2; transform: translateY(10px) scale(0.5); } }
        @keyframes glitch-heavy {
          0% { transform: translate(0); clip-path: inset(0% 0% 0% 0%); }
          20% { transform: translate(-2px, 2px); clip-path: inset(10% 0% 40% 0%); }
          40% { transform: translate(-2px, -2px); clip-path: inset(50% 0% 10% 0%); }
          60% { transform: translate(2px, 2px); clip-path: inset(20% 0% 60% 0%); }
          80% { transform: translate(2px, -2px); clip-path: inset(70% 0% 5% 0%); }
          100% { transform: translate(0); clip-path: inset(0% 0% 0% 0%); }
        }
      `}</style>

      {isActive && state !== 'ERROR' && state !== 'THINKING' && state !== 'WORKING' && state !== 'SCANNING' && (
        <div className={`absolute inset-0 rounded-[1.25rem] ${colors.bg} animate-[pulse-ring_2s_infinite] opacity-30`} />
      )}

      {state === 'THINKING' && (
        <div className={`absolute inset-0 rounded-[1.25rem] ${colors.bg} animate-[thinking-glow_1.5s_infinite]`} />
      )}

      {(state === 'WORKING' || state === 'SCANNING') && (
        <div className={`absolute inset-0 rounded-[1.25rem] ${colors.bg} animate-[working-pulse_2.5s_infinite] border-2 ${colors.border}`} />
      )}

      <div className={`relative w-full h-full transition-all duration-700 ${state === 'IDLE' ? 'opacity-60' : 'opacity-100'} ${state === 'ERROR' ? 'animate-[glitch-heavy_0.2s_infinite]' : ''}`}>
        
        {(state === 'WORKING' || state === 'SCANNING') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-0.5 h-4 bg-current rounded-full animate-[data-stream_0.8s_infinite]`} style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {type === 'nova' && (
          <svg viewBox="0 0 100 100" className={`w-full h-full ${colors.text}`}>
            <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="10" fill="currentColor" className={state === 'THINKING' ? 'animate-pulse' : ''} />
            <path d="M50 20 L50 30 M80 50 L70 50 M50 80 L50 70 M20 50 L30 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}

        {type === 'spark' && (
          <svg viewBox="0 0 100 100" className={`w-full h-full ${colors.text}`}>
            <rect x="25" y="30" width="50" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M35 50 L45 50 M55 50 L65 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M30 20 L40 30 M70 20 L60 30" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}

        {type === 'quartz' && (
          <svg viewBox="0 0 100 100" className={`w-full h-full ${colors.text}`}>
            <path d="M50 15 L85 30 L85 70 L50 85 L15 70 L15 30 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {state === 'SCANNING' && (
              <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="1" className="animate-[scanline_1s_infinite]" />
            )}
          </svg>
        )}
      </div>
    </div>
  );
};
