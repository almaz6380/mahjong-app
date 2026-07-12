// „Belohnung"-Symbol: 3D-Schatztruhe (Holz-Korpus + Gold-Beschläge, passend zum
// Stern- und Geschenk-Gold), mit Verläufen, Glanz und weichem Schlagschatten.
export function RewardIcon({ size = 48 }: { size?: number }) {
  return (
    <svg className="reward-ico" viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="chestWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9713b" />
          <stop offset="1" stopColor="#6f4018" />
        </linearGradient>
        <linearGradient id="chestLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c68a4a" />
          <stop offset="1" stopColor="#8a5426" />
        </linearGradient>
        <linearGradient id="chestGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f4b642" />
          <stop offset="1" stopColor="#dd922a" />
        </linearGradient>
        <filter id="chestShadow" x="-35%" y="-25%" width="170%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#07130d" floodOpacity="0.5" />
        </filter>
      </defs>

      <g filter="url(#chestShadow)">
        {/* Korpus */}
        <rect x="10" y="27" width="36" height="19" rx="3.6" fill="url(#chestWood)" />
        {/* Plankenfugen */}
        <rect x="12" y="34" width="32" height="1.2" fill="#4e2c10" opacity="0.45" />
        <rect x="12" y="40" width="32" height="1.2" fill="#4e2c10" opacity="0.35" />
        {/* gewölbter Deckel */}
        <path d="M9 29 L9 24.5 Q9 14.5 19.5 14.5 L36.5 14.5 Q47 14.5 47 24.5 L47 29 Q47 30.8 45 30.8 L11 30.8 Q9 30.8 9 29 Z" fill="url(#chestLid)" />
        {/* Glanz auf dem Deckel */}
        <path d="M13 24.5 Q13 17.5 20.5 17.5 L35 17.5 Q39 17.5 41 19.5 Q36 18.6 21 18.9 Q14.5 19.1 13 24.5 Z" fill="#ffffff" opacity="0.22" />
        {/* Gold-Bänder (über Deckel + Korpus) */}
        <rect x="15" y="14.9" width="5" height="31.1" rx="1.4" fill="url(#chestGold)" />
        <rect x="36" y="14.9" width="5" height="31.1" rx="1.4" fill="url(#chestGold)" />
        {/* Deckelkante */}
        <rect x="9" y="28.6" width="38" height="2.6" rx="1.3" fill="url(#chestGold)" />
        {/* Schloss */}
        <rect x="24" y="26.5" width="8" height="9.5" rx="2.2" fill="url(#chestGold)" />
        <circle cx="28" cy="30" r="1.5" fill="#6f4018" />
        <rect x="27.2" y="30.6" width="1.6" height="3" rx="0.8" fill="#6f4018" />
        {/* Spitzlicht */}
        <circle cx="20.5" cy="20.5" r="1.4" fill="#ffffff" opacity="0.7" />
      </g>
    </svg>
  );
}
