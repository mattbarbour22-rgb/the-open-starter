'use client';

import { useEffect, useMemo, useState } from 'react';

import { tournamentConfig, poolEntries } from './lib/tournament';

// Optional movement baseline.
// Leave empty before the tournament. After a round/cut, paste locked baseline ranks here if you want arrows.
const movementBaselineRanks = {};

function simplifyName(name = '') {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const aliasMap = {
  afitzpatrick: 'alexfitzpatrick',
  alexfitzpatrick: 'alexfitzpatrick',
  mfitzpatrick: 'mattfitzpatrick',
  mattfitzpatrick: 'mattfitzpatrick',
  griffin: 'bengriffin',
  griffen: 'bengriffin',
  bengriffin: 'bengriffin',
  goterup: 'chrisgotterup',
  gotterup: 'chrisgotterup',
  chrisgotterup: 'chrisgotterup',
  nhojgaard: 'nicolaihojgaard',
  hojgaard: 'nicolaihojgaard',
  hjgaard: 'nicolaihojgaard',
  nicolaihjgaard: 'nicolaihojgaard',
  nicolaihojgaard: 'nicolaihojgaard',
  homa: 'maxhoma',
  maxhoma: 'maxhoma',
  burns: 'samburns',
  samburns: 'samburns',
  mccarty: 'mattmccarty',
  mattmccarty: 'mattmccarty',
  reitan: 'kristofferreitan',
  kristofferreitan: 'kristofferreitan',
  henley: 'russellhenley',
  russellhenley: 'russellhenley',
  woodland: 'garywoodland',
  garywoodland: 'garywoodland',
  speith: 'jordanspieth',
  spieth: 'jordanspieth',
  jordanspieth: 'jordanspieth',
  fowler: 'rickiefowler',
  rickiefowler: 'rickiefowler',
  mcilroy: 'rorymcilroy',
  rorymcilroy: 'rorymcilroy',
  scheffler: 'scottiescheffler',
  sheffler: 'scottiescheffler',
  scottiescheffler: 'scottiescheffler',
  young: 'cameryoung',
  cameronyoung: 'cameryoung',
  cameryoung: 'cameryoung',
  schauffele: 'xanderschauffele',
  xanderschauffele: 'xanderschauffele',
  dechambeau: 'brysondechambeau',
  brysondechambeau: 'brysondechambeau',
  rahm: 'jonrahm',
  jonrahm: 'jonrahm',
  fleetwood: 'tommyfleetwood',
  tommyfleetwood: 'tommyfleetwood',
  rose: 'justinrose',
  justinrose: 'justinrose',
  thomas: 'justinthomas',
  justinthomas: 'justinthomas',
  aberg: 'ludvigaberg',
  ludvigaberg: 'ludvigaberg',
  koepka: 'brookskoepka',
  brookskoepka: 'brookskoepka',
  hovland: 'viktorhovland',
  viktorhovland: 'viktorhovland',
  cantlay: 'patrickcantlay',
  patrickcantlay: 'patrickcantlay',
  minwoolee: 'minwoolee',
  patrickreed: 'patrickreed',
  justinrose: 'justinrose',
  coreyconners: 'coreyconners',
  adamscott: 'adamscott',
  jjspaun: 'jjspaun',
  spaun: 'jjspaun'
};

function keyName(name) {
  const s = simplifyName(name);
  return aliasMap[s] || s;
}

function scoreLabel(score) {
  if (score === 999) return 'MC';
  const n = Number(score);
  if (!Number.isFinite(n) || n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

function posLabel(player) {
  if (!player) return '—';

  const label = String(player.positionLabel || '').trim().toUpperCase();
  const hasTeeTime = player.teeTime && String(player.teeTime).trim();

  if (player.position >= 999) {
    if (hasTeeTime && label !== 'CUT' && label !== 'MC') return '—';
    return 'MC';
  }

  if (player.positionLabel && String(player.positionLabel).trim()) {
    return String(player.positionLabel);
  }

  return String(player.position);
}


function getDatePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const value = {};
  parts.forEach(part => {
    if (part.type !== 'literal') value[part.type] = part.value;
  });

  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
    minute: Number(value.minute),
    second: Number(value.second)
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

function zonedTeeTimeToUtc(teeTime, timeZone) {
  const nowInTournamentZone = getDatePartsInTimeZone(new Date(), timeZone);
  const match = String(teeTime).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);

  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const modifier = match[3].toLowerCase();

  if (modifier === 'pm' && hours !== 12) hours += 12;
  if (modifier === 'am' && hours === 12) hours = 0;

  let utc = new Date(Date.UTC(
    nowInTournamentZone.year,
    nowInTournamentZone.month - 1,
    nowInTournamentZone.day,
    hours,
    minutes,
    0
  ));

  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(utc, timeZone);
    utc = new Date(Date.UTC(
      nowInTournamentZone.year,
      nowInTournamentZone.month - 1,
      nowInTournamentZone.day,
      hours,
      minutes,
      0
    ) - offset);
  }

  return utc;
}

function formatTeeTimeDisplay(teeTime, timezone = tournamentConfig.tournamentTimezone) {
  if (!teeTime) return '';

  try {
    const utc = zonedTeeTimeToUtc(teeTime, timezone);
    if (!utc) return teeTime;

    const nzTime = new Intl.DateTimeFormat('en-NZ', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Pacific/Auckland'
    }).format(utc);

    return `${nzTime} NZ`;
  } catch {
    return teeTime;
  }
}


