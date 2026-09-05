import React from 'react';

interface AgentSaudaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  subtitle?: string;
  theme?: 'dark' | 'light' | 'auto';
}

export function AgentSaudaLogo({
  className = '',
  size = 'md',
  showSubtitle = true,
  subtitle = 'AI Commerce Infrastructure',
  theme = 'auto'
}: AgentSaudaLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const subSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs'
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Origami / Ribbon Folded Triangle Logo */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          <defs>
            <linearGradient id="sauda-g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
            <linearGradient id="sauda-g2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="sauda-g3" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4338CA" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          {/* Left Wing */}
          <path
            d="M24 6L6 38H18L24 26L30 38H42L24 6Z"
            fill="url(#sauda-g1)"
            opacity="0.95"
          />
          {/* Inner Fold Accent */}
          <path
            d="M24 14L13 34H21L24 28L27 34H35L24 14Z"
            fill="url(#sauda-g2)"
          />
          {/* Base Crossbar Ribbon */}
          <path
            d="M16 38L24 24L32 38H40L24 10L8 38H16Z"
            fill="url(#sauda-g3)"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col">
        <div className={`font-black tracking-tight leading-none ${textSizes[size]}`}>
          <span className={theme === 'light' ? 'text-slate-900' : 'text-white'}>
            Agent
          </span>{' '}
          <span className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Sauda
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`font-medium tracking-normal mt-0.5 ${subSizes[size]} ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
