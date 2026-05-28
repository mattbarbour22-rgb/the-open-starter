import { createClient } from '@supabase/supabase-js';

const TOURNAMENT_STATE_ID =
  process.env.TOURNAMENT_STATE_ID || '2026-the-open';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function sameRanks(a = {}, b = {}) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('tournament_state')
      .select('current_ranks, previous_ranks, locked_eliminated, cut_locked, leaderboard_updated_at')
      .eq('id', TOURNAMENT_STATE_ID)
      .single();

    if (error) throw error;

    return Response.json(data || {});
  } catch (err) {
    return Response.json({
      error: err?.message || String(err),
      current_ranks: {},
      previous_ranks: {},
      locked_eliminated: [],
      cut_locked: false,
      leaderboard_updated_at: null
    });
  }
}

export async function POST(req) {
  const adminSecret = process.env.ADMIN_SECRET;
  const suppliedSecret = req.headers.get('x-admin-secret');

  if (adminSecret && suppliedSecret !== adminSecret) {
    return Response.json({ ok: false, error: 'Unauthorized pool-state write' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const body = await req.json();

    const nextRanks = body.current_ranks || {};
    const leaderboardUpdatedAt = body.leaderboard_updated_at || null;

    const { data: existing } = await supabase
      .from('tournament_state')
      .select('current_ranks, previous_ranks, leaderboard_updated_at')
      .eq('id', TOURNAMENT_STATE_ID)
      .single();

    const oldCurrent = existing?.current_ranks || {};
    const oldPrevious = existing?.previous_ranks || {};
    const oldLeaderboardUpdatedAt = existing?.leaderboard_updated_at || null;

    if (
      leaderboardUpdatedAt &&
      oldLeaderboardUpdatedAt &&
      leaderboardUpdatedAt === oldLeaderboardUpdatedAt
    ) {
      return Response.json({ ok: true, skipped: true });
    }

    const previousRanks = sameRanks(oldCurrent, nextRanks)
      ? oldPrevious || oldCurrent
      : oldCurrent;

    const { error } = await supabase
      .from('tournament_state')
      .upsert({
        id: TOURNAMENT_STATE_ID,
        tournament_name: body.tournament_name || TOURNAMENT_STATE_ID,
        previous_ranks: previousRanks,
        current_ranks: nextRanks,
        locked_eliminated: body.locked_eliminated || [],
        cut_locked: Boolean(body.cut_locked),
        leaderboard_updated_at: leaderboardUpdatedAt,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err?.message || String(err)
    });
  }
}
