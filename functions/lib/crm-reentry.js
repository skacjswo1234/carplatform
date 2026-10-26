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

/** CRM customers/reentry에 이미 있는 전화번호(숫자만) Set */
export async function findExistingCrmPhoneDigits(crmDb, phoneDigitsList) {
  const found = new Set();
  if (!crmDb) return found;

  const unique = [...new Set((phoneDigitsList || []).map((v) => normalizePhoneDigits(v)).filter(Boolean))];
  if (!unique.length) return found;

  // REPLACE 컬럼 스캔을 청크마다 반복하면 GET이 타임아웃됨 → 전화번호만 1회 로드 후 메모리 비교
  const [customers, reentry] = await Promise.all([
    crmDb.prepare(`SELECT phone FROM customers WHERE phone IS NOT NULL AND TRIM(phone) != ''`).all(),
    crmDb.prepare(`SELECT phone FROM reentry_customers WHERE phone IS NOT NULL AND TRIM(phone) != ''`).all(),
  ]);

  const crmSet = new Set();
  for (const row of customers?.results || []) {
    const digits = normalizePhoneDigits(row?.phone);
    if (digits) crmSet.add(digits);
  }
  for (const row of reentry?.results || []) {
    const digits = normalizePhoneDigits(row?.phone);
    if (digits) crmSet.add(digits);
  }

  for (const digits of unique) {
    if (crmSet.has(digits)) found.add(digits);
  }

  return found;
}

/**
 * 후보 문의 중 CRM에 없는 것만 반환.
 * 상태 UPDATE는 하지 않음(목록 조회 타임아웃 방지). alreadyRows는 보정용.
 */
export async function filterMissingFromCrm(crmDb, rows, getPhone) {
  if (!Array.isArray(rows) || !rows.length) {
    return { missing: [], alreadyRows: [] };
  }

  const phones = rows.map((row) => normalizePhoneDigits(getPhone(row)));
  const existing = await findExistingCrmPhoneDigits(crmDb, phones);
  const missing = [];
  const alreadyRows = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const digits = phones[i];
    if (digits && existing.has(digits)) {
      alreadyRows.push(row);
      continue;
    }
    missing.push(row);
  }

  return { missing, alreadyRows };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPhoneRow(db, table, phoneDigits, extraWhere = '') {
  const idColumn = table === 'customers' ? 'm_idx' : 'id';

  return db
    .prepare(`
      SELECT ${idColumn} AS row_id
      FROM ${table}
      WHERE ${normalizedPhoneSql('phone')} = ?
        ${extraWhere ? `AND ${extraWhere}` : ''}
      LIMIT 1
    `)
    .bind(phoneDigits)
    .first();
}

/**
 * CRM DB는 읽기만 한다. 쓰기(고객 등록·재진입 이동)는 반드시 CRM API로 보내야
 * CRM 쪽 규칙(상담 이력 보존, 하드 삭제 금지, 중복 방지, 이력 로그)이 적용된다.
 */
export async function getCrmPhoneStatus(crmDb, phoneDigits) {
  if (!crmDb || !phoneDigits) {
    return { status: 'new' };
  }

  if (await findPhoneRow(crmDb, 'blacklist_customers', phoneDigits, "COALESCE(DEL_YN, 'N') != 'Y'")) {
    return { status: 'blacklisted' };
  }

  if (await findPhoneRow(crmDb, 'customers', phoneDigits)) {
    return { status: 'reentry', reason: 'customers' };
  }

  if (await findPhoneRow(crmDb, 'reentry_customers', phoneDigits, "COALESCE(DEL_YN, 'N') != 'Y'")) {
    return { status: 'reentry', reason: 'reentry' };
  }

  return { status: 'new' };
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
  const url = String(env?.CRM_REENTRY_INGEST_URL || DEFAULT_REENTRY_INGEST_URL).trim();
  return postCrmIngest(env, url, payload);
}

export async function sendCustomerIngest(env, payload) {
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
