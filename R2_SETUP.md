# R2 버킷 설정 가이드

## 1. R2 버킷 생성

1. Cloudflare 대시보드 접속
2. 왼쪽 메뉴에서 **R2** 클릭
3. **Create bucket** 버튼 클릭
4. 버킷 이름: `carplatform-bucket` (현재 프로젝트에서 사용 중)
5. **Create bucket** 클릭

## 2. R2 Public URL 설정 (필수 – 이미지 노출용)

고객후기 이미지가 사이트에 보이려면 **Public Access를 켜야** 합니다.

### 방법 A: R2 Public URL 사용 (간단)

1. 생성한 버킷(`carplatform-bucket`) 클릭
2. **Settings** 탭 클릭
3. **Public access** 섹션에서 **Allow Access** 활성화
4. **Public URL** 확인 (예: `https://pub-xxxxx.r2.dev`)
5. 이 URL을 복사해서 알려주세요

### 방법 B: Custom Domain 설정 (선택사항)

1. 버킷 → **Settings** → **Custom Domains**
2. **Add domain** 클릭
3. 도메인 입력 (예: `r2.carplatform.shop`)
4. DNS 설정 안내에 따라 CNAME 레코드 추가

## 3. 환경변수 설정 (선택사항)

Cloudflare Pages에서 환경변수로 R2 Public URL 설정:

1. Cloudflare 대시보드 → **Pages** → 프로젝트 선택
2. **Settings** → **Environment Variables**
3. **Add variable** 클릭
4. Variable name: `R2_PUBLIC_URL`
5. Value: R2 Public URL (예: `https://pub-xxxxx.r2.dev`)
6. **Save** 클릭

## 4. 확인 사항

R2 버킷 생성 후 알려주실 정보:

- [ ] 버킷 이름: `carplatform-bucket` (생성 완료)
- [ ] R2 Public URL: `https://pub-xxxxx.r2.dev` (있다면)
- [ ] Custom Domain: `https://r2.yourdomain.com` (있다면)

## 5. 테스트

버킷 생성 후 관리자 페이지에서 고객후기 이미지를 업로드해보세요.

- R2 Public URL이 설정되어 있으면 → R2에 저장
- R2 Public URL이 없으면 → Base64로 DB에 저장 (자동 폴백)
