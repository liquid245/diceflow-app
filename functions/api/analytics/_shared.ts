export interface Env {
  ANALYTICS_DB: D1Database;
}

export interface ParsedEvent {
  type: string;
  properties: string | null;
  clientTimestamp: number | null;
}

export interface ParsedEventBatch {
  installationId: string;
  sessionId: string;
  version: string | null;
  platform: string | null;
  events: ParsedEvent[];
}

export interface ParsedHeartbeat {
  installationId: string;
  sessionId: string;
  version: string | null;
  platform: string | null;
}

export interface Geo {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS = 50;
const MAX_ID_LENGTH = 64;
const MAX_META_LENGTH = 64;
const MAX_PROPERTIES_BYTES = 4096;
const MAX_GEO_LENGTH = 64;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
    ? value
    : null;
}

function asMeta(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_META_LENGTH
    ? value
    : null;
}

function parseProperties(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const encoded = JSON.stringify(value);
  if (encoded.length > MAX_PROPERTIES_BYTES) return undefined;
  return encoded;
}

function parseTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseEventBatch(raw: unknown): ParsedEventBatch | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const input = raw as Record<string, unknown>;
  const installationId = asId(input.installationId);
  const sessionId = asId(input.sessionId);
  if (!installationId || !sessionId) return null;
  if (!Array.isArray(input.events) || input.events.length === 0 || input.events.length > MAX_EVENTS) {
    return null;
  }
  const events: ParsedEvent[] = [];
  for (const item of input.events) {
    if (typeof item !== 'object' || item === null) return null;
    const event = item as Record<string, unknown>;
    if (typeof event.type !== 'string' || !EVENT_TYPE_PATTERN.test(event.type)) return null;
    const properties = parseProperties(event.properties);
    if (properties === undefined) return null;
    events.push({ type: event.type, properties, clientTimestamp: parseTimestamp(event.timestamp) });
  }
  return {
    installationId,
    sessionId,
    version: asMeta(input.version),
    platform: asMeta(input.platform),
    events,
  };
}

export function parseHeartbeat(raw: unknown): ParsedHeartbeat | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const input = raw as Record<string, unknown>;
  const installationId = asId(input.installationId);
  const sessionId = asId(input.sessionId);
  if (!installationId || !sessionId) return null;
  return {
    installationId,
    sessionId,
    version: asMeta(input.version),
    platform: asMeta(input.platform),
  };
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length === 0 || text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function readGeo(request: Request): Geo {
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf;
  const str = (key: string): string | null => {
    const value = cf?.[key];
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_GEO_LENGTH
      ? value
      : null;
  };
  const num = (key: string): number | null => {
    const value = cf?.[key];
    const parsed =
      typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    country: str('country'),
    region: str('region'),
    city: str('city'),
    latitude: num('latitude'),
    longitude: num('longitude'),
  };
}

export async function upsertInstallation(
  db: D1Database,
  installationId: string,
  now: number,
  meta: { version: string | null; platform: string | null; geo: Geo },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO installations
         (installation_id, first_seen, last_seen, platform, version, country, region, city, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(installation_id) DO UPDATE SET
         last_seen = excluded.last_seen,
         platform = COALESCE(excluded.platform, installations.platform),
         version = COALESCE(excluded.version, installations.version),
         country = COALESCE(excluded.country, installations.country),
         region = COALESCE(excluded.region, installations.region),
         city = COALESCE(excluded.city, installations.city),
         latitude = COALESCE(excluded.latitude, installations.latitude),
         longitude = COALESCE(excluded.longitude, installations.longitude)`,
    )
    .bind(
      installationId,
      now,
      now,
      meta.platform,
      meta.version,
      meta.geo.country,
      meta.geo.region,
      meta.geo.city,
      meta.geo.latitude,
      meta.geo.longitude,
    )
    .run();
}

export async function insertEvents(
  db: D1Database,
  batch: ParsedEventBatch,
  now: number,
): Promise<void> {
  const statements = batch.events.map((event) =>
    db
      .prepare(
        `INSERT INTO events
           (installation_id, session_id, type, properties, client_timestamp, server_timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        batch.installationId,
        batch.sessionId,
        event.type,
        event.properties,
        event.clientTimestamp,
        now,
      ),
  );
  if (statements.length > 0) {
    await db.batch(statements);
  }
}
