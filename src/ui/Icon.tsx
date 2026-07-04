// Schlanke Inline-SVG-Icons. Farbige (Münze/Flamme/Pokal) sind selbst gefärbt,
// der Rest erbt die Textfarbe (currentColor).

type Name =
  | 'coin' | 'flame' | 'trophy' | 'gear' | 'help' | 'cart' | 'palette'
  | 'video' | 'chevron' | 'sparkle' | 'refresh' | 'bulb';

export function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  const s = { width: size, height: size, display: 'block', flex: 'none' } as const;
  switch (name) {
    case 'coin':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <circle cx="12" cy="12" r="10" fill="#f3c14e" />
          <circle cx="12" cy="12" r="10" fill="none" stroke="#c8971f" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="6.6" fill="none" stroke="#c8971f" strokeWidth="1.2" opacity="0.7" />
          <path d="M9 8.5h4a2.3 2.3 0 010 4.6H10.4V16" fill="none" stroke="#8a6512" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="9" cy="7.6" rx="2.6" ry="1.3" fill="#fff" opacity="0.5" />
        </svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <path d="M12 2c1 3-2 4-2 7 0 1.6 1 2.6 2 2.6 1.6 0 2.4-1.4 2.2-2.6 1.8 1.3 3 3.4 3 5.6a5.2 5.2 0 11-10.4 0c0-3.6 3.2-5.4 5.2-12.2z" fill="#ff7a3d" />
          <path d="M12 12.5c1.6 0 2.5 1.2 2.5 2.6a2.5 2.5 0 11-5 0c0-1.2.9-1.8 2.5-2.6z" fill="#ffd23d" />
        </svg>
      );
    case 'trophy':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <path d="M7 4h10v3a5 5 0 01-10 0V4z" fill="#f3c14e" stroke="#c8971f" strokeWidth="1" />
          <path d="M17 5h2.5a2.5 2.5 0 01-2.5 3.5M7 5H4.5A2.5 2.5 0 007 8.5" fill="none" stroke="#c8971f" strokeWidth="1.4" />
          <rect x="10.6" y="11" width="2.8" height="4" fill="#c8971f" />
          <rect x="8" y="15" width="8" height="2.4" rx="1" fill="#f3c14e" stroke="#c8971f" strokeWidth="0.8" />
        </svg>
      );
    case 'gear':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <g fill="currentColor">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect key={a} x="10.8" y="1.4" width="2.4" height="4.4" rx="0.7" transform={`rotate(${a} 12 12)`} />
            ))}
          </g>
          <circle cx="12" cy="12" r="6.4" fill="none" stroke="currentColor" strokeWidth="2.1" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      );
    case 'help':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9.2" />
          <path d="M9.4 9.2a2.7 2.7 0 015.2 1c0 1.8-2.6 2-2.6 3.6" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'cart':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M3 4h2l2.2 11h9.6l1.8-8H6.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="19" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="19" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'palette':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M12 3a9 9 0 000 18c1.6 0 2-1.2 1.3-2.1-.7-1 .1-2.4 1.4-2.4H17a4 4 0 004-4c0-4.5-4-9-9-9z" />
          <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2.5" />
          <path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'chevron':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="#f3c14e" />
        </svg>
      );
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 12a8 8 0 0113.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 01-13.7 5.6L4 16M4 20v-4h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'bulb':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M9 17h6M10 20h4M12 3a6 6 0 00-3.5 10.9c.5.4.5 1.1.5 1.6V16h6v-.5c0-.5 0-1.2.5-1.6A6 6 0 0012 3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
