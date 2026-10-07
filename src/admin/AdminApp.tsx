import { useCallback, useEffect, useState } from 'react';
import { config } from '../config';
import { fetchStats, type StatsResponse } from './api';
import { MapView } from './MapView';

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <span className="card-value">{value}</span>
      <span className="card-label">{label}</span>
    </div>
  );
}

function SeriesChart({ series }: { series: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...series.map((day) => day.count));
  return (
    <div className="chart">
      {series.map((day) => (
        <div key={day.date} className="bar" title={`${day.date}: ${day.count}`}>
          <div className="bar-fill" style={{ height: `${(day.count / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function BucketList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; n: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.n));
  return (
    <div>
      <h2>{title}</h2>
      <ul className="buckets">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="bucket-label">{row.label}</span>
            <span className="bucket-bar">
              <span style={{ width: `${(row.n / max) * 100}%` }} />
            </span>
            <span className="bucket-n">{row.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminApp() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const stats = await fetchStats(config.analytics.statsEndpoint);
      setData(stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchStats(config.analytics.statsEndpoint)
      .then((stats) => {
        if (!active) return;
        setData(stats);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'failed to load stats');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>DiceFlow Analytics</h1>
        <div className="admin-meta">
          {data && <span>updated {new Date(data.generatedAt).toLocaleTimeString()}</span>}
          <button type="button" onClick={refresh} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <section className="cards">
            <Card label="Active now" value={data.activeNow} />
            <Card label="DAU" value={data.dau} />
            <Card label="Installs today" value={data.installsToday} />
            <Card label="Total installs" value={data.totalInstalls} />
          </section>

          <section>
            <h2>Locations</h2>
            <MapView points={data.points} />
          </section>

          <section>
            <h2>Installs (30 days)</h2>
            <SeriesChart series={data.installsSeries} />
          </section>

          <section className="lists">
            <BucketList
              title="Platforms"
              rows={data.platforms.map((row) => ({ label: row.platform, n: row.n }))}
            />
            <BucketList
              title="Versions"
              rows={data.versions.map((row) => ({ label: row.version, n: row.n }))}
            />
          </section>
        </>
      )}
    </div>
  );
}
