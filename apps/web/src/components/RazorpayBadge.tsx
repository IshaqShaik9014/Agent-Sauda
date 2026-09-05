import React from 'react';

interface RazorpayBadgeProps {
  className?: string;
  theme?: 'dark' | 'light';
}

export function RazorpayBadge({
  className = '',
  theme = 'dark'
}: RazorpayBadgeProps) {
  const isLight = theme === 'light';

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-medium tracking-tight ${
        isLight
          ? 'bg-slate-100/90 border-slate-200 text-slate-700'
          : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
      } ${className}`}
    >
      <span className={isLight ? 'text-slate-500 text-[11px]' : 'text-zinc-400 text-[11px]'}>
        Built with
      </span>

      {/* Official Razorpay Logo SVG */}
      <div className="flex items-center gap-1">
        <svg
          viewBox="0 0 120 30"
          className="h-4 w-auto"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Razorpay Lightning Blade */}
          <path
            d="M12.5 2L3 17.5H10.5L7.5 28L21 11.5H13.5L16.5 2H12.5Z"
            fill="#0C2340"
            className={isLight ? 'fill-[#0C2340]' : 'fill-[#528FF0]'}
          />
          <path
            d="M8.5 17.5L18.5 5.5H13.5L10.5 14L8.5 17.5Z"
            fill="#008ECC"
          />
          {/* Razorpay Wordmark */}
          <text
            x="24"
            y="20"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="800"
            fontSize="18"
            letterSpacing="-0.5"
            fill={isLight ? '#0C2340' : '#FFFFFF'}
          >
            Razorpay
          </text>
        </svg>
      </div>

      <span className={`h-3.5 w-px ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`} />

      <span
        className={`text-[11px] font-semibold hidden sm:inline ${
          isLight ? 'text-slate-600' : 'text-zinc-300'
        }`}
      >
        Secure Payments for the Agentic Era
      </span>
    </div>
  );
}
