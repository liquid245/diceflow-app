import { type Env, json } from './_shared';

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 30;
const MAX_POINTS = 500;

function count(result: D1Result): number {
  const rows = result.results as Array<{ n: number }> | undefined;
  return rows?.[0]?.n ?? 0;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.ANALYTICS_DB;
  const now = Date.now();
  const today = new Date(now);
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const seriesStart = todayStart - (SERIES_DAYS - 1) * DAY_MS;

  try {
    const [activeNow, dau, totalInstalls, installsToday, series, points, platforms, versions] =
      await db.batch([
        db
          .prepare('SELECT COUNT(*) AS n FROM installations WHERE last_seen >= ?')
          .bind(now - ACTIVE_WINDOW_MS),
        db.prepare('SELECT COUNT(*) AS n FROM installations WHERE last_seen >= ?').bind(now - DAY_MS),
        db.prepare('SELECT COUNT(*) AS n FROM installations'),
        db.prepare('SELECT COUNT(*) AS n FROM installations WHERE first_seen >= ?').bind(todayStart),
        db
          .prepare(
            "SELECT date(first_seen / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM installations WHERE first_seen >= ? GROUP BY day ORDER BY day",
          )
          .bind(seriesStart),
        db.prepare(
          'SELECT country, region, city, latitude, longitude, COUNT(*) AS n FROM installations WHERE country IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL GROUP BY country, city, latitude, longitude ORDER BY n DESC LIMIT ?',
        ).bind(MAX_POINTS),
        db.prepare(
          "SELECT COALESCE(platform, 'unknown') AS platform, COUNT(*) AS n FROM installations GROUP BY platform ORDER BY n DESC",
        ),
        db.prepare(
          "SELECT COALESCE(version, 'unknown') AS version, COUNT(*) AS n FROM installations GROUP BY version ORDER BY n DESC",
        ),
      ]);

    const byDay = new Map<string, number>();
    for (const row of (series.results ?? []) as Array<{ day: string; n: number }>) {
      byDay.set(row.day, row.n);
    }

    const installsSeries: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < SERIES_DAYS; i += 1) {
      const date = dayKey(seriesStart + i * DAY_MS);
      installsSeries.push({ date, count: byDay.get(date) ?? 0 });
    }

    return json({
      generatedAt: now,
      activeNow: count(activeNow),
      dau: count(dau),
      totalInstalls: count(totalInstalls),
      installsToday: count(installsToday),
      installsSeries,
      points: (points.results ?? []) as Array<Record<string, unknown>>,
      platforms: (platforms.results ?? []) as Array<Record<string, unknown>>,
      versions: (versions.results ?? []) as Array<Record<string, unknown>>,
    });
  } catch (error) {
    console.error('analytics stats failed', error);
    return json({ error: 'storage_failure' }, 500);
  }
};
