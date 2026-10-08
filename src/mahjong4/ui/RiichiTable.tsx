import { useRiichi } from '../useRiichi';
import { type TileCode } from '../tiles4';
import { seatWind, type GameState } from '../engine4';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { presentFact } from '../../ui/FactHost';

const WINDS = ['東', '南', '西', '北'];
const WIND_KEYS = ['m4.east', 'm4.south', 'm4.west', 'm4.north'];
const windName = (i: number) => t(WIND_KEYS[i]);

// Deutsche Beschriftung der Yaku aus dem Wertungskern.
const YAKU_DE: Record<string, string> = {
  riichi: 'Riichi', ippatsu: 'Ippatsu', 'menzen tsumo': 'Menzen Tsumo', dora: 'Dora',
  chiitoitsu: 'Sieben Paare', kokushi: 'Kokushi (13 Waisen)', pinfu: 'Pinfu',
  tanyao: 'Tanyao (nur 2–8)', yakuhai: 'Yakuhai', 'seat wind': 'Platzwind', 'round wind': 'Rundenwind',
  iipeikou: 'Iipeikou', sanshoku: 'Drei Farben', ittsuu: 'Reine Straße', toitoi: 'Toitoi',
  sanankou: 'Drei verd. Tripel', chanta: 'Chanta', junchan: 'Junchan', shousangen: 'Kl. drei Drachen',
  honitsu: 'Halbe Farbe', chinitsu: 'Ganze Farbe',
};
export const yakuLabel = (n: string) => YAKU_DE[n] ?? n;

export function RTile({ code, small, dim, onClick, highlight }: { code: TileCode; small?: boolean; dim?: boolean; onClick?: () => void; highlight?: boolean }) {
  return (
    <button
      className={'mtile' + (small ? ' small' : '') + (dim ? ' dim' : '') + (highlight ? ' hl' : '') + (onClick ? ' tap' : '')}
      onClick={onClick}
      disabled={!onClick}
    >
      <Tile face={code} />
    </button>
  );
}

export function Back({ n, vertical }: { n: number; vertical?: boolean }) {
  return (
    <div className={'backs' + (vertical ? ' v' : '')}>
      {Array.from({ length: n }).map((_, i) => <span key={i} className="back" />)}
    </div>
  );
}

export function Pond({ tiles }: { tiles: TileCode[] }) {
  return <div className="pond">{tiles.map((c, i) => <RTile key={i} code={c} small dim />)}</div>;
}

