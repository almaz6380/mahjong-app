// Klassischer Mahjongstein (roter Drache 中) im Elfenbein-Korpus – für den
// Startseiten-Hero. 中 als Vektor gezeichnet (rendert überall scharf, keine
// Font-Abhängigkeit). Nutzt den globalen Stein-Verlauf #tbody (TileDefs).
export function ClassicTile({ className }: { className?: string }) {
  return (
    <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">
      {/* Korpus wie bei den Spielsteinen */}
      <rect x="3" y="6" width="54" height="72" rx="10" fill="#000" opacity="0.2" />
      <rect x="3" y="3" width="54" height="72" rx="10" fill="url(#tbody)" />
      <rect x="5" y="5" width="50" height="68" rx="8" fill="none" stroke="rgba(245,179,1,.35)" strokeWidth="0.8" />
      <rect x="3" y="3" width="54" height="72" rx="10" fill="none" stroke="rgba(0,0,0,.14)" />
      <rect x="7" y="6" width="46" height="8" rx="4" fill="#fff" opacity="0.5" />
      {/* 中 (roter Drache) */}
      <g fill="#c62828">
        <rect x="18.4" y="27" width="23.2" height="24" rx="1.6" fill="none" stroke="#c62828" strokeWidth="4.3" />
        <rect x="27.5" y="17.5" width="5" height="43" rx="1.2" />
      </g>
    </svg>
  );
}
