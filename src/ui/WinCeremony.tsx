// Sieg-Zeremonie: ein Tusch-Ensō (Pinselkreis) zeichnet sich, 福 („Glück")
// erscheint wie gemalt, danach stempelt ein rotes Hanko-Siegel die Level-Nummer.
// Bei prefers-reduced-motion zeigt CSS alles sofort statisch.

export function WinCeremony({ level }: { level?: number }) {
  return (
    <div className="ceremony" aria-hidden>
      <svg className="enso" viewBox="0 0 120 120">
        {/* Ensō: bewusst offener Pinselkreis, zwei Bögen für „trockene" Kante */}
        <path
          className="enso-stroke"
          d="M96 38 A 46 46 0 1 0 100 66"
          fill="none"
          stroke="#f4ecd8"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          className="enso-stroke enso-dry"
          d="M95 42 A 42 42 0 1 0 97 64"
          fill="none"
          stroke="#f4ecd8"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
        <text
          className="fu"
          x="60"
          y="82"
          textAnchor="middle"
          fontFamily="'Songti SC','Songti TC','STSong','Noto Serif CJK SC','Noto Serif SC',serif"
          fontSize="52"
          fontWeight="700"
          fill="#f4ecd8"
        >
          福
        </text>
      </svg>
      {level != null && (
        <div className="hanko-stamp">
          <span className="hanko-num">{level}</span>
        </div>
      )}
    </div>
  );
}
