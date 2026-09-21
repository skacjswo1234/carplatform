import {
  getCrmDb,
  getCrmPhoneStatus,
  normalizePhoneDigits,
  syncInquiryToCrmWithRetry,
} from '../lib/crm-reentry.js';
import {
  ensureInquiryCrmSyncColumns,
  listInquiriesNeedingCrmSync,
  updateInquiryCrmSync,
  toKstDatetime,
} from '../lib/crm-sync-status.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...CORS,
    },
  });
}

function toPayload(row) {
  return {
    source_site: 'carplatform.shop',
    external_id: String(row.id),
    name: String(row.name || '').trim(),
    phone: normalizePhoneDigits(row.phone),
    finance: String(row.vehicle_type || ''),
    belong: String(row.affiliation || ''),
    affiliation: String(row.affiliation || ''),
    memo: String(row.car_name || ''),
    vehicle_timing: String(row.car_name || ''),
    registered_at: String(row.created_at || toKstDatetime()),
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const db = env['carplatform-db'];
    if (!db) return json({ success: false, error: 'DB 없음' }, 500);
    await ensureInquiryCrmSyncColumns(db);

    const url = new URL(request.url);
    const since = (url.searchParams.get('since') || '2026-09-01 00:00:00').trim();
    const limit = Number(url.searchParams.get('limit') || 200);
    const items = await listInquiriesNeedingCrmSync(db, { since, limit });

    return json({ success: true, since, count: items.length, items });
  } catch (error) {
    console.error('crm-resync GET', error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const db = env['carplatform-db'];
    if (!db) return json({ success: false, error: 'DB 없음' }, 500);
    await ensureInquiryCrmSyncColumns(db);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const since = String(body.since || '2026-09-01 00:00:00').trim();
    const limit = Number(body.limit || 200);
    const requestIds = Array.isArray(body.ids)
      ? body.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    let rows = await listInquiriesNeedingCrmSync(db, { since, limit });
    if (requestIds.length) {
      const allow = new Set(requestIds);
      rows = rows.filter((row) => allow.has(Number(row.id)));
    }

    const crmDb = getCrmDb(env);
    const results = [];

    for (const row of rows) {
      const payload = toPayload(row);
      if (!payload.name || !payload.phone) {
        results.push({ id: row.id, ok: false, reason: 'invalid_payload' });
        continue;
      }

      let status = { status: 'new' };
      if (crmDb) {
        status = await getCrmPhoneStatus(crmDb, payload.phone);
      }

      if (status.status === 'reentry' && status.reason === 'customers') {
        const already = { ok: true, already: true, reason: 'already_in_crm', method: 'skip' };
        await updateInquiryCrmSync(db, row.id, already);
        results.push({
          id: row.id,
          name: row.name,
          phone: row.phone,
          ok: true,
          reason: 'already_in_crm',
        });
        continue;
      }

      const syncResult = await syncInquiryToCrmWithRetry(env, status, payload, 3);
      await updateInquiryCrmSync(db, row.id, syncResult);
      results.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        ok: Boolean(syncResult?.ok),
        skipped: Boolean(syncResult?.skipped),
        reason: syncResult?.reason || null,
        m_idx: syncResult?.m_idx || syncResult?.data?.m_idx || null,
      });
    }

    const synced = results.filter((r) => r.ok || r.skipped).length;
    return json({
      success: true,
      total: results.length,
      synced,
      failed: results.length - synced,
      results,
    });
  } catch (error) {
    console.error('crm-resync POST', error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}
