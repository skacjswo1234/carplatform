// Cloudflare Pages Functions - 이미지 업로드 API (R2 사용)

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    // R2 버킷 확인
    if (!env.REVIEWS_BUCKET) {
      return new Response(JSON.stringify({
        success: false,
        error: 'R2 버킷이 설정되지 않았습니다.'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({
        success: false,
        error: '이미지 파일이 필요합니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({
        success: false,
        error: '이미지 크기는 5MB 이하여야 합니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      return new Response(JSON.stringify({
        success: false,
        error: '이미지 파일만 업로드 가능합니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 고유한 파일명 생성
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `reviews/${timestamp}-${randomString}.${fileExtension}`;

    // R2에 파일 업로드
    const arrayBuffer = await file.arrayBuffer();
    await env.REVIEWS_BUCKET.put(fileName, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // R2 Public URL 생성
    // 환경변수에서 R2_PUBLIC_URL을 가져오거나, 기본 R2 Public URL 사용
    // R2_PUBLIC_URL 예시: https://pub-xxxxx.r2.dev 또는 https://r2.yourdomain.com
    const r2PublicUrl = env.R2_PUBLIC_URL || 'https://pub-xxxxx.r2.dev'; // 실제 Public URL로 변경 필요
    
    // R2 Public URL이 설정되지 않은 경우 Base64 사용 (폴백)
    let imageUrl;
    if (r2PublicUrl && !r2PublicUrl.includes('xxxxx')) {
      // R2 Public URL 사용
      imageUrl = `${r2PublicUrl}/${fileName}`;
    } else {
      // Base64 폴백 (R2 Public URL이 설정되지 않은 경우)
      const base64 = await arrayBufferToBase64(arrayBuffer);
      imageUrl = `data:${file.type};base64,${base64}`;
    }

    return new Response(JSON.stringify({
      success: true,
      url: imageUrl,
      fileName: fileName,
      storage: r2PublicUrl && !r2PublicUrl.includes('xxxxx') ? 'r2' : 'base64'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '이미지 업로드에 실패했습니다.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// ArrayBuffer를 Base64로 변환 (임시)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
