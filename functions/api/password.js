// Cloudflare Pages Functions - 비밀번호 변경
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];

    // 테이블이 없으면 생성
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS admin_password (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          password TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {
      // 테이블이 이미 존재하는 경우 무시
    }

    // 현재 비밀번호 확인
    const currentResult = await db.prepare(`
      SELECT password FROM admin_password LIMIT 1
    `).first();

    // 비밀번호가 없으면 초기 설정
    if (!currentResult) {
      await db.prepare(`
        INSERT INTO admin_password (password) VALUES (?)
      `).bind(newPassword).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: '비밀번호가 설정되었습니다.'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 현재 비밀번호 확인
    if (currentResult.password !== currentPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '현재 비밀번호가 올바르지 않습니다.'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 비밀번호 업데이트
    const updateResult = await db.prepare(`
      UPDATE admin_password 
      SET password = ?, updated_at = datetime('now', '+9 hours')
      WHERE id = (SELECT id FROM admin_password LIMIT 1)
    `).bind(newPassword).run();

    if (updateResult.success) {
      return new Response(JSON.stringify({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      throw new Error('비밀번호 업데이트 실패');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '비밀번호 변경 중 오류가 발생했습니다.'
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
