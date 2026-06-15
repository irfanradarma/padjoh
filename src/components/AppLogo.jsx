export default function AppLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="IS Audit Journal"
    >
      <defs>
        <style>{`
          @keyframes logo-write {
            0%   { stroke-dashoffset: 10; }
            38%  { stroke-dashoffset: 0; }
            62%  { stroke-dashoffset: 0; }
            95%  { stroke-dashoffset: 10; }
            100% { stroke-dashoffset: 10; }
          }
          @keyframes logo-cursor {
            0%, 32%       { opacity: 0; }
            40%, 60%      { opacity: 1; }
            48%, 56%      { opacity: 0.15; }
            68%, 100%     { opacity: 0; }
          }
          @keyframes logo-pulse {
            0%, 100% { opacity: 0.55; }
            38%, 62% { opacity: 1; }
          }
          .logo-wl { stroke-dasharray: 10; stroke-dashoffset: 10; animation: logo-write 3.2s cubic-bezier(.4,0,.2,1) infinite; }
          .logo-cr { animation: logo-cursor 3.2s ease-in-out infinite; }
          .logo-bl { animation: logo-pulse 3.2s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* Book body */}
      <rect x="4" y="2" width="21" height="28" rx="2.5"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />

      {/* Spine strip */}
      <rect x="4" y="2" width="4.5" height="28" rx="2.5"
        fill="currentColor" fillOpacity="0.22" />
      <line x1="8.5" y1="3" x2="8.5" y2="29"
        stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.28" />

      {/* Entry 1 — bullet + full line */}
      <circle cx="12" cy="10.5" r="0.85" fill="currentColor" fillOpacity="0.7" />
      <line x1="14" y1="10.5" x2="22" y2="10.5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.85" />

      {/* Entry 2 — bullet + shorter full line */}
      <circle cx="12" cy="16.5" r="0.85" fill="currentColor" fillOpacity="0.7" />
      <line x1="14" y1="16.5" x2="22" y2="16.5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />

      {/* Entry 3 — bullet pulses, line writes itself */}
      <circle className="logo-bl" cx="12" cy="22.5" r="0.85" fill="currentColor" />
      <line className="logo-wl" x1="14" y1="22.5" x2="22" y2="22.5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />

      {/* Blinking text cursor */}
      <rect className="logo-cr"
        x="22.5" y="19.8" width="1.5" height="5.4" rx="0.75"
        fill="currentColor" />
    </svg>
  )
}