function sortPlayers(players) {
  const tournamentStarted = players.some(
    p =>
      (p.position ?? 999) < 999 ||
      (p.thru && !String(p.thru).toLowerCase().includes('tee'))
  );

  // Before tournament starts → tee time order
  if (!tournamentStarted) {
    return [...players].sort((a, b) => {
      const ta = Date.parse(`1970-01-01 ${a.teeTime || '11:59pm'}`);
      const tb = Date.parse(`1970-01-01 ${b.teeTime || '11:59pm'}`);

      if (ta !== tb) return ta - tb;

      return String(a.name).localeCompare(String(b.name));
    });
  }

  // Once tournament starts → permanent live leaderboard order
  return [...players].sort((a, b) => {
    if ((a.position ?? 999) !== (b.position ?? 999)) {
      return (a.position ?? 999) - (b.position ?? 999);
    }

    if ((a.score ?? 999) !== (b.score ?? 999)) {
  return (a.score ?? 999) - (b.score ?? 999);
}

const ta = Date.parse(`1970-01-01 ${a.teeTime || '11:59pm'}`);
const tb = Date.parse(`1970-01-01 ${b.teeTime || '11:59pm'}`);

if (ta !== tb) return ta - tb;

return String(a.name).localeCompare(String(b.name));
  });
}

function addPositionLabels(players) {
  const sorted = sortPlayers(players);

  const counts = new Map();

  sorted.forEach(p => {
    if (p.position < 999) {
      counts.set(p.position, (counts.get(p.position) || 0) + 1);
    }
  });

  return sorted.map(p => {
    const hasTeeTime = p.teeTime && String(p.teeTime).trim();
    const existingLabel = String(p.positionLabel || '').trim().toUpperCase();

    if (p.position >= 999) {
      return {
        ...p,
        positionLabel:
          hasTeeTime && existingLabel !== 'CUT' && existingLabel !== 'MC'
            ? '—'
            : 'MC'
      };
    }

    return {
      ...p,
      positionLabel:
        counts.get(p.position) > 1
          ? `T${p.position}`
          : String(p.position)
    };
  });
}

function buildMap(players) {
  const map = new Map();
  players.forEach(p => map.set(keyName(p.name), p));
  return map;
}

function isLivePick(p) {
  if (!p) return false;

  const label = String(p.positionLabel || '').trim().toUpperCase();
  const hasTeeTime = p.teeTime && String(p.teeTime).trim();

  if (p.position >= 999 && hasTeeTime && label !== 'CUT' && label !== 'MC') {
    return true;
  }

  return p.position < 999 && posLabel(p) !== 'MC';
}

