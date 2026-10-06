import React from 'react';

interface LogoProps {
  size?: number | 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 48, showText = true, className = '' }: LogoProps) {
  const pixelSize = typeof size === 'number' 
    ? size 
    : size === 'sm' ? 36 : size === 'lg' ? 64 : 48;

  return (
    <svg
      width={pixelSize}
      height={showText ? pixelSize * 1.3 : pixelSize}
      viewBox="0 0 120 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="goldGrad" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="30%" stopColor="#eab308" />
          <stop offset="60%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </radialGradient>
        <radialGradient id="goldGradInner" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#eab308" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Anneau exterieur */}
      <circle
        cx="60"
        cy="58"
        r="48"
        stroke="url(#goldGrad)"
        strokeWidth="9"
        fill="none"
        filter="url(#goldGlow)"
        strokeLinecap="round"
        strokeDasharray="245 45"
        strokeDashoffset="-22"
      />

      {/* Barre superieure Power */}
      <rect
        x="55"
        y="14"
        width="10"
        height="32"
        rx="5"
        fill="url(#goldGrad)"
        filter="url(#goldGlow)"
      />

      {/* Disque interieur */}
      <circle
        cx="60"
        cy="58"
        r="18"
        fill="url(#goldGradInner)"
        filter="url(#goldGlow)"
      />
      <circle
        cx="60"
        cy="58"
        r="13"
        fill="none"
        stroke="#fef08a"
        strokeWidth="1.5"
        opacity="0.6"
      />

      {showText && (
        <text
          x="60"
          y="140"
          textAnchor="middle"
          fontFamily="Roboto, var(--font-sans), sans-serif"
          fontWeight="900"
          fontSize="26"
          letterSpacing="4"
          fill="url(#goldGrad)"
          filter="url(#goldGlow)"
        >
          ZAFF
        </text>
      )}
    </svg>
  );
}

export default Logo;