// Cloudflare Pages Functions - 문의 상태 업데이트
export async function onRequestPatch(context) {
  const { env, request, params } = context;
  
  try {
    const { id } = params;
    const body = await request.json();
    const { status, memo } = body;

    if (status && !['new', 'processing', 'completed'].includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: '유효하지 않은 상태 값입니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];

    let result;
    if (status !== undefined && memo !== undefined) {
      // 상태와 메모 모두 업데이트
      result = await db.prepare(`
        UPDATE inquiries
        SET status = ?, memo = ?
        WHERE id = ?
      `).bind(status, memo || null, id).run();
    } else if (status !== undefined) {
      // 상태만 업데이트
      result = await db.prepare(`
        UPDATE inquiries
        SET status = ?
        WHERE id = ?
      `).bind(status, id).run();
    } else if (memo !== undefined) {
      // 메모만 업데이트
      result = await db.prepare(`
        UPDATE inquiries
        SET memo = ?
        WHERE id = ?
      `).bind(memo || null, id).run();
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '업데이트할 데이터가 없습니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        message: '정보가 업데이트되었습니다.'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      throw new Error('업데이트 실패');
    }
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '정보 업데이트에 실패했습니다.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// 문의 삭제
export async function onRequestDelete(context) {
  const { env, params } = context;
  
  try {
    const { id } = params;

    const db = env['carplatform-db'];

    const result = await db.prepare(`
      DELETE FROM inquiries
      WHERE id = ?
    `).bind(id).run();

    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        message: '문의가 삭제되었습니다.'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      throw new Error('삭제 실패');
    }
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '문의 삭제에 실패했습니다.'
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
      'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
