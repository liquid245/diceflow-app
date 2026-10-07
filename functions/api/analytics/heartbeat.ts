import { type Env, json, parseHeartbeat, readGeo, readJson, upsertInstallation } from './_shared';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const raw = await readJson(context.request);
  if (raw === undefined) return json({ error: 'invalid_body' }, 400);

  const heartbeat = parseHeartbeat(raw);
  if (!heartbeat) return json({ error: 'invalid_payload' }, 400);

  try {
    await upsertInstallation(context.env.ANALYTICS_DB, heartbeat.installationId, Date.now(), {
      version: heartbeat.version,
      platform: heartbeat.platform,
      geo: readGeo(context.request),
    });
  } catch (error) {
    console.error('analytics heartbeat failed', error);
    return json({ error: 'storage_failure' }, 500);
  }
  return new Response(null, { status: 204 });
};
