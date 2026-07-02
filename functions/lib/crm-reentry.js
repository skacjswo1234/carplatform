const LANDING_LABELS = {
  'carplatform.shop': '1번랜딩페이지',
  'carplatform.co.kr': '2번랜딩페이지',
};

const DEFAULT_REENTRY_INGEST_URL = 'https://carplatform-crm.pages.dev/api/reentry-customers/ingest';
const DEFAULT_CUSTOMER_INGEST_URL = 'https://carplatform-crm.pages.dev/api/customers/ingest';

export function getCrmDb(env) {
  return env?.['carplatform-crm-db'] || null;
}

export function normalizePhoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
}

function normalizedPhoneSql(column) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, '-', ''), ' ', ''), '.', ''), '(', ''), ')', '')`;
}

function formatLandingRoute(sourceSite, subRoute = '') {
  const key = String(sourceSite || '').trim().toLowerCase().replace(/^www\./, '');
  const label = LANDING_LABELS[key] || String(sourceSite || '').trim() || '-';
  const sub = String(subRoute || '').trim();
  return sub ? `${label} / ${sub}` : label;
}

async function findPhoneRow(db, table, phoneDigits) {
  const idColumn = table === 'customers' ? 'm_idx' : 'id';

  return db
    .prepare(`SELECT ${idColumn} AS row_id FROM ${table} WHERE ${normalizedPhoneSql('phone')} = ? LIMIT 1`)
    .bind(phoneDigits)
    .first();
}

export async function getCrmPhoneStatus(crmDb, phoneDigits) {
  if (!crmDb || !phoneDigits) {
    return { status: 'new' };
  }

  if (await findPhoneRow(crmDb, 'blacklist_customers', phoneDigits)) {
    return { status: 'blacklisted' };
  }

  if (await findPhoneRow(crmDb, 'customers', phoneDigits)) {
    return { status: 'reentry', reason: 'customers' };
  }

  if (await findPhoneRow(crmDb, 'reentry_customers', phoneDigits)) {
    return { status: 'reentry', reason: 'reentry' };
  }

  return { status: 'new' };
}

async function getNextCustomerId(crmDb) {
  const row = await crmDb.prepare('SELECT COALESCE(MAX(m_idx), 0) AS maxId FROM customers').first();
  return Number(row?.maxId || 0) + 1;
}

async function insertCustomerDirect(crmDb, payload) {
  const phoneDigits = normalizePhoneDigits(payload.phone);
  const route = formatLandingRoute(payload.source_site, payload.route);
  const registeredAt = payload.registered_at || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const mIdx = await getNextCustomerId(crmDb);

  await crmDb
    .prepare(`
      INSERT INTO customers (
        m_idx, list_no, name, phone, route, finance, vehicle_timing,
        manager, manager_account_id, status, registered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, '미등록', ?)
    `)
    .bind(
      mIdx,
      mIdx,
      payload.name,
      phoneDigits,
      route,
      payload.finance || null,
      payload.vehicle_timing || payload.memo || null,
      registeredAt,
    )
    .run();

  return { ok: true, method: 'd1', m_idx: mIdx };
}

async function insertReentryDirect(crmDb, payload) {
  const phoneDigits = normalizePhoneDigits(payload.phone);
  const route = formatLandingRoute(payload.source_site, payload.route);
  const registeredAt = payload.registered_at || new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (payload.external_id && payload.source_site) {
    const existing = await crmDb
      .prepare('SELECT id FROM reentry_customers WHERE source_site = ? AND external_id = ?')
      .bind(payload.source_site, String(payload.external_id))
      .first();

    if (existing) {
      await crmDb
        .prepare(`
          UPDATE reentry_customers
          SET name = ?, phone = ?, route = ?, finance = ?, memo = ?, vehicle_timing = ?,
              registered_at = COALESCE(NULLIF(?, ''), registered_at),
              raw_json = ?, imported_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          payload.name,
          phoneDigits,
          route,
          payload.finance || '',
          payload.memo || '',
          payload.vehicle_timing || payload.memo || '',
          registeredAt,
          JSON.stringify(payload),
          existing.id,
        )
        .run();

      return { ok: true, method: 'd1', action: 'updated', id: existing.id };
    }
  }

  const result = await crmDb
    .prepare(`
      INSERT INTO reentry_customers (
        external_id, source_site, name, phone, route, finance, memo,
        vehicle_timing, registered_at, raw_json, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), CURRENT_TIMESTAMP), ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      String(payload.external_id || ''),
      payload.source_site,
      payload.name,
      phoneDigits,
      route,
      payload.finance || '',
      payload.memo || '',
      payload.vehicle_timing || payload.memo || '',
      registeredAt,
      JSON.stringify(payload),
    )
    .run();

  return { ok: true, method: 'd1', action: 'created', id: result.meta?.last_row_id };
}

async function postCrmIngest(env, url, payload) {
  const apiKey = String(env?.REENTRY_API_KEY || '').trim();

  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'missing_api_key' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('CRM ingest failed', url, response.status, data);
      return { ok: false, status: response.status, data };
    }

    return { ok: true, status: response.status, data, method: 'http' };
  } catch (error) {
    console.error('CRM ingest error', url, error);
    return { ok: false, error: String(error) };
  }
}

export async function sendReentryIngest(env, payload) {
  const crmDb = getCrmDb(env);

  if (crmDb) {
    try {
      return await insertReentryDirect(crmDb, payload);
    } catch (error) {
      console.error('CRM reentry D1 insert failed, fallback HTTP', error);
    }
  }

  const url = String(env?.CRM_REENTRY_INGEST_URL || DEFAULT_REENTRY_INGEST_URL).trim();
  return postCrmIngest(env, url, payload);
}

export async function sendCustomerIngest(env, payload) {
  const crmDb = getCrmDb(env);

  if (crmDb) {
    try {
      return await insertCustomerDirect(crmDb, payload);
    } catch (error) {
      console.error('CRM customer D1 insert failed, fallback HTTP', error);
    }
  }

  const url = String(env?.CRM_CUSTOMER_INGEST_URL || DEFAULT_CUSTOMER_INGEST_URL).trim();
  const result = await postCrmIngest(env, url, payload);

  if (!result.ok && result.status === 409 && result.data?.duplicate) {
    return sendReentryIngest(env, payload);
  }

  return result;
}

export async function syncInquiryToCrm(env, crmPhoneStatus, payload) {
  if (crmPhoneStatus?.status === 'reentry') {
    return sendReentryIngest(env, payload);
  }

  if (crmPhoneStatus?.status === 'new') {
    return sendCustomerIngest(env, payload);
  }

  return { ok: false, skipped: true, reason: crmPhoneStatus?.status || 'unknown' };
}
