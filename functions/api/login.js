// Cloudflare Pages Functions - 로그인 (단순 비밀번호 비교)
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return new Response(JSON.stringify({
        success: false,
        error: '비밀번호를 입력해주세요.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const db = env['carplatform-db'];

    // 관리자 비밀번호 조회
    const result = await db.prepare(`
      SELECT password FROM admin_password LIMIT 1
    `).first();

    // 비밀번호 비교 (단순 비교)
    if (result && result.password === password) {
      return new Response(JSON.stringify({
        success: true,
        message: '로그인 성공'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '비밀번호가 올바르지 않습니다.'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    console.error('Error during login:', error);
    
    // 테이블이 없는 경우 초기 비밀번호 생성
    if (error.message && error.message.includes('no such table')) {
      const db = env['carplatform-db'];
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS admin_password (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        
        // 초기 비밀번호를 'admin123'으로 설정
        await db.prepare(`
          INSERT INTO admin_password (password) VALUES ('admin123')
        `).run();
        
        // 초기 비밀번호로 로그인 시도 (이미 파싱한 body 사용)
        if (password === 'admin123') {
          return new Response(JSON.stringify({
            success: true,
            message: '로그인 성공'
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch (createError) {
        console.error('Error creating password table:', createError);
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: '로그인 중 오류가 발생했습니다.'
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
