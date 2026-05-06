// SQL 인젝션 방지 함수
function sanitizeInput(value) {
  if (!value || typeof value !== 'string') return value;
  
  // SQL 인젝션 키워드 검사 (대소문자 무시)
  const sqlKeywords = /\b(SELECT|AND|SLEEP|UNION|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT)\b/gi;
  
  // 특수문자 검사 (SQL 인젝션에 사용되는 문자들)
  const dangerousChars = /["'\\;<>]/g;
  
  if (sqlKeywords.test(value) || dangerousChars.test(value)) {
    return null; // 위험한 입력 감지
  }
  
  return value.trim();
}

const BANNED_WORDS = [
  '씨발', '시발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', 'ㅅㅍ', 'ㅆㅍ',
  '좆', '좃', '존나', '졸라', '병신', '븅신',
  '개새끼', '개새', '개년', '개놈', '개자식', '개같', '개소리',
  '미친놈', '미친년', '미친새끼',
  '지랄', '닥쳐', '닥치', '꺼져', '꺼지', '죽어', '죽일',
  '느금', '니미', '느그', '애미', '애비', '애미년', '엿먹',
  '병맛', '엿같', '좆같', '꼴리',
  '십새', '18넘', '18년', '18놈', '18녀',
  'fuck', 'shit', 'bitch', 'asshole', 'damn', 'porn', 'sex',
  '섹스', '야동', '포르노',
  '보지', '자지', '걸레', '창녀', '창남', '음란',
  '자위', '딸딸', '오피', '유흥',
  '강간', '성폭', 'rape',
];

function normalizeForBan(text) {
  if (!text) return '';
  return String(text).replace(/[\s\u200b\uFEFF·]+/g, '');
}

function hasBannedWord(text) {
  if (!text) return false;
  const raw = String(text);
  const flat = normalizeForBan(raw);
  return BANNED_WORDS.some((w) => {
    if (/^[a-zA-Z]+$/.test(w)) {
      try {
        const re = new RegExp(`\\b${w}\\b`, 'i');
        return re.test(raw) || re.test(flat);
      } catch (e) {
        return raw.toLowerCase().includes(w.toLowerCase());
      }
    }
    return raw.includes(w) || flat.includes(w);
  });
}

function isJamoOnly(text) {
  return /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(text);
}

function isPlaceholderCarName(text) {
  if (!text) return false;
  const trimmed = String(text).trim().toLowerCase();
  if (/^(test|tester|sample|temp|none|null|na|n\/a)$/.test(trimmed)) return true;
  if (/^(.)\1{1,}$/.test(trimmed)) return true;
  if (/^[a-z]{2}$/.test(trimmed)) return true;
  return false;
}

function textHasBlockedDigitRuns(s) {
  if (!s) return false;
  if (/(\d)\1{5,}/.test(s)) return true;
  for (let i = 0; i <= s.length - 6; i++) {
    const slice = s.slice(i, i + 6);
    if (!/^\d{6}$/.test(slice)) continue;
    let asc = true;
    let desc = true;
    for (let j = 1; j < 6; j++) {
      const cur = slice.charCodeAt(j) - 48;
      const prev = slice.charCodeAt(j - 1) - 48;
      if (cur !== prev + 1) asc = false;
      if (cur !== prev - 1) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}

function isInvalidName(name) {
  const normalized = String(name || '').trim();
  if (!normalized || normalized.length < 2) return true;
  if (isJamoOnly(normalized)) return true;
  if (textHasBlockedDigitRuns(normalized)) return true;
  return false;
}

function isInvalidCarNameText(text) {
  const normalized = String(text || '').trim();
  if (!normalized || normalized.length < 2) return true;
  if (isJamoOnly(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (textHasBlockedDigitRuns(normalized)) return true;
  if (isPlaceholderCarName(normalized)) return true;
  return false;
}

function isInvalidPhonePattern(digits) {
  if (!/^[0-9]{11}$/.test(digits)) return true;
  if (/^(\d)\1{10}$/.test(digits)) return true;
  if (/(\d)\1{7,}/.test(digits)) return true;
  for (let i = 0; i <= digits.length - 6; i++) {
    let asc = true;
    let desc = true;
    for (let j = 1; j < 6; j++) {
      const cur = digits.charCodeAt(i + j) - 48;
      const prev = digits.charCodeAt(i + j - 1) - 48;
      if (cur !== prev + 1) asc = false;
      if (cur !== prev - 1) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}

// IP 주소 가져오기 (Cloudflare의 CF-Connecting-IP 헤더 사용)
function getClientIP(request) {
  // Cloudflare의 실제 클라이언트 IP 헤더
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) return cfConnectingIP;
  
  // 대체 헤더들
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;
  
  return 'unknown';
}

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

// IP 기반 제한 체크 (한 IP당 24시간 내 1회 제한)
async function checkIPLimit(db, ipAddress) {
  try {
    // 24시간 이전의 레코드는 무시
    const kstDateTime = getKSTDateTime();
    
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
    
    // 24시간 내 문의 횟수 확인 (1회 이상이면 제한)
    if (limitRecord.inquiry_count >= 1) {
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

// IP 제한 기록 업데이트
async function updateIPLimit(db, ipAddress) {
  try {
    const kstDateTime = getKSTDateTime();
    
    // 기존 레코드 확인
    const existing = await db.prepare(`
      SELECT * FROM inquiry_limits 
      WHERE ip_address = ? 
      AND datetime(last_inquiry_at) > datetime('now', '-24 hours', '+9 hours')
      ORDER BY last_inquiry_at DESC
      LIMIT 1
    `).bind(ipAddress).first();
    
    if (existing) {
      // 기존 레코드 업데이트 (카운트 증가)
      await db.prepare(`
        UPDATE inquiry_limits 
        SET inquiry_count = inquiry_count + 1,
            last_inquiry_at = ?
        WHERE id = ?
      `).bind(kstDateTime, existing.id).run();
    } else {
      // 새 레코드 생성
      await db.prepare(`
        INSERT INTO inquiry_limits (ip_address, inquiry_count, first_inquiry_at, last_inquiry_at)
        VALUES (?, 1, ?, ?)
      `).bind(ipAddress, kstDateTime, kstDateTime).run();
    }
    
    // 24시간이 지난 오래된 레코드 삭제 (정리)
    await db.prepare(`
      DELETE FROM inquiry_limits 
      WHERE datetime(last_inquiry_at) <= datetime('now', '-24 hours', '+9 hours')
    `).run();
  } catch (error) {
    console.error('IP 제한 업데이트 오류:', error);
    // 오류 발생해도 계속 진행
  }
}

// Cloudflare Pages Functions - 문의 목록 조회 및 등록
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    const db = env['carplatform-db'];

    const result = await db.prepare(`
      SELECT 
        id,
        wr_name as name,
        wr_subject as phone,
        wr_7 as affiliation,
        wr_3 as vehicle_type,
        wr_4 as car_name,
        status,
        memo,
        created_at
      FROM inquiries
      ORDER BY created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      inquiries: result.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '데이터를 불러오는데 실패했습니다.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    let { name, phone, affiliation, vehicle_type, car_name, ip } = body;

    // IP 주소 가져오기
    if (!ip || ip === 'unknown') {
      ip = getClientIP(request);
    }

    // SQL 인젝션 검증
    const sanitizedName = sanitizeInput(name);
    const sanitizedCarName = car_name ? sanitizeInput(car_name) : null;

    let sanitizedAffiliation = null;
    if (affiliation != null && String(affiliation).trim() !== '') {
      const a = sanitizeInput(String(affiliation).trim());
      if (a === null) {
        return new Response(JSON.stringify({
          success: false,
          error: '입력하신 내용에 허용되지 않은 문자가 포함되어 있습니다.'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      sanitizedAffiliation = a;
    }

    let sanitizedVehicleType = null;
    if (vehicle_type != null && String(vehicle_type).trim() !== '') {
      const v = sanitizeInput(String(vehicle_type).trim());
      if (v === null) {
        return new Response(JSON.stringify({
          success: false,
          error: '입력하신 내용에 허용되지 않은 문자가 포함되어 있습니다.'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      sanitizedVehicleType = v;
    }
    
    if (sanitizedName === null || sanitizedCarName === null) {
      return new Response(JSON.stringify({
        success: false,
        error: '입력하신 내용에 허용되지 않은 문자가 포함되어 있습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!sanitizedName || !phone) {
      return new Response(JSON.stringify({
        success: false,
        error: '성함과 연락처는 필수입니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!sanitizedCarName) {
      return new Response(JSON.stringify({
        success: false,
        error: '차종을 입력해주세요.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (isInvalidName(sanitizedName)) {
      return new Response(JSON.stringify({
        success: false,
        error: '성함은 2글자 이상 정확히 입력해주세요. (자음/모음만·연속숫자 불가)'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (hasBannedWord(sanitizedName)) {
      return new Response(JSON.stringify({
        success: false,
        error: '성함에 부적절한 단어가 포함되어 있습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (isInvalidCarNameText(sanitizedCarName)) {
      return new Response(JSON.stringify({
        success: false,
        error: '차종을 정확히 입력해주세요. (자음/모음만·숫자만·연속숫자 불가)'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (hasBannedWord(sanitizedCarName)) {
      return new Response(JSON.stringify({
        success: false,
        error: '차종에 부적절한 단어가 포함되어 있습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (sanitizedAffiliation && hasBannedWord(sanitizedAffiliation)) {
      return new Response(JSON.stringify({
        success: false,
        error: '입력값에 부적절한 단어가 포함되어 있습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (sanitizedVehicleType && hasBannedWord(sanitizedVehicleType)) {
      return new Response(JSON.stringify({
        success: false,
        error: '입력값에 부적절한 단어가 포함되어 있습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 전화번호 숫자만 허용 검증
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    if (!/^[0-9]{11}$/.test(phoneNumber)) {
      return new Response(JSON.stringify({
        success: false,
        error: '올바른 연락처를 입력해주세요. (숫자만 입력, 11자리)'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (isInvalidPhonePattern(phoneNumber)) {
      return new Response(JSON.stringify({
        success: false,
        error: '연락처에 동일·연속 숫자만 있는 번호는 사용할 수 없습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];

    // IP 기반 제한 체크
    const limitCheck = await checkIPLimit(db, ip);
    if (!limitCheck.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: '문의가 이미 접수되었습니다. 24시간 후 다시 시도해주세요.'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const kstDateTime = getKSTDateTime();

    // 데이터 저장 (Prepared Statement 사용으로 SQL 인젝션 방지)
    const result = await db.prepare(`
      INSERT INTO inquiries (wr_name, wr_subject, wr_7, wr_3, wr_4, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'new', ?)
    `).bind(sanitizedName, phoneNumber, sanitizedAffiliation, sanitizedVehicleType, sanitizedCarName || null, kstDateTime).run();

    if (result.success) {
      // IP 제한 기록 업데이트
      await updateIPLimit(db, ip);
      
      const inquiryId = result.meta.last_row_id;
      return new Response(JSON.stringify({
        success: true,
        id: inquiryId
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      throw new Error('데이터 저장 실패');
    }
  } catch (error) {
    console.error('Error saving inquiry:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '데이터 저장에 실패했습니다.'
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
