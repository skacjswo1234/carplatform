// Cloudflare Pages Functions - 통계 조회
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const db = env['carplatform-db'];

    // 전체 통계 조회
    const totalResult = await db.prepare(`
      SELECT COUNT(*) as count FROM inquiries
    `).first();

    const newResult = await db.prepare(`
      SELECT COUNT(*) as count FROM inquiries WHERE status = 'new' OR status IS NULL
    `).first();

    const processingResult = await db.prepare(`
      SELECT COUNT(*) as count FROM inquiries WHERE status = 'processing'
    `).first();

    const completedResult = await db.prepare(`
      SELECT COUNT(*) as count FROM inquiries WHERE status = 'completed'
    `).first();

    // 소속 구분별 통계
    const affiliationStats = await db.prepare(`
      SELECT wr_7 as affiliation, COUNT(*) as count
      FROM inquiries
      WHERE wr_7 IS NOT NULL
      GROUP BY wr_7
    `).all();

    // 차량 유형별 통계
    const vehicleTypeStats = await db.prepare(`
      SELECT wr_3 as vehicle_type, COUNT(*) as count
      FROM inquiries
      WHERE wr_3 IS NOT NULL
      GROUP BY wr_3
    `).all();

    return new Response(JSON.stringify({
      success: true,
      total: totalResult?.count || 0,
      new: newResult?.count || 0,
      processing: processingResult?.count || 0,
      completed: completedResult?.count || 0,
      affiliation: affiliationStats.results || [],
      vehicleType: vehicleTypeStats.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '통계 데이터를 불러오는데 실패했습니다.'
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
