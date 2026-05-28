import { getDb } from "./db";
import { getCache } from "./cache";

export interface DailyMetric {
  date: string; // ISO date string, e.g. "2024-01-15"
  activeStreams: number;
  totalVested: number;
  newStreams: number;
  completedStreams: number;
}

const CACHE_KEY_PREFIX = "metrics:history:";
const CACHE_TTL_SECONDS = 300; // 5 minutes
const MAX_DAYS = 90;

/**
 * Computes daily aggregate metrics for the past N days using stream_events timestamps.
 * Results are cached for 5 minutes.
 */
export async function getMetricsHistory(days: number): Promise<DailyMetric[]> {
  const clampedDays = Math.min(Math.max(1, days), MAX_DAYS);
  const cacheKey = `${CACHE_KEY_PREFIX}${clampedDays}`;

  // Try cache first
  try {
    const cache = getCache();
    const cached = await cache.get<DailyMetric[]>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch {
    // Cache unavailable — fall through to DB query
  }

  const result = computeMetricsHistory(clampedDays);

  // Store in cache
  try {
    const cache = getCache();
    await cache.set(cacheKey, result, CACHE_TTL_SECONDS);
  } catch {
    // Cache write failure is non-fatal
  }

  return result;
}

function computeMetricsHistory(days: number): DailyMetric[] {
  const db = getDb();
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // Build an array of day buckets: [ { date, startSec, endSec }, ... ]
  // Day 0 = today (partial), day 1 = yesterday, etc.
  const buckets: Array<{ date: string; startSec: number; endSec: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(nowMs);
    dayStart.setUTCHours(0, 0, 0, 0);
    dayStart.setUTCDate(dayStart.getUTCDate() - i);

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    buckets.push({
      date: dayStart.toISOString().slice(0, 10),
      startSec: Math.floor(dayStart.getTime() / 1000),
      endSec: Math.floor(dayEnd.getTime() / 1000),
    });
  }

  const oldestStartSec = buckets[0]?.startSec ?? nowSec;

  // --- New streams per day (created events) ---
  const newStreamsRows = db
    .prepare(
      `SELECT
         date(timestamp, 'unixepoch') AS day,
         COUNT(*) AS cnt
       FROM stream_events
       WHERE event_type = 'created'
         AND timestamp >= ?
       GROUP BY day`,
    )
    .all(oldestStartSec) as Array<{ day: string; cnt: number }>;

  const newStreamsMap = new Map<string, number>();
  for (const row of newStreamsRows) {
    newStreamsMap.set(row.day, row.cnt);
  }

  // --- Completed streams per day (completed events) ---
  const completedStreamsRows = db
    .prepare(
      `SELECT
         date(timestamp, 'unixepoch') AS day,
         COUNT(*) AS cnt
       FROM stream_events
       WHERE event_type = 'completed'
         AND timestamp >= ?
       GROUP BY day`,
    )
    .all(oldestStartSec) as Array<{ day: string; cnt: number }>;

  const completedStreamsMap = new Map<string, number>();
  for (const row of completedStreamsRows) {
    completedStreamsMap.set(row.day, row.cnt);
  }

  // --- Active streams and total vested per day ---
  // For each day bucket, compute a snapshot at the END of that day (or now for today).
  // Active = streams that started before dayEnd and haven't been canceled/completed before dayEnd.
  // Total vested = sum of pro-rated amounts for active streams + total_amount for completed streams.
  const results: DailyMetric[] = buckets.map(({ date, startSec, endSec }) => {
    const snapshotSec = Math.min(endSec, nowSec);

    const statsRow = db
      .prepare(
        `SELECT
           COUNT(CASE
             WHEN canceled_at IS NULL
              AND completed_at IS NULL
              AND start_at <= :snap
              AND (start_at + duration_seconds) > :snap
             THEN 1 END) AS active_streams,
           COALESCE(SUM(
             CASE
               WHEN canceled_at IS NULL
                AND completed_at IS NULL
                AND start_at <= :snap
               THEN
                 CAST(
                   total_amount
                   * MIN(CAST(:snap - start_at AS REAL), CAST(duration_seconds AS REAL))
                   / CAST(duration_seconds AS REAL)
                 AS REAL)
               WHEN completed_at IS NOT NULL AND completed_at <= :snap
               THEN total_amount
               ELSE 0
             END
           ), 0) AS total_vested
         FROM streams
         WHERE created_at <= :snap`,
      )
      .get({ snap: snapshotSec }) as {
      active_streams: number;
      total_vested: number;
    };

    return {
      date,
      activeStreams: statsRow.active_streams,
      totalVested: Math.round(statsRow.total_vested * 100) / 100,
      newStreams: newStreamsMap.get(date) ?? 0,
      completedStreams: completedStreamsMap.get(date) ?? 0,
    };
  });

  return results;
}
