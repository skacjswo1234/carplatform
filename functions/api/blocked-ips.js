import {
  ensureBlockedIpsTable,
  jsonResponse,
  corsOptions,
} from '../lib/ip-block.js';

function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const t = ip.trim();
  if (t === 'unknown' || t.length > 45) return false;
  return /^(?:\d{1,3}\.){3}\d{1,3}$|^[a-fA-F0-9:]+$/.test(t);
}

function mergeIpRow(map, ip, addCount = 0, lastSeen = null) {
  if (!isValidIp(ip)) return;
  const prev = map.get(ip);
  if (!prev) {
    map.set(ip, {
      ip_address: ip,
      inquiry_count: addCount || 1,
      last_seen: lastSeen,
    });
    return;
  }
  prev.inquiry_count = (prev.inquiry_count || 0) + (addCount || 0);
  if (lastSeen && (!prev.last_seen || String(lastSeen) > String(prev.last_seen))) {
    prev.last_seen = lastSeen;
  }
}

async function listBlocked(db) {
  const result = await db.prepare(`
    SELECT id, ip_address, reason, created_at
    FROM blocked_ips
    ORDER BY created_at DESC
  `).all();
  return result.results || [];
}

/** inquiry_limits 시간대와 맞는 기존 문의에 client_ip 보정 */
async function backfillClientIpFromLimits(db) {
  try {
    await db.prepare(`
      UPDATE inquiries
      SET client_ip = (
        SELECT il.ip_address
        FROM inquiry_limits il
        WHERE il.ip_address IS NOT NULL
          AND il.ip_address != ''
          AND il.ip_address != 'unknown'
          AND datetime(il.last_inquiry_at) >= datetime(inquiries.created_at, '-2 hours')
          AND datetime(il.last_inquiry_at) <= datetime(inquiries.created_at, '+2 hours')
        ORDER BY ABS(
          (julianday(il.last_inquiry_at) - julianday(inquiries.created_at)) * 86400
        )
        LIMIT 1
      )
      WHERE (client_ip IS NULL OR client_ip = '')
        AND EXISTS (
          SELECT 1 FROM inquiry_limits il2
          WHERE il2.ip_address IS NOT NULL
            AND il2.ip_address != ''
            AND il2.ip_address != 'unknown'
            AND datetime(il2.last_inquiry_at) >= datetime(inquiries.created_at, '-2 hours')
            AND datetime(il2.last_inquiry_at) <= datetime(inquiries.created_at, '+2 hours')
        )
    `).run();
  } catch (e) {
    console.error('backfillClientIpFromLimits:', e);
  }
}

async function listInquiryIpsFromKV(kv, map) {
  if (!kv || typeof kv.list !== 'function') return;
  try {
    let cursor;
    do {
      const page = await kv.list({ prefix: 'inquiry_ip:', cursor, limit: 100 });
      for (const key of page.keys || []) {
        const ip = key.name.replace(/^inquiry_ip:/, '');
        let lastSeen = null;
        try {
          const raw = await kv.get(key.name);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.ts === 'number') {
              lastSeen = new Date(parsed.ts).toISOString().slice(0, 19).replace('T', ' ');
            }
          }
        } catch (_) {}
        mergeIpRow(map, ip, 1, lastSeen);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    console.error('listInquiryIpsFromKV:', e);
  }
}

/** 문의·제한·KV에서 모인 IP 목록 */
async function listInquiryIps(db, kv) {
  const map = new Map();

  try {
    const fromLimits = await db.prepare(`
      SELECT
        ip_address,
        SUM(inquiry_count) as inquiry_count,
        MAX(last_inquiry_at) as last_seen
      FROM inquiry_limits
      WHERE ip_address IS NOT NULL AND ip_address != '' AND ip_address != 'unknown'
      GROUP BY ip_address
    `).all();

    for (const row of fromLimits.results || []) {
      mergeIpRow(map, row.ip_address, row.inquiry_count || 1, row.last_seen);
    }
  } catch (e) {
    console.error('listInquiryIps limits:', e);
  }

  try {
    const fromInquiries = await db.prepare(`
      SELECT
        client_ip as ip_address,
        COUNT(*) as inquiry_count,
        MAX(created_at) as last_seen
      FROM inquiries
      WHERE client_ip IS NOT NULL AND client_ip != '' AND client_ip != 'unknown'
      GROUP BY client_ip
    `).all();

    for (const row of fromInquiries.results || []) {
      mergeIpRow(map, row.ip_address, row.inquiry_count || 1, row.last_seen);
    }
  } catch (_) {
    /* client_ip column may not exist yet */
  }

  await listInquiryIpsFromKV(kv, map);

  const blockedSet = new Set((await listBlocked(db)).map((b) => b.ip_address));

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      is_blocked: blockedSet.has(row.ip_address),
    }))
    .sort((a, b) => String(b.last_seen || '').localeCompare(String(a.last_seen || '')));
}

