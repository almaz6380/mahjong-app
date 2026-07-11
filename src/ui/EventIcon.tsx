// „Event"-Symbol: 3D-Geschenk (roter Karton + Gold-Schleife passend zum
// Stern-Gold), mit Verläufen, Glanz und weichem Schlagschatten.
export function EventIcon() {
  return (
    <svg className="event-ico" viewBox="0 0 56 56" width="48" height="48" aria-hidden="true">
      <defs>
        <linearGradient id="giftBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dd5340" />
          <stop offset="1" stopColor="#a12d1d" />
        </linearGradient>
        <linearGradient id="giftLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ec6a57" />
          <stop offset="1" stopColor="#c33f2e" />
        </linearGradient>
        <linearGradient id="giftGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f4b642" />
          <stop offset="1" stopColor="#dd922a" />
        </linearGradient>
        <filter id="giftShadow" x="-35%" y="-25%" width="170%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#07130d" floodOpacity="0.5" />
        </filter>
      </defs>

      <g filter="url(#giftShadow)">
        {/* Karton-Körper */}
        <rect x="11.5" y="25" width="33" height="21" rx="4" fill="url(#giftBox)" />
        {/* Glanz auf dem Karton */}
        <rect x="14" y="27.5" width="28" height="4" rx="2" fill="#ffffff" opacity="0.14" />
        {/* Deckel (überstehend) */}
        <rect x="9" y="19.5" width="38" height="8.5" rx="3.2" fill="url(#giftLid)" />
        <rect x="11" y="21" width="34" height="2" rx="1" fill="#ffffff" opacity="0.22" />
        {/* vertikales Band */}
        <rect x="25" y="19.5" width="6" height="26.5" fill="url(#giftGold)" />
        {/* Schleife: zwei Schlaufen + Knoten */}
        <ellipse cx="21" cy="13.5" rx="6.4" ry="4.4" transform="rotate(-24 21 13.5)" fill="url(#giftGold)" />
        <ellipse cx="35" cy="13.5" rx="6.4" ry="4.4" transform="rotate(24 35 13.5)" fill="url(#giftGold)" />
        <ellipse cx="21" cy="13.5" rx="2.6" ry="1.7" transform="rotate(-24 21 13.5)" fill="#c9821f" opacity="0.55" />
        <ellipse cx="35" cy="13.5" rx="2.6" ry="1.7" transform="rotate(24 35 13.5)" fill="#c9821f" opacity="0.55" />
        <rect x="24.6" y="14.5" width="6.8" height="6.4" rx="2.2" fill="url(#giftGold)" />
        <circle cx="26" cy="11.2" r="1.4" fill="#ffffff" opacity="0.7" />
      </g>
    </svg>
  );
}
