// „Täglich"-Symbol: freigestelltes Gold-Jade-Drachen-Wappen (Gemini).
import emblem from '../assets/emblem-shield.webp';

export function DailyIcon() {
  return <img className="daily-ico" src={emblem} alt="" aria-hidden width={48} height={48} draggable={false} />;
}
