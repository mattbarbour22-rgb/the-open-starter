import { createClient } from '@supabase/supabase-js';
import { poolEntries, tournamentConfig } from '../../../lib/tournament';

const TOURNAMENT_STATE_ID = process.env.TOURNAMENT_STATE_ID || '2026-the-open';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

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

    return `${teeTime} / ${nzTime} NZ`;
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



function isRoundFinished(players) {
  const hasStarted = players.some(
    p => p.thru && !String(p.thru).toLowerCase().includes('tee')
  );

  if (!hasStarted) return false;

  return players.length > 0 && players.every(p => {
    const thru = String(p.thru || '').toUpperCase();
    return posLabel(p) === 'MC' || thru === 'F' || thru === 'F*';
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const suppliedSecret = url.searchParams.get('secret');
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || suppliedSecret !== adminSecret) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const origin = url.origin;
    const leaderboardRes = await fetch(`${origin}/api/leaderboard`);
    const leaderboard = await leaderboardRes.json();

    const players = addPositionLabels(leaderboard.players || []);

    if (!players.length) {
      return Response.json({
        ok: false,
        saved: false,
        reason: 'No leaderboard players found.',
        leaderboard_mode: leaderboard.mode || null
      });
    }

    if (!isRoundFinished(players)) {
      return Response.json({
        ok: true,
        saved: false,
        reason: 'Round is not fully finished yet. Snapshot will only save when every player is F, F*, or MC.',
        leaderboard_updated_at: leaderboard.updatedAt,
      });
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from('tournament_state')
      .select('current_ranks, previous_ranks, locked_eliminated, cut_locked, leaderboard_updated_at')
      .eq('id', TOURNAMENT_STATE_ID)
      .maybeSingle();

    if (existing?.leaderboard_updated_at === leaderboard.updatedAt) {
      return Response.json({
        ok: true,
        saved: false,
        skipped: true,
        reason: 'This leaderboard snapshot was already saved.',
        leaderboard_updated_at: leaderboard.updatedAt,
      });
    }

    const pool = evaluatePool(poolEntries, players, existing?.previous_ranks || {});
    const currentRanks = {};

    pool.forEach(entry => {
      if (!entry.eliminated && entry.numericRank) {
        currentRanks[entry.player] = entry.numericRank;
      }
    });

    const { error } = await supabase
      .from('tournament_state')
      .upsert({
        id: TOURNAMENT_STATE_ID,
        tournament_name: tournamentConfig.title || 'The Open Pick 3 Live',
        previous_ranks: currentRanks,
        current_ranks: currentRanks,
        locked_eliminated: existing?.locked_eliminated || [],
        cut_locked: Boolean(existing?.cut_locked),
        leaderboard_updated_at: leaderboard.updatedAt,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return Response.json({
      ok: true,
      saved: true,
      tournament_state_id: TOURNAMENT_STATE_ID,
      entries_saved: Object.keys(currentRanks).length,
      leaderboard_updated_at: leaderboard.updatedAt,
      message: 'Round snapshot saved. Public arrows now compare against this completed-round baseline.'
    });
  } catch (err) {
    return Response.json({
      ok: false,
      saved: false,
      error: err?.message || String(err)
    }, { status: 500 });
  }
}
