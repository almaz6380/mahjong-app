import { useState } from 'react';
import { useMahjong4 } from '../useMahjong4';
import { type TileCode } from '../tiles4';
import { seatWind, type GameState, type Meld } from '../engine4';
import { isTenpai } from '../win';
import { standings } from '../match4';
import { type Difficulty } from '../ai';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { presentFact } from '../../ui/FactHost';

const WINDS = ['東', '南', '西', '北'];
const WIND_KEYS = ['m4.east', 'm4.south', 'm4.west', 'm4.north'];
const windName = (i: number) => t(WIND_KEYS[i]);

function Tile4({ code, small, dim, onClick, highlight, claimable }: { code: TileCode; small?: boolean; dim?: boolean; onClick?: () => void; highlight?: boolean; claimable?: boolean }) {
  return (
    <button
      className={'mtile' + (small ? ' small' : '') + (dim ? ' dim' : '') + (highlight ? ' hl' : '') + (claimable ? ' claimable' : '') + (onClick ? ' tap' : '')}
      onClick={onClick}
      disabled={!onClick}
    >
      <Tile face={code} />
    </button>
  );
}

function Back({ n, vertical }: { n: number; vertical?: boolean }) {
  return (
    <div className={'backs' + (vertical ? ' v' : '')}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="back" />
      ))}
    </div>
  );
}

function Melds({ melds }: { melds: Meld[] }) {
  if (!melds.length) return null;
  return (
    <div className="melds">
      {melds.map((m, i) => (
        <div key={i} className="meld">
          {m.tiles.map((t, j) => (
            <Tile4 key={j} code={t} small />
          ))}
        </div>
      ))}
    </div>
  );
}

function Discards({ tiles }: { tiles: TileCode[] }) {
  return (
    <div className="pond">
      {tiles.map((t, i) => (
        <Tile4 key={i} code={t} small dim />
      ))}
    </div>
  );
}

