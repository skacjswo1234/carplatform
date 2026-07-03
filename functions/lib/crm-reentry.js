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

export function formatPhoneDisplay(phone) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function normalizedPhoneSql(column) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, '-', ''), ' ', ''), '.', ''), '(', ''), ')', '')`;
}

function formatLandingRoute(sourceSite) {
  const key = String(sourceSite || '').trim().toLowerCase().replace(/^www\./, '');
  return key || '-';
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

async function getNextListNo(crmDb) {
  const row = await crmDb.prepare('SELECT COALESCE(MAX(list_no), 0) AS maxNo FROM customers').first();
  return Number(row?.maxNo || 0) + 1;
}

async function insertCustomerDirect(crmDb, payload) {
  const phoneDigits = normalizePhoneDigits(payload.phone);

  if (await findPhoneRow(crmDb, 'blacklist_customers', phoneDigits)) {
    return { ok: false, skipped: true, reason: 'blacklisted' };
  }

  const phone = formatPhoneDisplay(phoneDigits);
  const route = formatLandingRoute(payload.source_site);
  const registeredAt = payload.registered_at || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const mIdx = await getNextCustomerId(crmDb);
  const listNo = await getNextListNo(crmDb);

  await crmDb
    .prepare(`
      INSERT INTO customers (
        m_idx, list_no, name, phone, route, finance, vehicle_timing,
        manager, manager_account_id, status, registered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, '미등록', ?)
    `)
    .bind(
      mIdx,
      listNo,
      payload.name,
      phone,
      route,
      payload.finance || null,
      payload.vehicle_timing || payload.memo || null,
      registeredAt,
    )
    .run();

  return { ok: true, method: 'd1', m_idx: mIdx };
}

async function moveCustomerToReentry(crmDb, phoneDigits, groupKey) {
  const customer = await crmDb
    .prepare(`SELECT * FROM customers WHERE ${normalizedPhoneSql('phone')} = ? LIMIT 1`)
    .bind(phoneDigits)
    .first();

  if (!customer) {
    return { moved: false };
  }

  const alreadyMoved = await crmDb
    .prepare(`
      SELECT id
      FROM reentry_customers
      WHERE record_type = 'existing'
        AND customer_m_idx = ?
      LIMIT 1
    `)
    .bind(customer.m_idx)
    .first();

  if (alreadyMoved) {
    return { moved: false, reason: 'already_in_reentry' };
  }

  await crmDb
    .prepare(`
      INSERT INTO reentry_customers (
        record_type,
        customer_m_idx,
        reentry_group_key,
        list_no,
        external_id,
        source_site,
        name,
        phone,
        route,
        finance,
        memo,
        vehicle_timing,
        manager,
        manager_account_id,
        status,
        registered_at,
        raw_json,
        imported_at
      ) VALUES (
        'existing',
        ?,
        ?,
        ?,
        '',
        '',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP
      )
    `)
    .bind(
      customer.m_idx,
      groupKey,
      customer.list_no,
      customer.name,
      customer.phone,
      customer.route,
      customer.finance,
      customer.memo || '',
      customer.vehicle_timing,
      customer.manager,
      customer.manager_account_id,
      customer.status,
      customer.registered_at,
      JSON.stringify({ moved_from: 'customers', customer }),
    )
    .run();

  await crmDb.prepare('DELETE FROM customers WHERE m_idx = ?').bind(customer.m_idx).run();

  return { moved: true, customer_m_idx: customer.m_idx };
}

async function insertReentryDirect(crmDb, payload) {
  const phoneDigits = normalizePhoneDigits(payload.phone);

  if (await findPhoneRow(crmDb, 'blacklist_customers', phoneDigits)) {
    return { ok: false, skipped: true, reason: 'blacklisted' };
  }

  const phone = formatPhoneDisplay(phoneDigits);
  const route = formatLandingRoute(payload.source_site);
  const registeredAt = payload.registered_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const groupKey = phoneDigits;
  let inquiryId;
  let action = 'created';

  if (payload.external_id && payload.source_site) {
    const existing = await crmDb
      .prepare(`
        SELECT id
        FROM reentry_customers
        WHERE source_site = ?
          AND external_id = ?
          AND COALESCE(record_type, 'inquiry') = 'inquiry'
      `)
      .bind(payload.source_site, String(payload.external_id))
      .first();

    if (existing) {
      await crmDb
        .prepare(`
          UPDATE reentry_customers
          SET name = ?, phone = ?, route = ?, finance = ?, memo = ?, vehicle_timing = ?,
              registered_at = COALESCE(NULLIF(?, ''), registered_at),
              reentry_group_key = COALESCE(NULLIF(reentry_group_key, ''), ?),
              raw_json = ?, imported_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          payload.name,
          phone,
          route,
          payload.finance || '',
          payload.memo || '',
          payload.vehicle_timing || payload.memo || '',
          registeredAt,
          groupKey,
          JSON.stringify(payload),
          existing.id,
        )
        .run();

      inquiryId = existing.id;
      action = 'updated';
    }
  }

  if (!inquiryId) {
    const result = await crmDb
      .prepare(`
        INSERT INTO reentry_customers (
          record_type,
          reentry_group_key,
          external_id,
          source_site,
          name,
          phone,
          route,
          finance,
          memo,
          vehicle_timing,
          registered_at,
          raw_json,
          imported_at
        ) VALUES ('inquiry', ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), CURRENT_TIMESTAMP), ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        groupKey,
        String(payload.external_id || ''),
        payload.source_site,
        payload.name,
        phone,
        route,
        payload.finance || '',
        payload.memo || '',
        payload.vehicle_timing || payload.memo || '',
        registeredAt,
        JSON.stringify(payload),
      )
      .run();

    inquiryId = result.meta?.last_row_id;
  }

  const moveResult = phoneDigits
    ? await moveCustomerToReentry(crmDb, phoneDigits, groupKey)
    : { moved: false };

  return {
    ok: true,
    method: 'd1',
    action,
    id: inquiryId,
    moved_existing: moveResult.moved === true,
  };
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
  if (crmPhoneStatus?.status === 'blacklisted') {
    return { ok: false, skipped: true, reason: 'blacklisted' };
  }

  if (crmPhoneStatus?.status === 'reentry') {
    return sendReentryIngest(env, payload);
  }

  if (crmPhoneStatus?.status === 'new') {
    return sendCustomerIngest(env, payload);
  }

  return { ok: false, skipped: true, reason: crmPhoneStatus?.status || 'unknown' };
}
