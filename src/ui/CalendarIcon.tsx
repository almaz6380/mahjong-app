// Eigenes Kalender-Icon (statt System-Emoji) für den „Täglich"-Button.
// Zeigt den echten heutigen Tag; natürliche Farben (Elfenbein-Blatt + Drachen-Rot-Kopf).
export function CalendarIcon({ day }: { day?: number }) {
  const d = day ?? new Date().getDate();
  return (
    <svg className="cal-ico" viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
      <defs>
        <linearGradient id="calBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f0e8da" />
        </linearGradient>
        <linearGradient id="calTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cf4636" />
          <stop offset="1" stopColor="#a83221" />
        </linearGradient>
      </defs>
      <rect x="6" y="9" width="36" height="33" rx="8" fill="url(#calBody)" stroke="rgba(60,40,15,0.18)" strokeWidth="1" />
      <path d="M6 20 V17 A8 8 0 0 1 14 9 H34 A8 8 0 0 1 42 17 V20 Z" fill="url(#calTop)" />
      <rect x="14.6" y="3.5" width="3.4" height="9.5" rx="1.7" fill="#8a5a26" />
      <rect x="30" y="3.5" width="3.4" height="9.5" rx="1.7" fill="#8a5a26" />
      <text
        x="24"
        y="37"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        fontSize="17"
        fontWeight="800"
        fill="#2a2113"
      >
        {d}
      </text>
    </svg>
  );
}