export function Table4({
  onExit,
  addCoins,
  difficulty,
  showTutorial,
  onTutorialDone,
  onHandResult,
}: {
  onExit: () => void;
  addCoins: (n: number) => void;
  difficulty?: Difficulty;
  showTutorial?: boolean;
  onTutorialDone?: () => void;
  onHandResult?: (won: boolean, faan: number) => void;
}) {
  const g4 = useMahjong4({ addCoins, difficulty, onHandResult });
  const [tutorial, setTutorial] = useState(!!showTutorial);
  const g: GameState = g4.state;
  const inter = g4.interaction;
  const [chowPick, setChowPick] = useState<[TileCode, TileCode][] | null>(null);

  const seatLabel = (p: number) => WINDS[seatWind(g, p)];
  const isTurn = (p: number) => g.turn === p && g.phase !== 'over';

  const opt = inter?.kind === 'claim' ? inter.option : null;
  const aiThinking = !inter && g.turn !== 0 && g.phase !== 'over';
  const tenpai = inter?.kind === 'discard' && isTenpai(g.players[0].hand, g.players[0].melds.length);

  // Steine der eigenen Hand, die den aktuellen Anspruch bilden -> hervorheben.
  const claimable = new Set<string>();
  if (opt && g.lastDiscard) {
    if (opt.pung || opt.kong) claimable.add(g.lastDiscard.tile);
    for (const ch of opt.chows) { claimable.add(ch[0]); claimable.add(ch[1]); }
  }

  const onChowClick = () => {
    if (!opt) return;
    if (opt.chows.length === 1) g4.claimHuman('chow', opt.chows[0]);
    else setChowPick(opt.chows);
  };

  return (
    <div className="m4">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="hud-center">
          <div className="level">{t('m4.title', { n: g4.match.hand })}</div>
          <div className="sub">{t('m4.wall', { n: g.live.length - g.livePos })}</div>
        </div>
        <div className="coins"><Icon name="coin" /> +{g4.coinsEarned}</div>
      </header>

      {/* Gegner oben (Spieler 2) */}
      <div className={'seat top' + (isTurn(2) ? ' active' : '')}>
        <div className="seat-tag">{seatLabel(2)} {g.dealer === 2 ? `· ${t('m4.dealer')}` : ''}</div>
        <Back n={g.players[2].hand.length} />
        <Melds melds={g.players[2].melds} />
        <Discards tiles={g.players[2].discards} />
      </div>

      {/* Mitte: links (3), Zentrum, rechts (1) */}
      <div className="m4-mid">
        <div className={'seat left' + (isTurn(3) ? ' active' : '')}>
          <div className="seat-tag">{seatLabel(3)}</div>
          <Back n={g.players[3].hand.length} vertical />
          <Melds melds={g.players[3].melds} />
          <Discards tiles={g.players[3].discards} />
        </div>

        <div className="center">
          <div className="winds">{t('m4.roundYou', { r: windName(g.roundWind), s: windName(seatWind(g, 0)) })}</div>
          {g.lastDiscard ? (
            <div className="last">
              <div className="last-lbl">{t('m4.discard')}</div>
              <Tile4 code={g.lastDiscard.tile} highlight />
            </div>
          ) : aiThinking ? (
            <div className="ai-think">{t('m4.thinks', { w: windName(seatWind(g, g.turn)) })}</div>
          ) : (
            <div className="turn-ind">{isTurn(0) ? t('m4.yourTurn') : t('m4.draws', { w: windName(seatWind(g, g.turn)) })}</div>
          )}
        </div>

        <div className={'seat right' + (isTurn(1) ? ' active' : '')}>
          <div className="seat-tag">{seatLabel(1)}</div>
          <Back n={g.players[1].hand.length} vertical />
          <Melds melds={g.players[1].melds} />
          <Discards tiles={g.players[1].discards} />
        </div>
      </div>

      {/* Eigener Bereich unten */}
      <div className={'seat bottom' + (isTurn(0) ? ' active' : '')}>
        <Melds melds={g.players[0].melds} />
        <div className="hand">
          {g.players[0].hand.map((t, i) => (
            <Tile4
              key={i}
              code={t}
              highlight={g4.suggested === t}
              claimable={!!opt && claimable.has(t)}
              onClick={inter?.kind === 'discard' ? () => g4.discardHuman(t) : undefined}
            />
          ))}
        </div>
        <div className="m4-actions">
          {inter?.kind === 'discard' && (
            <div className={'hint-line' + (tenpai ? ' tenpai' : '')}>
              {tenpai ? t('m4.tenpai') : t('m4.tapDiscard')} ·{' '}
              <button className="link" onClick={g4.hint}>
                <span className="btn-ico"><Icon name="video" size={13} /> {t('game.hint')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial beim ersten Start */}
      {tutorial && (
        <div className="overlay">
          <div className="card">
            <div className="logo"><Tile face="dragonG" /></div>
            <h2>{t('tut.title')}</h2>
            <div className="tut-list">
              {[1, 2, 3, 4].map((i) => (
                <p key={i}>{t(`tut.${i}`)}</p>
              ))}
            </div>
            <button
              className="big-btn"
              onClick={() => {
                setTutorial(false);
                onTutorialDone?.();
              }}
            >
              {t('tut.start')}
            </button>
          </div>
        </div>
      )}

      {/* Anspruch-Buttons */}
      {opt && !tutorial && (
        <div className="claim-bar">
          {opt.win && <button className="claim win" onClick={() => g4.claimHuman('win')}>{t('m4.win')}</button>}
          {opt.kong && <button className="claim" onClick={() => g4.claimHuman('kong')}>Kong</button>}
          {opt.pung && <button className="claim" onClick={() => g4.claimHuman('pung')}>Pung</button>}
          {opt.chows.length > 0 && <button className="claim" onClick={onChowClick}>Chow</button>}
          <button className="claim pass" onClick={g4.passHuman}>{t('m4.pass')}</button>
        </div>
      )}

      {/* Chow-Varianten-Auswahl */}
      {chowPick && (
        <div className="overlay" onClick={() => setChowPick(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h2>{t('m4.whichChow')}</h2>
            <div className="chow-choices">
              {chowPick.map((ch, i) => (
                <button
                  key={i}
                  className="chow-choice"
                  onClick={() => {
                    setChowPick(null);
                    g4.claimHuman('chow', ch);
                  }}
                >
                  {[g.lastDiscard!.tile, ch[0], ch[1]]
                    .slice()
                    .sort()
                    .map((c, j) => (
                      <Tile4 key={j} code={c} small />
                    ))}
                </button>
              ))}
            </div>
            <button className="text-btn" onClick={() => setChowPick(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* Hand-Ende */}
      {inter?.kind === 'handEnd' && g4.handResult && (
        <div className="overlay">
          <div className="card">
            <div className="logo">{g4.handResult.winner === 0 ? '🎉' : g4.handResult.winner == null ? '🀫' : '🤖'}</div>
            <h2>
              {g4.handResult.winner === 0 ? t('m4.youWin') : g4.handResult.winner == null ? t('m4.wallEmpty') : t('m4.someoneWins', { w: windName(seatWind(g, g4.handResult.winner)) })}
            </h2>
            {g4.handResult.score && (
              <>
                <p className="coins-won">{t('stats.faanN', { n: g4.handResult.score.faan })}</p>
                <div className="faan-list">
                  {g4.handResult.score.patterns.map((p, i) => (
                    <div key={i}><span>{t(p.name)}</span><span>+{p.faan}</span></div>
                  ))}
                </div>
              </>
            )}
            <button className="big-btn" onClick={() => presentFact().then(g4.continueHand)}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Match-Ende */}
      {inter?.kind === 'matchEnd' && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🏆</div>
            <h2>{t('m4.matchOver')}</h2>
            <div className="faan-list">
              {standings(g4.match).map((p, rank) => (
                <div key={p}><span>{rank + 1}. {p === 0 ? t('common.you') : windName(seatWind(g, p))}</span><span>{g4.match.scores[p]}</span></div>
              ))}
            </div>
            <p className="coins-won"><Icon name="coin" size={24} /> +{g4.coinsEarned}</p>
            <button className="big-btn" onClick={onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
