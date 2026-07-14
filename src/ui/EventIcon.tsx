// „Event"-Symbol: freigestellte 3D-Geschenkbox (Gemini).
import gift from '../assets/event-gift.webp';

export function EventIcon() {
  return <img className="event-ico" src={gift} alt="" aria-hidden width={48} height={48} draggable={false} />;
}
