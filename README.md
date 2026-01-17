# 카플랫폼 관리자 페이지

## 개요
카플랫폼 견적 신청 관리자 페이지입니다. Step 5까지의 문의 데이터를 조회하고 관리할 수 있습니다.

## 기능
- 문의 리스트 조회 및 필터링
- 문의 상태 관리 (신규/처리중/완료)
- 통계 대시보드
- 다크모드 디자인
- 반응형 디자인 (PC/모바일)

## 파일 구조
```
├── admin.html          # 관리자 페이지 HTML
├── admin.css           # 관리자 페이지 스타일
├── admin.js            # 관리자 페이지 JavaScript
├── functions/
│   └── api/
│       ├── inquiries.js        # 문의 목록 조회/등록 API
│       ├── inquiries/
│       │   └── [id].js         # 문의 상태 업데이트 API
│       └── statistics.js       # 통계 조회 API
├── schema.sql          # 데이터베이스 스키마
├── wrangler.toml       # Cloudflare Pages 설정
└── script.js           # 메인 폼 JavaScript (데이터 저장 로직 포함)
```

## 설정

### 1. 데이터베이스 테이블 생성
Cloudflare D1 데이터베이스에 테이블을 생성합니다:

```bash
npx wrangler d1 execute carplatform-db --file=schema.sql
```

### 2. 환경 변수 설정
`wrangler.toml` 파일에서 데이터베이스 정보를 확인하세요:
- `database_name`: carplatform-db
- `database_id`: 459f61d7-bf8b-4b0a-8cc2-505ece4fb8b3
- `binding`: carplatform-db (코드에서는 `env['carplatform-db']`로 접근)

### 3. 로컬 개발 서버 실행
```bash
npx wrangler pages dev
```

### 4. 배포
Cloudflare Pages로 배포:
- GitHub 연동 또는 CLI로 배포
```bash
npx wrangler pages deploy .
```

또는 Cloudflare Dashboard에서 Pages 프로젝트 생성 후 GitHub 리포지토리 연결

## API 엔드포인트

### 문의 목록 조회
```
GET /api/inquiries
```

### 새 문의 등록
```
POST /api/inquiries
Content-Type: application/json

{
  "name": "홍길동",
  "phone": "01012345678",
  "affiliation": "개인",
  "vehicle_type": "장기렌트",
  "car_name": "쏘렌토"
}
```

### 문의 상태 업데이트
```
PATCH /api/inquiries/:id
Content-Type: application/json

{
  "status": "processing" // new, processing, completed
}
```

### 통계 조회
```
GET /api/statistics
```

## 사용 방법

1. `admin.html` 파일을 브라우저에서 열거나 Cloudflare Pages에 배포
2. 문의 리스트 페이지에서 신청된 문의 확인
3. 상태 필터로 문의 필터링
4. 검색으로 특정 문의 찾기
5. 상세 버튼으로 문의 상세 정보 확인 및 상태 변경

## 모바일 메뉴
- 오른쪽 상단 햄버거 메뉴 아이콘 클릭
- 오른쪽에서 왼쪽으로 슬라이드되는 사이드바 표시
- 메뉴 외부 클릭 또는 아이콘 다시 클릭으로 닫기

## 디자인
- 다크모드 테마
- logo.png 이미지 활용
- Paperlogy 폰트 사용
- PC: 왼쪽 사이드바 + 오른쪽 콘텐츠
- 모바일: 오른쪽 상단 메뉴 버튼 + 슬라이드 메뉴
