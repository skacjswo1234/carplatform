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
    const { name, phone, affiliation, vehicle_type, car_name } = body;

    if (!name || !phone) {
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

    const db = env['carplatform-db'];

    // 한국 시간대(KST, UTC+9)로 현재 시간 생성
    // 현재 UTC 시간에 9시간을 더한 후 ISO 형식으로 변환
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // UTC 시간
    const kstTime = new Date(utcTime + (9 * 60 * 60 * 1000)); // UTC+9
    // SQLite 호환 형식: YYYY-MM-DD HH:MM:SS
    const year = kstTime.getFullYear();
    const month = String(kstTime.getMonth() + 1).padStart(2, '0');
    const day = String(kstTime.getDate()).padStart(2, '0');
    const hours = String(kstTime.getHours()).padStart(2, '0');
    const minutes = String(kstTime.getMinutes()).padStart(2, '0');
    const seconds = String(kstTime.getSeconds()).padStart(2, '0');
    const kstDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const result = await db.prepare(`
      INSERT INTO inquiries (wr_name, wr_subject, wr_7, wr_3, wr_4, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'new', ?)
    `).bind(name, phone, affiliation || null, vehicle_type || null, car_name || null, kstDateTime).run();

    if (result.success) {
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
