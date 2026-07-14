// „Belohnung"-Symbol: freigestellte 3D-Schatztruhe (Gemini).
import chest from '../assets/reward-chest.webp';

export function RewardIcon({ size = 48 }: { size?: number }) {
  return <img className="reward-ico" src={chest} alt="" aria-hidden width={size} height={size} draggable={false} />;
}
