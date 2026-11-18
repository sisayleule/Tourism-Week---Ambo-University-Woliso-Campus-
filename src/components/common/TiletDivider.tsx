import React from 'react';

interface TiletDividerProps {
  className?: string;
  variant?: 'subtle' | 'bold' | 'gold';
}

export const TiletDivider: React.FC<TiletDividerProps> = ({
  className = '',
  variant = 'subtle',
}) => {
  return (
    <div
      role="separator"
      aria-label="Ethiopian decorative textile divider"
      className={`w-full overflow-hidden select-none pointer-events-none ${
        variant === 'bold' ? 'h-2.5 opacity-90' : variant === 'gold' ? 'h-1.5 opacity-100' : 'h-1.5 opacity-70'
      } ${className}`}
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full h-full block"
      >
        <defs>
          <pattern
            id="tilet-pattern"
            width="28"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            {/* Ethiopian traditional cross/diamond weave motif */}
            <rect width="28" height="10" fill="transparent" />
            <polygon points="14,0 28,5 14,10 0,5" fill="#0F3D2E" opacity="0.85" />
            <polygon points="14,2 24,5 14,8 4,5" fill="#D9A441" />
            <polygon points="14,3.5 19,5 14,6.5 9,5" fill="#C65D3B" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tilet-pattern)" />
      </svg>
    </div>
  );
};
