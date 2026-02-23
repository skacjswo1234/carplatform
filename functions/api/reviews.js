// Cloudflare Pages Functions - 고객후기 관리 API

// 고객후기 목록 조회
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    const db = env['carplatform-db'];
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') === 'true';

    let query = `
      SELECT 
        id,
        image_url,
        title,
        text_content,
        display_order,
        is_active,
        created_at,
        updated_at
      FROM reviews
    `;
    
    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }
    
    query += ' ORDER BY display_order ASC, created_at DESC';

    const result = await db.prepare(query).all();

    return new Response(JSON.stringify({
      success: true,
      reviews: result.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
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

// 고객후기 추가/수정
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { id, image_url, title, text_content, display_order, is_active } = body;

    if (!image_url) {
      return new Response(JSON.stringify({
        success: false,
        error: '이미지는 필수입니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];
    const kstDateTime = getKSTDateTime();

    if (id) {
      // 수정
      const result = await db.prepare(`
        UPDATE reviews 
        SET image_url = ?, 
            title = ?,
            text_content = ?, 
            display_order = ?, 
            is_active = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(image_url, title || null, text_content || null, display_order || 0, is_active ? 1 : 0, kstDateTime, id).run();

      if (result.success) {
        return new Response(JSON.stringify({
          success: true,
          id: id
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } else {
      // 추가
      const result = await db.prepare(`
        INSERT INTO reviews (image_url, title, text_content, display_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(image_url, title || null, text_content || null, display_order || 0, is_active ? 1 : 0, kstDateTime, kstDateTime).run();

      if (result.success) {
        const reviewId = result.meta.last_row_id;
        return new Response(JSON.stringify({
          success: true,
          id: reviewId
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    throw new Error('데이터 저장 실패');
  } catch (error) {
    console.error('Error saving review:', error);
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

// 고객후기 삭제
export async function onRequestDelete(context) {
  const { env, request } = context;
  
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID가 필요합니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];
    const result = await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();

    if (result.success) {
      return new Response(JSON.stringify({
        success: true
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    throw new Error('삭제 실패');
  } catch (error) {
    console.error('Error deleting review:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '삭제에 실패했습니다.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
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

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
