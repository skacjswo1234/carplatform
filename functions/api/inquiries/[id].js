// Cloudflare Pages Functions - 문의 상태 업데이트
export async function onRequestPatch(context) {
  const { env, request, params } = context;
  
  try {
    const { id } = params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['new', 'processing', 'completed'].includes(status)) {
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

    const result = await db.prepare(`
      UPDATE inquiries
      SET status = ?
      WHERE id = ?
    `).bind(status, id).run();

    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        message: '상태가 업데이트되었습니다.'
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
      error: '상태 업데이트에 실패했습니다.'
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
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