/** 기존·신규 문의 전체 (문의별 차단용) */
async function listInquiryRecords(db) {
  let rows = [];
  try {
    const result = await db.prepare(`
      SELECT
        id,
        wr_name as name,
        wr_subject as phone,
        wr_4 as car_name,
        client_ip,
        status,
        created_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT 1000
    `).all();
    rows = result.results || [];
  } catch (_) {
    const result = await db.prepare(`
      SELECT
        id,
        wr_name as name,
        wr_subject as phone,
        wr_4 as car_name,
        status,
        created_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT 1000
    `).all();
    rows = (result.results || []).map((r) => ({ ...r, client_ip: null }));
  }

  const blockedSet = new Set((await listBlocked(db)).map((b) => b.ip_address));

  return rows.map((row) => {
    const ip = row.client_ip && isValidIp(row.client_ip) ? row.client_ip.trim() : null;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      car_name: row.car_name,
      client_ip: ip,
      status: row.status,
      created_at: row.created_at,
      is_blocked: ip ? blockedSet.has(ip) : false,
      can_block: !!ip,
    };
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const db = env['carplatform-db'];
    await ensureBlockedIpsTable(db);
    await backfillClientIpFromLimits(db);

    const blocked = await listBlocked(db);
    const inquiry_ips = await listInquiryIps(db, env.INQUIRY_LIMITS_KV);
    const inquiry_records = await listInquiryRecords(db);

    return jsonResponse({
      success: true,
      blocked,
      inquiry_ips,
      inquiry_records,
    });
  } catch (error) {
    console.error('blocked-ips GET:', error);
    return jsonResponse({ success: false, error: '목록을 불러오지 못했습니다.' }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const body = await request.json();
    let { ip, reason } = body;
    ip = ip ? String(ip).trim() : '';

    if (!isValidIp(ip)) {
      return jsonResponse({ success: false, error: '올바른 IP 주소를 입력해주세요.' }, 400);
    }

    const db = env['carplatform-db'];
    await ensureBlockedIpsTable(db);

    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const createdAt = kst.toISOString().slice(0, 19).replace('T', ' ');

    await db.prepare(`
      INSERT INTO blocked_ips (ip_address, reason, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(ip_address) DO UPDATE SET
        reason = excluded.reason,
        created_at = excluded.created_at
    `).bind(ip, reason ? String(reason).slice(0, 500) : null, createdAt).run();

    return jsonResponse({
      success: true,
      message: 'IP가 차단 목록에 등록되었습니다.',
      ip,
    });
  } catch (error) {
    console.error('blocked-ips POST:', error);
    return jsonResponse({ success: false, error: 'IP 차단 등록에 실패했습니다.' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const ip = url.searchParams.get('ip');

    if (!ip || !isValidIp(ip)) {
      return jsonResponse({ success: false, error: '삭제할 IP를 지정해주세요.' }, 400);
    }

    const db = env['carplatform-db'];
    await ensureBlockedIpsTable(db);

    await db.prepare(`DELETE FROM blocked_ips WHERE ip_address = ?`).bind(ip.trim()).run();

    return jsonResponse({
      success: true,
      message: 'IP 차단이 해제되었습니다.',
      ip: ip.trim(),
    });
  } catch (error) {
    console.error('blocked-ips DELETE:', error);
    return jsonResponse({ success: false, error: 'IP 차단 해제에 실패했습니다.' }, 500);
  }
}

export async function onRequestOptions() {
  return corsOptions('GET, POST, DELETE, OPTIONS');
}
