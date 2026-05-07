// Cloudflare Pages Functions - 문의 상태 업데이트
export async function onRequestPatch(context) {
  const { env, request, params } = context;
  
  try {
    const { id } = params;
    const body = await request.json();
    const { status, memo } = body;

    function normalizeForBan(text) {
      if (!text) return '';
      return String(text).replace(/[\s\u200b\uFEFF·]+/g, '');
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

    function memoHasBlockedPatterns(m) {
      const t = String(m || '').trim();
      if (!t) return false;
      if (/[ㄱ-ㅎㅏ-ㅣ]{2,}/.test(t)) return true; // 초성/자모 연속 입력 차단
      if (/(\d)\1{3,}/.test(t)) return true; // 동일숫자 4회 이상 반복

      const minLen = 4; // 4자리 연속 증가/감소도 차단
      for (let i = 0; i <= t.length - minLen; i++) {
        const slice = t.slice(i, i + minLen);
        if (!/^\d{4}$/.test(slice)) continue;
        let asc = true;
        let desc = true;
        for (let j = 1; j < minLen; j++) {
          const cur = slice.charCodeAt(j) - 48;
          const prev = slice.charCodeAt(j - 1) - 48;
          if (cur !== prev + 1) asc = false;
          if (cur !== prev - 1) desc = false;
        }
        if (asc || desc) return true;
      }

      if (hasBannedWord(t)) return true;
      return false;
    }

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

    if (memo !== undefined && memo !== null && String(memo).trim() !== '') {
      if (memoHasBlockedPatterns(memo)) {
        return new Response(JSON.stringify({
          success: false,
          error: '메모에 초성(자음/모음만) 또는 연속번호/부적절한 단어가 포함되어 저장할 수 없습니다.'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
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
