const LANDING_LABELS = {
  'carplatform.shop': '1번랜딩페이지',
  'carplatform.co.kr': '2번랜딩페이지',
};

const DEFAULT_REENTRY_INGEST_URL = 'https://carplatform-crm.pages.dev/api/reentry-customers/ingest';
const DEFAULT_CUSTOMER_INGEST_URL = 'https://carplatform-crm.pages.dev/api/customers/ingest';
const INSERT_MAX_ATTEMPTS = 8;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUniqueConflict(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('unique') ||
    message.includes('constraint') ||
    message.includes('primary key') ||
    message.includes('SQLITE_CONSTRAINT')
  );
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

  const existing = await findPhoneRow(crmDb, 'customers', phoneDigits);
  if (existing?.row_id) {
    return { ok: true, method: 'd1', m_idx: existing.row_id, already: true };
  }

  const phone = formatPhoneDisplay(phoneDigits);
  const route = formatLandingRoute(payload.source_site);
  const registeredAt = payload.registered_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const belong = String(payload.belong || payload.affiliation || '').trim() || null;
  let lastError = null;

  for (let attempt = 1; attempt <= INSERT_MAX_ATTEMPTS; attempt += 1) {
    const mIdx = await getNextCustomerId(crmDb);
    const listNo = await getNextListNo(crmDb);

    try {
      await crmDb
        .prepare(`
          INSERT INTO customers (
            m_idx, list_no, name, phone, route, belong, finance, vehicle_timing,
            manager, manager_account_id, status, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '미등록', ?)
        `)
        .bind(
          mIdx,
          listNo,
          payload.name,
          phone,
          route,
          belong,
          payload.finance || null,
          payload.vehicle_timing || payload.memo || null,
          registeredAt,
        )
        .run();

      return { ok: true, method: 'd1', m_idx: mIdx, attempts: attempt };
    } catch (error) {
      lastError = error;

      const again = await findPhoneRow(crmDb, 'customers', phoneDigits);
      if (again?.row_id) {
        return { ok: true, method: 'd1', m_idx: again.row_id, already: true, attempts: attempt };
      }

      if (!isUniqueConflict(error) || attempt >= INSERT_MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(15 * attempt);
    }
  }

  throw lastError || new Error('CRM customer insert failed');
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
  let d1Error = null;

  if (crmDb) {
    try {
      return await insertReentryDirect(crmDb, payload);
    } catch (error) {
      d1Error = error;
      console.error('CRM reentry D1 insert failed, fallback HTTP', error);
    }
  }

  const url = String(env?.CRM_REENTRY_INGEST_URL || DEFAULT_REENTRY_INGEST_URL).trim();
  const httpResult = await postCrmIngest(env, url, payload);

  if (!httpResult.ok && d1Error) {
    return {
      ...httpResult,
      d1_error: String(d1Error?.message || d1Error),
    };
  }

  return httpResult;
}

export async function sendCustomerIngest(env, payload) {
  const crmDb = getCrmDb(env);
  let d1Error = null;

  if (crmDb) {
    try {
      return await insertCustomerDirect(crmDb, payload);
    } catch (error) {
      d1Error = error;
      console.error('CRM customer D1 insert failed, fallback HTTP', error);
    }
  }

  const url = String(env?.CRM_CUSTOMER_INGEST_URL || DEFAULT_CUSTOMER_INGEST_URL).trim();
  const result = await postCrmIngest(env, url, payload);

  if (!result.ok && result.status === 409 && result.data?.duplicate) {
    return sendReentryIngest(env, payload);
  }

  if (!result.ok && d1Error) {
    return {
      ...result,
      d1_error: String(d1Error?.message || d1Error),
    };
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

/** 동기화 실패 시 즉시 재시도 (최대 attempts회) */
export async function syncInquiryToCrmWithRetry(env, crmPhoneStatus, payload, attempts = 3) {
  let last = { ok: false, reason: 'not_attempted' };

  for (let i = 1; i <= attempts; i += 1) {
    // 매 시도마다 CRM 상태 재확인 (중간에 다른 요청이 넣은 경우 재진입 처리)
    let status = crmPhoneStatus;
    const crmDb = getCrmDb(env);
    if (crmDb && payload?.phone) {
      try {
        status = await getCrmPhoneStatus(crmDb, normalizePhoneDigits(payload.phone));
      } catch (error) {
        console.error('getCrmPhoneStatus retry failed', error);
      }
    }

    last = await syncInquiryToCrm(env, status, payload);

    if (last?.ok || last?.skipped) {
      return { ...last, attempts: i };
    }

    if (i < attempts) {
      await sleep(40 * i);
    }
  }

  return { ...last, attempts };
}

export { LANDING_LABELS };
