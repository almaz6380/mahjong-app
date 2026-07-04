import { useEffect, useRef, useState } from 'react';

// Zählt in ~600ms von 0 auf `value` hoch (für den Münz-Gewinn).
export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3)))); // ease-out
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <>{n}</>;
}
