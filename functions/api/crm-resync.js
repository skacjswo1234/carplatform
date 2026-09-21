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

function todayStartKst() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
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
    const since = (url.searchParams.get('since') || todayStartKst()).trim();
    const limit = Number(url.searchParams.get('limit') || 100);
    const rows = await listInquiriesNeedingCrmSync(db, { since, limit });

    return json({
      success: true,
      since,
      mode: 'live_failures',
      count: rows.length,
      items: rows,
      note: '오늘부터 동기화 실패·대기 건만 표시합니다.',
    });
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

    const since = String(body.since || todayStartKst()).trim();
    const limit = Number(body.limit || 100);
    const requestIds = Array.isArray(body.ids)
      ? body.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    let rows = await listInquiriesNeedingCrmSync(db, {
      since,
      limit: Math.min(200, Math.max(1, limit)),
    });
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

      // 이미 customers에 있어도 재유입 ingest로 넘겨 재문의 세트를 만든다 (스킵 금지).
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
