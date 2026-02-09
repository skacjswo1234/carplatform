// IP 기반 제한 체크 API

// 한국 시간대(KST, UTC+9)로 현재 시간 생성
function getKSTDateTime() {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kstTime = new Date(utcTime + (9 * 60 * 60 * 1000));
  const year = kstTime.getFullYear();
  const month = String(kstTime.getMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getDate()).padStart(2, '0');
  const hours = String(kstTime.getHours()).padStart(2, '0');
  const minutes = String(kstTime.getMinutes()).padStart(2, '0');
  const seconds = String(kstTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

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

// IP 기반 제한 체크 (24시간 내 2회 제한)
async function checkIPLimit(db, ipAddress) {
  try {
    // 해당 IP의 최근 24시간 내 문의 기록 조회
    const limitRecord = await db.prepare(`
      SELECT * FROM inquiry_limits 
      WHERE ip_address = ? 
      AND datetime(last_inquiry_at) > datetime('now', '-24 hours', '+9 hours')
      ORDER BY last_inquiry_at DESC
      LIMIT 1
    `).bind(ipAddress).first();
    
    if (!limitRecord) {
      // 첫 문의이거나 24시간이 지난 경우
      return { allowed: true, count: 0 };
    }
    
    // 24시간 내 문의 횟수 확인
    if (limitRecord.inquiry_count >= 2) {
      // 마지막 문의 시간 계산
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
    
    return { allowed: true, count: limitRecord.inquiry_count || 0 };
  } catch (error) {
    console.error('IP 제한 체크 오류:', error);
    // 오류 발생 시 허용 (서버 오류로 인한 정상 사용자 차단 방지)
    return { allowed: true, count: 0 };
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
    const limitCheck = await checkIPLimit(db, ip);

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
