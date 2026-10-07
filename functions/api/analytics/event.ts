import {
  type Env,
  insertEvents,
  json,
  parseEventBatch,
  readGeo,
  readJson,
  upsertInstallation,
} from './_shared';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const raw = await readJson(context.request);
  if (raw === undefined) return json({ error: 'invalid_body' }, 400);

  const batch = parseEventBatch(raw);
  if (!batch) return json({ error: 'invalid_payload' }, 400);

  const now = Date.now();
  const geo = readGeo(context.request);
  try {
    await upsertInstallation(context.env.ANALYTICS_DB, batch.installationId, now, {
      version: batch.version,
      platform: batch.platform,
      geo,
    });
    await insertEvents(context.env.ANALYTICS_DB, batch, now);
  } catch (error) {
    console.error('analytics event insert failed', error);
    return json({ error: 'storage_failure' }, 500);
  }
  return new Response(null, { status: 204 });
};
