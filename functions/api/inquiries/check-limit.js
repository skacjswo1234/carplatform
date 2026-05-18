// IP 기반 제한 체크 API
import { isIpBlocked, ensureBlockedIpsTable } from '../../lib/ip-block.js';

// IP 주소 가져오기
function getClientIP(request) {
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

const LIMIT_TTL_SECONDS = 24 * 60 * 60;

function ipKey(ip) {
  return `inquiry_ip:${ip}`;
}

async function checkIPLimitKV(kv, ipAddress) {
  try {
    const key = ipKey(ipAddress);
    const raw = await kv.get(key);
    if (!raw) return { allowed: true, count: 0, hoursRemaining: null };

    // raw는 { ts: number } 형태를 기대하지만, 문자열이든 뭐든 안전하게 처리
    let ts = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.ts === 'number') ts = parsed.ts;
    } catch (_) {}

    if (ts == null) {
      // 값이 있는데 파싱이 안 되면, 안전하게 제한(=허용 안 함)
      return { allowed: false, count: 1, hoursRemaining: 24 };
    }

    const ageSec = Math.floor((Date.now() - ts) / 1000);
    const remainingSec = Math.max(0, LIMIT_TTL_SECONDS - ageSec);
    const hoursRemaining = remainingSec > 0 ? Math.ceil(remainingSec / 3600) : 0;

    if (remainingSec > 0) {
      return { allowed: false, count: 1, hoursRemaining };
    }

    // TTL이 지났는데도 값이 남아있는 경우(드물지만), 허용 처리
    return { allowed: true, count: 0, hoursRemaining: null };
  } catch (error) {
    console.error('KV IP 제한 체크 오류:', error);
    return { allowed: true, count: 0, hoursRemaining: null };
  }
}

// (폴백) D1 기반 제한 체크 (한 IP당 24시간 내 1회 제한)
async function checkIPLimitD1(db, ipAddress) {
  try {
    const limitRecord = await db.prepare(`
      SELECT * FROM inquiry_limits 
      WHERE ip_address = ? 
      AND datetime(last_inquiry_at) > datetime('now', '-24 hours', '+9 hours')
      ORDER BY last_inquiry_at DESC
      LIMIT 1
    `).bind(ipAddress).first();
    
    if (!limitRecord) return { allowed: true, count: 0, hoursRemaining: null };
    
    if (limitRecord.inquiry_count >= 1) {
      const lastInquiry = new Date(limitRecord.last_inquiry_at);
      const now = new Date();
      const hoursSinceLastInquiry = (now - lastInquiry) / (1000 * 60 * 60);
      
      if (hoursSinceLastInquiry < 24) {
        return { 
          allowed: false, 
          count: limitRecord.inquiry_count,
          hoursRemaining: Math.ceil(24 - hoursSinceLastInquiry)
        };
      }
    }
    
    return { allowed: true, count: limitRecord.inquiry_count || 0, hoursRemaining: null };
  } catch (error) {
    console.error('D1 IP 제한 체크 오류:', error);
    return { allowed: true, count: 0, hoursRemaining: null };
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    let { ip } = body;

    // IP 주소 가져오기
    if (!ip || ip === 'unknown') {
      ip = getClientIP(request);
    }

    if (!ip || ip === 'unknown') {
      return new Response(JSON.stringify({
        success: false,
        error: 'IP 주소를 확인할 수 없습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];
    await ensureBlockedIpsTable(db);
    if (await isIpBlocked(db, ip)) {
      return new Response(JSON.stringify({
        success: true,
        allowed: false,
        blocked: true,
        error: 'IP_BLOCKED',
        message: '문의 접수가 제한된 연결입니다.',
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    let limitCheck;
    if (env && env.INQUIRY_LIMITS_KV) {
      limitCheck = await checkIPLimitKV(env.INQUIRY_LIMITS_KV, ip);
    } else {
      limitCheck = await checkIPLimitD1(db, ip);
    }

    return new Response(JSON.stringify({
      success: true,
      allowed: limitCheck.allowed,
      count: limitCheck.count,
      hoursRemaining: limitCheck.hoursRemaining || null
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error checking IP limit:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '제한 체크에 실패했습니다.',
      allowed: true // 오류 시 허용
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
