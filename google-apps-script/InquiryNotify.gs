/**
 * 카플랫폼 문의 알림 - Google Apps Script
 * 
 * 사용법: 이 코드를 https://script.google.com 에서 새 프로젝트에 붙여넣고
 * "웹 앱으로 배포" 후 나오는 URL을 Cloudflare Pages 환경 변수 APPS_SCRIPT_WEB_APP_URL 에 설정하세요.
 * 
 * 받는 이메일: andukgi@gmail.com
 * (변경하려면 아래 RECIPIENT_EMAIL 수정)
 */

// ========== 설정 (필요시 수정) ==========
const RECIPIENT_EMAIL = 'andukgi@gmail.com';

// 구글시트에 남기려면: 시트 URL의 /d/ 와 /edit 사이 ID를 넣으세요. 빈 문자열이면 시트 기록 안 함.
// 예: https://docs.google.com/spreadsheets/d/여기ID값/edit
const SHEET_ID = '1HA00ZW1Xgw0aSUk7XYF12E42lEpwE9nQgmOszPdlE9s';

// ========== 메인: POST 요청 처리 ==========
function doPost(e) {
  try {
    if (!e) {
      return jsonResponse({ success: false, error: 'doPost는 웹앱 호출로만 실행됩니다.' }, 400);
    }
    const json = parseRequestData(e);
    const { name, phone, affiliation, vehicle_type, car_name, created_at, id } = json;

    if (!name || !phone) {
      return jsonResponse({ success: false, error: '성함과 연락처는 필수입니다.' });
    }

    // 1) 이메일 발송
    sendInquiryEmail({
      name: name || '-',
      phone: formatPhone(phone || '-'),
      affiliation: affiliation || '-',
      vehicle_type: vehicle_type || '-',
      car_name: car_name || '-',
      created_at: created_at || getKstNow(),
      id: id || ''
    });

    // 2) (선택) 구글시트에 한 줄 추가
    if (SHEET_ID && SHEET_ID.trim()) {
      appendToSheet(SHEET_ID, [created_at || getKstNow(), name, phone, affiliation, vehicle_type, car_name]);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: String(err.message) }, 500);
  }
}

/** GET 요청 (배포 테스트용, 실제로는 POST만 사용) */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    message: '문의 알림 웹앱입니다. POST로 문의 데이터를 보내주세요.'
  })).setMimeType(ContentService.MimeType.JSON);
}

// 에디터에서 테스트용 (실제 서비스는 웹앱 POST로 호출)
function testDoPost() {
  const mock = {
    postData: {
      contents: JSON.stringify({
        name: '홍길동',
        phone: '01012345678',
        affiliation: '개인',
        vehicle_type: '장기렌트',
        car_name: '쏘렌토',
        created_at: getKstNow(),
        id: 'test'
      })
    }
  };
  return doPost(mock);
}

// ========== 이메일 발송 ==========
function sendInquiryEmail(data) {
  const subject = '[카플랫폼] 새 견적 문의 - ' + data.name + ' (' + data.phone + ')';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Malgun Gothic, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb;">카플랫폼 견적 문의가 접수되었습니다</h2>
  <table style="border-collapse: collapse; width: 100%; max-width: 480px;">
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold; width: 140px;">접수번호</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.id || '-')}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">접수일시</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.created_at)}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">성함</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.name)}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">연락처</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.phone)}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">소속</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.affiliation)}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">차량 유형</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.vehicle_type)}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">차량명</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.car_name)}</td></tr>
  </table>
  <p style="margin-top: 16px; font-size: 12px; color: #6b7280;">— 카플랫폼 견적 신청</p>
</body>
</html>`;

  GmailApp.sendEmail(RECIPIENT_EMAIL, subject, '텍스트 메일을 지원하지 않습니다. HTML 지원 클라이언트로 확인해 주세요.', {
    htmlBody: html,
    name: '카플랫폼 문의알림'
  });
}

// ========== 구글시트 추가 (선택) ==========
function appendToSheet(sheetId, row) {
  const ss = SpreadsheetApp.openById(sheetId.trim());
  const sh = ss.getSheets()[0];
  const lastRow = sh.getLastRow();

  // 첫 행이 비어 있으면 헤더 먼저 넣기
  if (lastRow === 0) {
    sh.getRange(1, 1, 1, 6).setValues([['접수일시', '성함', '연락처', '소속', '차량유형', '차량명']]);
    sh.getRange(2, 1, 2, 6).setValues([row]);
  } else {
    sh.getRange(lastRow + 1, 1, lastRow + 1, 6).setValues([row]);
  }
}

// ========== 유틸 ==========
function formatPhone(s) {
  if (!s || typeof s !== 'string') return '-';
  const n = s.replace(/\D/g, '');
  if (n.length === 11 && n.startsWith('010')) return n.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  return s;
}

function getKstNow() {
  const d = new Date();
  const kst = new Date(d.getTime() + (9 + d.getTimezoneOffset() / 60) * 60 * 60 * 1000);
  return Utilities.formatDate(kst, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseRequestData(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // JSON 파싱 실패 시 form 데이터로 처리
    }
  }

  const params = e.parameter || {};
  return normalizeParams(params);
}

function normalizeParams(params) {
  const data = {};
  Object.keys(params || {}).forEach(key => {
    const value = params[key];
    data[key] = Array.isArray(value) ? value[0] : value;
  });
  return data;
}

function jsonResponse(obj, status) {
  const code = status || 200;
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