function comparePickSets(a, b) {
  for (let i = 0; i < 3; i++) {
    const av = a[i]?.position ?? 999;
    const bv = b[i]?.position ?? 999;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function isDominated(entry, allEntries) {
  const livePicks = entry.sortedPicks.filter(isLivePick);

  // Current rule from PGA Championship: anyone with 3 live picks stays alive.
  if (livePicks.length === 3) return false;
  if (livePicks.length === 0) return true;

  return livePicks.every(winner => {
    return allEntries.some(other => {
      if (other.player === entry.player) return false;
      const otherLive = other.sortedPicks.filter(isLivePick);
      const otherHasWinner = otherLive.some(p => keyName(p.name) === keyName(winner.name));
      if (!otherHasWinner) return false;
      return comparePickSets(otherLive, livePicks) < 0;
    });
  });
}

function rankEntries(entries, hasRealScores, previousRanks = {}) {
  let lastKey = null;
  let currentRank = 0;

  return entries.map((entry, index) => {
    const key = hasRealScores ? entry.sortedPicks.map(p => p.position).join('|') : String(index + 1);
    if (key !== lastKey) {
      currentRank = index + 1;
      lastKey = key;
    }

    const tieCount = hasRealScores
      ? entries.filter(e => e.sortedPicks.map(p => p.position).join('|') === key).length
      : 1;

    const rankLabel = tieCount > 1 ? `T${currentRank}` : String(currentRank);
    const prev = previousRanks?.[entry.player];
    let move = '—', moveClass = 'move-same';

    if (prev && hasRealScores) {
      if (currentRank < prev) { move = `▲ ${prev - currentRank}`; moveClass = 'move-up'; }
      else if (currentRank > prev) { move = `▼ ${currentRank - prev}`; moveClass = 'move-down'; }
    }

    return { ...entry, rankLabel, numericRank: currentRank, move, moveClass };
  });
}

function evaluatePool(entries, players, previousRanks) {
  const map = buildMap(players);
  const hasRealScores = players.some(p => p.thru && !String(p.thru).toLowerCase().includes('tee'));

  const evaluated = entries.map((entry, originalIndex) => {
    const picks = entry.picks.map(pick => map.get(keyName(pick)) || {
      name: pick,
      position: 999,
      positionLabel: 'NS',
      score: 999,
      today: '',
      thru: 'Not Started'
    });

    const sortedPicks = [...picks].sort((a,b) => {
      if ((a.position ?? 999) !== (b.position ?? 999)) return (a.position ?? 999) - (b.position ?? 999);
      if ((a.score ?? 999) !== (b.score ?? 999)) return (a.score ?? 999) - (b.score ?? 999);
      return String(a.name).localeCompare(String(b.name));
    });

    return { ...entry, originalIndex, sortedPicks };
  });

  const ranked = hasRealScores
    ? evaluated.sort((a,b) => {
        for (let i=0;i<3;i++) {
          if (a.sortedPicks[i].position !== b.sortedPicks[i].position) return a.sortedPicks[i].position - b.sortedPicks[i].position;
        }
        return a.originalIndex - b.originalIndex;
      })
    : evaluated.sort((a,b) => a.originalIndex - b.originalIndex);

  const rankedWithStatus = rankEntries(ranked, hasRealScores, previousRanks);
  const cutHasHappened = players.some(p => p.position >= 999 || posLabel(p) === 'MC');

  if (!cutHasHappened) return rankedWithStatus;

  const aliveRaw = rankedWithStatus.filter(entry => !isDominated(entry, rankedWithStatus));
  const alive = rankEntries(aliveRaw, hasRealScores, previousRanks);

  const eliminated = rankedWithStatus
  .filter(entry => isDominated(entry, rankedWithStatus))
  .map(entry => {

    const livePicks = entry.sortedPicks.filter(isLivePick);

    let eliminationReason = 'ALL MC';

    if (livePicks.length > 0) {

      const coveringEntry = rankedWithStatus.find(other => {
        if (other.player === entry.player) return false;

        const otherLive = other.sortedPicks.filter(isLivePick);

        return livePicks.every(lp =>
          otherLive.some(op => keyName(op.name) === keyName(lp.name))
        ) && comparePickSets(otherLive, livePicks) < 0;
      });

      if (coveringEntry) {
        eliminationReason = `COVERED BY\n${coveringEntry.player.toUpperCase()}`;
      }
    }

    return {
      ...entry,
      eliminated: true,
      rankLabel: '',
      move: eliminationReason,
      moveClass: 'move-down'
    };
  });

  return [...alive, ...eliminated];
}

export default function Home() {
  const [apiState, setApiState] = useState({
  mode: 'loading',
  players: [],
  updatedAt: null,
  message: ''
});

const [poolExpanded, setPoolExpanded] = useState(false);
const [golfExpanded, setGolfExpanded] = useState(false);

const [movementRanks, setMovementRanks] = useState({});
const [poolStateLoaded, setPoolStateLoaded] = useState(false);

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    setApiState(data);
  } catch (err) {
    setApiState({
      mode: 'error',
      players: [],
      updatedAt: new Date().toISOString(),
      message: err?.message || 'Unable to load scores.'
    });
  }
}

useEffect(() => {
  loadLeaderboard();

  const interval = setInterval(loadLeaderboard, 5 * 60 * 1000);

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  async function loadPoolState() {
    try {
      const data = await fetch('/api/pool-state').then(r => r.json());

      setMovementRanks(data.previous_ranks || {});
      setPoolStateLoaded(true);
    } catch {
      setMovementRanks({});
      setPoolStateLoaded(true);
    }
  }

  loadPoolState();
}, [apiState.updatedAt]);

const players = useMemo(
  () =>
    addPositionLabels(
      apiState.players || []
    ),
  [apiState]
);

const pool = useMemo(() => {
  if (!players.length) return [];

  return evaluatePool(poolEntries, players, movementRanks);
}, [players, movementRanks]);

// Public page is read-only. Round-move baselines are saved from the admin route only.


const leader = pool.length ? pool[0] : null;

const poolLeaders = pool.filter(
  p => p.numericRank === pool[0]?.numericRank && !p.eliminated
);

const leaderNames = poolLeaders.map(p => p.player).join(' / ');

const updatedText = apiState.updatedAt
  ? `Updated ${Math.max(
      0,
      Math.round(
        (Date.now() - new Date(apiState.updatedAt).getTime()) / 60000
      )
    )} min ago`
  : 'Waiting for scores';

const tournamentStarted = players.some(p => p.position < 999);

const golfLeaderNames = tournamentStarted
  ? players
      .filter(p => p.position === players[0]?.position && p.position < 999)
      .map(p => p.name)
      .join(' / ')
  : '';

const warningText =
  apiState.mode === 'missing-key'
    ? 'API key missing in Vercel. Add SLASH_GOLF_API_KEY.'
    : apiState.mode === 'api-error'
      ? `Live API fallback active: ${apiState.message}`
      : '';

const aliveCount = pool.filter(p => !p.eliminated).length;
const eliminatedCount = pool.filter(p => p.eliminated).length;
  return (
    <main className="page" style={{ '--hero-image': `url(${tournamentConfig.heroImage})` }}>
      <div className="header">
        <div className="logo open-logo" aria-label="The Open live logo">
          <svg className="claret-icon" viewBox="0 0 64 90" role="img" aria-hidden="true">
            <path d="M23 10h18c0 9-2 16-5 22h8c10 0 15-8 15-17 0-5-2-9-5-12 1 7-2 16-10 19 1-5 2-10 2-16H18c0 6 1 11 2 16C12 19 9 10 10 3 7 6 5 10 5 15c0 9 5 17 15 17h8c-3-6-5-13-5-22Z" />
            <path d="M25 35h14v28c0 8 4 10 12 12v6H13v-6c8-2 12-4 12-12V35Z" />
            <path d="M18 82h28v5H18z" />
          </svg>
          <div className="open-wordmark"><div>THE</div><h1>OPEN</h1><span>LIVE</span></div>
        </div>
        <div className="title">
          <div className="eyebrow">{tournamentConfig.majorLabel}</div>
          <h2>{tournamentConfig.title}</h2>
          <div className="subtitle">{tournamentConfig.venue} • {tournamentConfig.location} • {tournamentConfig.dates}</div>
          <div className="livebar"><div className="live">{apiState.mode === 'live' ? 'LIVE' : 'READY'}</div><div className="updated">{updatedText}</div></div>
        </div>
      </div>

      {warningText && <div className="warning">{warningText}</div>}

      <div className="grid">
        <section className={`panel ${golfExpanded ? 'expanded' : ''}`}>
          <div className="panel-title">The Open Live Leaderboard</div>
          <table>
            <thead><tr><th>Pos</th><th>Player</th><th>Total</th><th>Thru</th><th>Today</th></tr></thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={`${p.name}-${idx}`} className={idx >= 14 ? 'hidden-row' : ''}>
                  <td>{posLabel(p)}</td><td className="player">{p.name}</td><td className="red">{scoreLabel(p.score)}</td>
                  <td>{p.teeTime && (!p.thru || String(p.thru).toLowerCase().includes('tee')) ? formatTeeTimeDisplay(p.teeTime) : (p.thru || '—')}</td>
                  <td className="red">{scoreLabel(p.today)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="footer-btn" onClick={() => setGolfExpanded(!golfExpanded)}>{golfExpanded ? 'COLLAPSE THE OPEN LEADERBOARD ▲' : 'FULL THE OPEN LEADERBOARD ▶'}</button>
        </section>

        <div>
          <section className="panel summary-panel">
            <div className="panel-title">Projected Pool Leader</div>
            <div className="leader-box">
              <div className="big">
  {tournamentStarted ? leaderNames.toUpperCase() : ''}
</div>
              <div className="reason">
  {tournamentStarted && leader
    ? (
      <>
        {golfLeaderNames} currently leads the tournament.<br />
        {leaderNames || leader.player} leads the pool on current tie-breaks.
      </>
    )
    : 'Waiting for first scores. Pool leader will show once play begins.'}
</div>
              <div className="stat-row">
                <div><strong>{tournamentConfig.prizePool}</strong><span>Prize Pool</span></div>
                <div><strong>{aliveCount}</strong><span>Alive</span></div>
                <div><strong>{eliminatedCount}</strong><span>Eliminated</span></div>
              </div>
              <div className="leader-updated">{tournamentConfig.jackpotRule}</div>
            </div>
          </section>

          <section className={`panel pool-panel ${poolExpanded ? 'expanded' : ''}`}>
            <div className="panel-title">The Open Pool Leaderboard</div>
            <table>
              <thead><tr><th>Pos</th><th>ROUND MOVE</th><th>Player</th><th>Best Pick</th><th>Next Best</th><th>3rd Pick</th></tr></thead>
              <tbody>
                {pool.map((entry, idx) => {
                  const best = entry.sortedPicks[0], second = entry.sortedPicks[1], third = entry.sortedPicks[2];
                  const isBestLeading = best.position === players[0]?.position;
                  return (
                    <tr key={entry.player} className={`${idx >= 14 ? 'hidden-row' : ''} ${entry.eliminated ? 'eliminated-row' : ''}`}>
                      <td>{entry.rankLabel}</td><td className={entry.moveClass}>{entry.move}</td><td className="player">{entry.player}</td>
                      <td className={isBestLeading ? 'green highlight' : ''}>{best.name} <span className="small">({posLabel(best)})</span></td>
                      <td>{second.name} <span className="small">({posLabel(second)})</span></td>
                      <td>{third.name} <span className="small">({posLabel(third)})</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="footer-btn" onClick={() => setPoolExpanded(!poolExpanded)}>{poolExpanded ? 'COLLAPSE POOL LEADERBOARD ▲' : 'FULL POOL LEADERBOARD ▶'}</button>
          </section>
        </div>
      </div>

      <div className="note">The Open pool rankings are decided by best current golf position, then next best and third pick. {tournamentConfig.jackpotRule}</div>
    </main>
  );
}
