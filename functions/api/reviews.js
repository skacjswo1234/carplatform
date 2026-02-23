// Cloudflare Pages Functions - 고객후기 관리 API

function normalizeReview(row) {
  let images = [];
  if (row.images != null) {
    try {
      images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
    } catch (_) {}
  }
  if (!Array.isArray(images)) images = [];
  if (images.length === 0 && row.image_url) images = [row.image_url];
  const imageUrl = row.image_url || (images[0]) || '';
  const { images: _im, ...rest } = row;
  return { ...rest, images, image_url: imageUrl };
}

// 고객후기 목록 조회 (단일: ?id= 숫자)
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    const db = env['carplatform-db'];
    const url = new URL(request.url);
    const singleId = url.searchParams.get('id');
    const activeOnly = url.searchParams.get('active') === 'true';

    const selectWithImages = `id, image_url, title, text_content, display_order, is_active, created_at, updated_at, images`;
    const selectWithoutImages = `id, image_url, title, text_content, display_order, is_active, created_at, updated_at`;

    let runQuery = async (fields) => {
      if (singleId) {
        const row = await db.prepare(`SELECT ${fields} FROM reviews WHERE id = ?`).bind(singleId).first();
        return row ? [normalizeReview(row)] : [];
      }
      let q = `SELECT ${fields} FROM reviews`;
      if (activeOnly) q += ' WHERE is_active = 1';
      q += ' ORDER BY display_order ASC, created_at DESC';
      const result = await db.prepare(q).all();
      return (result.results || []).map(normalizeReview);
    };

    let rows = [];
    try {
      rows = await runQuery(selectWithImages);
    } catch (e) {
      rows = await runQuery(selectWithoutImages);
    }

    if (singleId) {
      const review = rows[0] || null;
      return new Response(JSON.stringify({
        success: !!review,
        review: review
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const reviews = rows;

    return new Response(JSON.stringify({
      success: true,
      reviews: reviews
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
    let { id, image_url, title, text_content, display_order, is_active, images } = body;

    const imagesArr = Array.isArray(images) ? images.slice(0, 5) : [];
    const firstImage = imagesArr.length > 0 ? imagesArr[0] : image_url;
    if (!firstImage) {
      return new Response(JSON.stringify({
        success: false,
        error: '이미지는 1장 이상 필수입니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    const imageUrlToSave = firstImage;
    const imagesJson = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;

    const db = env['carplatform-db'];
    const kstDateTime = getKSTDateTime();

    if (id) {
      let result;
      try {
        result = await db.prepare(`
          UPDATE reviews 
          SET image_url = ?, title = ?, text_content = ?, display_order = ?, is_active = ?, images = ?, updated_at = ?
          WHERE id = ?
        `).bind(imageUrlToSave, title || null, text_content || null, display_order || 0, is_active ? 1 : 0, imagesJson, kstDateTime, id).run();
      } catch (_) {
        result = await db.prepare(`
          UPDATE reviews SET image_url = ?, title = ?, text_content = ?, display_order = ?, is_active = ?, updated_at = ? WHERE id = ?
        `).bind(imageUrlToSave, title || null, text_content || null, display_order || 0, is_active ? 1 : 0, kstDateTime, id).run();
      }
      if (result && result.success) {
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
      let result;
      try {
        result = await db.prepare(`
          INSERT INTO reviews (image_url, title, text_content, display_order, is_active, created_at, updated_at, images)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(imageUrlToSave, title || null, text_content || null, display_order || 0, is_active ? 1 : 0, kstDateTime, kstDateTime, imagesJson).run();
      } catch (_) {
        result = await db.prepare(`
          INSERT INTO reviews (image_url, title, text_content, display_order, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(imageUrlToSave, title || null, text_content || null, display_order || 0, is_active ? 1 : 0, kstDateTime, kstDateTime).run();
      }
      if (result && result.success) {
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
