import {
  getCrmDb,
  getCrmPhoneStatus,
  normalizePhoneDigits,
  syncInquiryToCrmWithRetry,
  filterMissingFromCrm,
} from '../lib/crm-reentry.js';
import {
  ensureInquiryCrmSyncColumns,
  listInquiriesNeedingCrmSync,
  listInquiriesForCrmReconcile,
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

async function markAlreadyBatch(db, alreadyRows) {
  if (!alreadyRows.length) return;
  const detail = JSON.stringify({
    status: 'ok',
    reason: 'already_in_crm',
    method: 'reconcile',
  });
  const now = toKstDatetime();
  for (let i = 0; i < alreadyRows.length; i += 40) {
    const chunk = alreadyRows.slice(i, i + 40);
    const placeholders = chunk.map(() => '?').join(',');
    await db
      .prepare(
        `UPDATE inquiries
         SET crm_sync_status = 'ok',
             crm_sync_detail = ?,
             crm_synced_at = ?
         WHERE id IN (${placeholders})`
      )
      .bind(detail, now, ...chunk.map((r) => Number(r.id)))
      .run();
  }
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
      note: '오늘부터 동기화 실패·대기 건만 표시합니다. 과거 대조는 오늘까지 CRM 대조를 한 번 실행하세요.',
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

    const liveSince = todayStartKst();
    const action = String(body.action || '').trim();
    const limit = Number(body.limit || 100);

    // 과거 1회 대조
    if (action === 'reconcile') {
      const crmDb = getCrmDb(env);
      const reconcileSince = String(body.since || '2026-09-01 00:00:00').trim();
      const until = String(body.until || liveSince).trim();
      const scanLimit = Math.min(2000, Math.max(Number(limit) || 1000, 100));

      const candidates = await listInquiriesForCrmReconcile(db, {
        since: reconcileSince,
        until,
        limit: scanLimit,
      });

      const filtered = await filterMissingFromCrm(crmDb, candidates, (row) => row.phone);
      const alreadyRows = filtered.alreadyRows || [];
      const missing = filtered.missing || [];

      await markAlreadyBatch(db, alreadyRows);

      return json({
        success: true,
        action: 'reconcile',
        since: reconcileSince,
        until,
        scanned: candidates.length,
        already_in_crm: alreadyRows.length,
        missing_count: missing.length,
        items: missing.slice(0, Math.min(200, limit)),
        note: '오늘 이전 건을 CRM 전화번호와 1회 비교했습니다. 이미 있는 건은 ok로 정리했습니다.',
      });
    }

    const since = String(body.since || liveSince).trim();
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
