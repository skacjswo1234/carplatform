/** IP 영구 차단 + 문의 IP (D1) */

export function getClientIP(request) {
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) return cfConnectingIP;

  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;

  return 'unknown';
}

export async function ensureBlockedIpsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL UNIQUE,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    await db.prepare(`ALTER TABLE inquiries ADD COLUMN client_ip TEXT`).run();
  } catch (_) {
    /* column already exists */
  }
}

export async function isIpBlocked(db, ip) {
  if (!ip || ip === 'unknown') return false;
  try {
    await ensureBlockedIpsTable(db);
    const row = await db.prepare(
      `SELECT 1 FROM blocked_ips WHERE ip_address = ? LIMIT 1`
    ).bind(String(ip).trim()).first();
    return !!row;
  } catch (e) {
    console.error('isIpBlocked error:', e);
    return false;
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function corsOptions(methods) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
