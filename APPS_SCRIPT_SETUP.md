# Google Apps Script로 문의 이메일 받기

문의신청이 완료되면 **andukgi@gmail.com**으로 문의 내용을 이메일로 보내도록, Google Apps Script 웹앱을 사용합니다.

---

## 1. 준비할 것

- **Google 계정** (andukgi@gmail.com 권장 – 이 계정으로 메일을 받고, 웹앱도 이 계정으로 배포하면 Gmail 발송이 간단합니다)
- **(선택)** 문의를 **구글시트**에 기록하려면: 빈 스프레드시트 하나

---

## 2. Apps Script 프로젝트 만들기

1. **https://script.google.com** 접속 후 로그인
2. **새 프로젝트** 클릭
3. `Code.gs` 내용을 **전부 삭제**한 뒤,  
   프로젝트 안의 `google-apps-script/InquiryNotify.gs` 파일 내용을 **그대로 복사해 붙여넣기**
4. **(선택) 구글시트에 기록하려면**
   - `InquiryNotify.gs` 상단의 `SHEET_ID` 수정
   - 구글시트 URL:  
     `https://docs.google.com/spreadsheets/d/여기ID값/edit`  
     → `여기ID값`만 복사해서 `SHEET_ID = '여기ID값'` 처럼 넣기
5. **받는 이메일 변경**이 필요하면 상단 `RECIPIENT_EMAIL` 수정 (기본: `andukgi@gmail.com`)
6. **Ctrl+S** (또는 파일 → 저장)로 저장

---

## 3. 웹앱으로 배포

1. 오른쪽 상단 **배포** → **새 배포**
2. 종류에서 **웹 앱** 선택
3. 설정:
   - **설명**: `문의 알림` 등 원하는 이름
   - **다음 사용자로 실행**: **나**
   - **액세스 권한**: **모든 사용자** (또는 “앱에 액세스할 수 있는 사용자: 모든 사용자”)
4. **배포** 클릭
5. **웹 앱 URL**이 나옵니다.  
   예:  
   `https://script.google.com/macros/s/AKfycbx.../exec`  
   이 주소를 **복사**해 두세요.

(처음 배포 시 “권한 검토”가 뜨면, andukgi@gmail.com 계정으로 **권한 허용**을 눌러주세요.)

---

## 4. 웹앱 URL을 프론트에 넣기

카플랫폼은 **브라우저에서 Apps Script 웹앱을 직접 호출**합니다.  
`script.js` 상단의 `APPS_SCRIPT_WEB_APP_URL` 값을 **배포된 웹앱 URL**로 맞춰 주세요.

예:
```
https://script.google.com/macros/s/AKfycbx.../exec
```

---

## 5. 동작 방식

- 문의 신청 **완료** 시:
  1. 기존처럼 **D1 DB**에 문의 저장
  2. 브라우저에서 **Google Apps Script 웹앱**으로 문의 데이터를 POST 전송
  3. Apps Script에서:
     - **andukgi@gmail.com** (또는 `RECIPIENT_EMAIL`)으로 **문의 양식 이메일** 발송
     - `SHEET_ID`를 설정했다면 **구글시트** 첫 시트에 한 줄 추가

---

## 6. 이메일 양식 예시

| 항목     | 내용 예시        |
|----------|------------------|
| 접수번호 | 1                |
| 접수일시 | 2025-01-25 14:30:00 |
| 성함     | 홍길동           |
| 연락처   | 010-1234-5678    |
| 소속     | 개인             |
| 차량 유형 | 장기렌트         |
| 차량명   | 쏘렌토           |

위 항목이 테이블 형태의 HTML 메일로 전달됩니다.

---

## 7. 문제 해결

- **이메일이 안 옴**
  - Apps Script 배포 시 **“나”로 실행**, **“모든 사용자”** 액세스인지 확인
  - `script.js`의 `APPS_SCRIPT_WEB_APP_URL`이 `/exec`까지 포함한 **전체 URL**인지 확인
  - 브라우저 개발자도구 콘솔에서 오류 로그 확인
  - Apps Script **실행 로그**:  
    (편집기에서 **실행** → **실행 로그**) 에러 있는지 확인

- **시트에 안 쌓임**
  - `SHEET_ID`가 **정확한 스프레드시트 ID**인지 확인
  - 해당 스프레드시트를 **배포한 Google 계정**으로 열 수 있는지 확인

- **문의는 저장되는데 이메일만 실패**
  - 이메일 실패 시에도 **문의 저장은 유지**됩니다.  
  - 브라우저 콘솔에서 `Apps Script 전송 실패/오류` 로그 확인