export function RiichiTable({ onExit, addCoins, onHandResult }: { onExit: () => void; addCoins: (n: number) => void; onHandResult?: (won: boolean) => void }) {
  const r = useRiichi({ addCoins, onResult: onHandResult });
  const g: GameState = r.state;
  const inter = r.interaction;
  const seatLabel = (p: number) => WINDS[seatWind(g, p)];
  const isTurn = (p: number) => g.turn === p && g.phase !== 'over';
  const aiThinking = !inter && g.turn !== 0 && g.phase !== 'over';
  const discardable = inter?.kind === 'discard';

  return (
    <div className="m4 riichi">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="hud-center">
          <div className="level">Riichi</div>
          <div className="sub">{t('m4.wall', { n: g.live.length - g.livePos })}</div>
        </div>
        <div className="coins"><Icon name="coin" /> +{r.coinsEarned}</div>
      </header>

      {/* Gegner oben (Spieler 2) */}
      <div className={'seat top' + (isTurn(2) ? ' active' : '')}>
        <div className="seat-tag">{seatLabel(2)} {g.dealer === 2 ? `· ${t('m4.dealer')}` : ''} {r.extra.riichi[2] ? '· Riichi' : ''}</div>
        <Back n={g.players[2].hand.length} />
        <Pond tiles={g.players[2].discards} />
      </div>

      <div className="m4-mid">
        <div className={'seat left' + (isTurn(3) ? ' active' : '')}>
          <div className="seat-tag">{seatLabel(3)} {r.extra.riichi[3] ? '· Riichi' : ''}</div>
          <Back n={g.players[3].hand.length} vertical />
          <Pond tiles={g.players[3].discards} />
        </div>

        <div className="center">
          <div className="winds">{t('m4.roundYou', { r: windName(g.roundWind), s: windName(seatWind(g, 0)) })}</div>
          <div className="dora-chip">
            <span className="dora-lbl">Dora</span>
            <span className="mtile small"><Tile face={r.doraIndicator} /></span>
          </div>
          {g.lastDiscard ? (
            <div className="last">
              <div className="last-lbl">{t('m4.discard')}</div>
              <RTile code={g.lastDiscard.tile} highlight />
            </div>
          ) : aiThinking ? (
            <div className="ai-think">{t('m4.thinks', { w: windName(seatWind(g, g.turn)) })}</div>
          ) : (
            <div className="turn-ind">{isTurn(0) ? t('m4.yourTurn') : t('m4.draws', { w: windName(seatWind(g, g.turn)) })}</div>
          )}
        </div>

        <div className={'seat right' + (isTurn(1) ? ' active' : '')}>
          <div className="seat-tag">{seatLabel(1)} {r.extra.riichi[1] ? '· Riichi' : ''}</div>
          <Back n={g.players[1].hand.length} vertical />
          <Pond tiles={g.players[1].discards} />
        </div>
      </div>

      {/* Eigener Bereich unten */}
      <div className={'seat bottom' + (isTurn(0) ? ' active' : '')}>
        <div className="hand">
          {g.players[0].hand.map((c, i) => (
            <RTile key={i} code={c} onClick={discardable ? () => r.discardHuman(c) : undefined} />
          ))}
        </div>
        <div className="m4-actions">
          {discardable && (
            <div className={'hint-line' + (r.extra.riichi[0] ? ' tenpai' : '')}>
              {r.extra.riichi[0] ? t('riichi.riichiHint') : t('riichi.discardHint')}
            </div>
          )}
        </div>
      </div>

      {/* Aktions-Leiste: Tsumo / Riichi / Ron */}
      {inter?.kind === 'discard' && (inter.canTsumo || inter.canRiichi) && (
        <div className="claim-bar">
          {inter.canTsumo && <button className="claim win" onClick={r.tsumo}>Tsumo</button>}
          {inter.canRiichi && <button className="claim" onClick={r.declareRiichi}>Riichi</button>}
        </div>
      )}
      {inter?.kind === 'ron' && (
        <div className="claim-bar">
          <button className="claim win" onClick={r.ron}>Ron</button>
          <button className="claim pass" onClick={r.passRon}>{t('m4.pass')}</button>
        </div>
      )}

      {/* Ergebnis */}
      {inter?.kind === 'over' && r.result && (
        <div className="overlay">
          <div className="card">
            <div className="logo">{r.result.winner === 0 ? '🎉' : r.result.winner == null ? '🀫' : '🤖'}</div>
            <h2>
              {r.result.winner === 0
                ? (r.result.tsumo ? t('riichi.winTsumo') : t('riichi.winRon'))
                : r.result.winner == null
                ? t('m4.wallEmpty')
                : t('m4.someoneWins', { w: windName(seatWind(g, r.result.winner)) })}
            </h2>
            {r.result.scored && r.result.scored.points > 0 && (
              <>
                <p className="coins-won">
                  {r.result.scored.yakuman ? 'Yakuman' : `${r.result.scored.han} Han / ${r.result.scored.fu} Fu`} · {t('riichi.points', { n: r.result.scored.points })}
                </p>
                <div className="faan-list">
                  {r.result.scored.yaku.map((y, i) => (
                    <div key={i}><span>{yakuLabel(y.name)}</span><span>+{y.han}</span></div>
                  ))}
                </div>
              </>
            )}
            <div className="row-btns">
              <button className="big-btn" onClick={() => presentFact().then(r.newGame)}>{t('common.next')}</button>
              <button className="text-btn" onClick={onExit}>{t('common.toMenu')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
