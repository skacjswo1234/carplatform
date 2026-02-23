-- 후기 이미지 여러 장(최대 5장) 저장용 컬럼 추가
-- 카드 대표이미지 = images[0], 상세페이지에서 전부 표시
ALTER TABLE reviews ADD COLUMN images TEXT;
