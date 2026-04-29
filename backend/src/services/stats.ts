import { getDb } from "./db";

export interface StreamStats {
  total_streams: number;
  active_streams: number;
  completed_streams: number;
  canceled_streams: number;
  total_vested: number;
  avg_duration_seconds: number;
  unique_senders: number;
  unique_recipients: number;
}

const CACHE_TTL_MS = 30_000;
let cachedStats: StreamStats | null = null;
let cacheExpiresAt = 0;

export function getStreamStats(): StreamStats {
  const now = Date.now();
  if (cachedStats && now < cacheExpiresAt) {
    return cachedStats;
  }

  const db = getDb();
  const nowSec = Math.floor(now / 1000);

  const row = db.prepare(`
    SELECT
      COUNT(*)                                                      AS total_streams,
      COUNT(CASE
        WHEN canceled_at IS NULL
         AND completed_at IS NULL
         AND start_at <= :now
         AND (start_at + duration_seconds) > :now
        THEN 1 END)                                                 AS active_streams,
      COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)          AS completed_streams,
      COUNT(CASE WHEN canceled_at  IS NOT NULL THEN 1 END)          AS canceled_streams,
      COALESCE(SUM(
        CASE
          WHEN canceled_at IS NULL AND completed_at IS NULL
               AND start_at <= :now
          THEN
            CAST(
              total_amount * MIN(CAST(:now - start_at AS REAL), CAST(duration_seconds AS REAL))
              / CAST(duration_seconds AS REAL)
            AS REAL)
          WHEN completed_at IS NOT NULL
          THEN total_amount
          ELSE 0
        END
      ), 0)                                                         AS total_vested,
      COALESCE(AVG(duration_seconds), 0)                            AS avg_duration_seconds,
      COUNT(DISTINCT sender)                                        AS unique_senders,
      COUNT(DISTINCT recipient)                                     AS unique_recipients
    FROM streams
  `).get({ now: nowSec }) as StreamStats;

  cachedStats = {
    total_streams:       row.total_streams,
    active_streams:      row.active_streams,
    completed_streams:   row.completed_streams,
    canceled_streams:    row.canceled_streams,
    total_vested:        Math.round(row.total_vested * 100) / 100,
    avg_duration_seconds: Math.round(row.avg_duration_seconds),
    unique_senders:      row.unique_senders,
    unique_recipients:   row.unique_recipients,
  };
  cacheExpiresAt = now + CACHE_TTL_MS;

  return cachedStats;
}

/** Exposed for testing — resets the in-memory cache. */
export function resetStatsCache(): void {
  cachedStats = null;
  cacheExpiresAt = 0;
}
