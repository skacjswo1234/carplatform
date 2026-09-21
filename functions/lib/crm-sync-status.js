/** inquiries 테이블 CRM 동기화 상태 컬럼 */

export function toKstDatetime() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

async function ensureColumn(db, table, column, definition) {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = (rows?.results || []).some((row) => row.name === column);
  if (exists) return;
  await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

export async function ensureInquiryCrmSyncColumns(db) {
  if (!db) return;
  await ensureColumn(db, 'inquiries', 'crm_sync_status', "TEXT NOT NULL DEFAULT 'pending'");
  await ensureColumn(db, 'inquiries', 'crm_sync_detail', 'TEXT');
  await ensureColumn(db, 'inquiries', 'crm_synced_at', 'TEXT');
}

export async function updateInquiryCrmSync(db, inquiryId, syncResult) {
  if (!db || !inquiryId) return;
  await ensureInquiryCrmSyncColumns(db);

  const ok = Boolean(syncResult?.ok);
  const skipped = Boolean(syncResult?.skipped);
  const status = ok ? 'ok' : skipped ? 'skipped' : 'failed';
  const detail = JSON.stringify({
    status,
    reason: syncResult?.reason || null,
    method: syncResult?.method || null,
    m_idx: syncResult?.m_idx || syncResult?.data?.m_idx || null,
    attempts: syncResult?.attempts || null,
    error: syncResult?.error || syncResult?.d1_error || null,
  }).slice(0, 2000);

  await db
    .prepare(
      `UPDATE inquiries
       SET crm_sync_status = ?,
           crm_sync_detail = ?,
           crm_synced_at = ?
       WHERE id = ?`
    )
    .bind(status, detail, toKstDatetime(), inquiryId)
    .run();
}

export async function listInquiriesNeedingCrmSync(db, { since = '', limit = 100 } = {}) {
  if (!db) return [];
  await ensureInquiryCrmSyncColumns(db);
  // 접수 시 기록된 동기화 실패/대기만 (CRM 전체 전화 비교 없음)
  const cap = Math.min(500, Math.max(1, Number(limit) || 100));
  const params = [];
  let where = `crm_sync_status IN ('pending', 'failed')`;

  if (since) {
    where += ` AND created_at >= ?`;
    params.push(String(since));
  }

  const result = await db
    .prepare(
      `SELECT id, wr_name as name, wr_subject as phone, wr_7 as affiliation,
              wr_3 as vehicle_type, wr_4 as car_name, created_at,
              crm_sync_status, crm_sync_detail
       FROM inquiries
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(...params, cap)
    .all();

  return result?.results || [];
}
