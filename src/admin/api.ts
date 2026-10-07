export interface StatsPoint {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  n: number;
}

export interface StatsBucket {
  n: number;
}

export interface StatsPlatform extends StatsBucket {
  platform: string;
}

export interface StatsVersion extends StatsBucket {
  version: string;
}

export interface StatsResponse {
  generatedAt: number;
  activeNow: number;
  dau: number;
  totalInstalls: number;
  installsToday: number;
  installsSeries: Array<{ date: string; count: number }>;
  points: StatsPoint[];
  platforms: StatsPlatform[];
  versions: StatsVersion[];
}

export async function fetchStats(endpoint: string, signal?: AbortSignal): Promise<StatsResponse> {
  const response = await fetch(endpoint, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`stats request failed: ${response.status}`);
  return (await response.json()) as StatsResponse;
}
