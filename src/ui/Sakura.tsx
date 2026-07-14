// Sanft fallende Kirschblüten (Startseite & Sieg). Wenige DOM-Elemente,
// reine CSS-Animation; bei prefers-reduced-motion per CSS ausgeblendet.

const PETALS = 9;

function Petal({ i }: { i: number }) {
  // Deterministische Pseudo-Streuung pro Blatt (kein Math.random -> stabil).
  const x = ((i * 37) % 100);
  const delay = ((i * 53) % 90) / 10; // 0–8.9 s
  const dur = 9 + ((i * 29) % 60) / 10; // 9–14.9 s
  const size = 10 + ((i * 17) % 8); // 10–17 px
  const drift = 20 + ((i * 41) % 50); // Seitwärts-Drift in px
  return (
    <span
      className="sakura-petal"
      style={{
        left: `${x}%`,
        width: size,
        height: size,
        animationDelay: `${delay}s, ${delay}s`,
        animationDuration: `${dur}s, ${3 + (i % 3)}s`,
        ['--drift' as string]: `${drift}px`,
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden>
        <path
          d="M10 2 C 15 4, 17 9, 10 18 C 3 9, 5 4, 10 2 Z"
          fill="#f6b8cf"
          stroke="rgba(160,60,100,.35)"
          strokeWidth="0.6"
        />
        <path d="M10 5 C 12.5 7, 13 10, 10 15" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="0.8" />
      </svg>
    </span>
  );
}

export function Sakura() {
  return (
    <div className="sakura" aria-hidden>
      {Array.from({ length: PETALS }, (_, i) => (
        <Petal key={i} i={i} />
      ))}
    </div>
  );
}
