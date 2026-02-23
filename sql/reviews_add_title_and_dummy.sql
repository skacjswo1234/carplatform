-- 1) 후기 타이틀 컬럼 추가 (관리자에서 이미지/후기타이틀/후기설명 사용)
ALTER TABLE reviews ADD COLUMN title TEXT;

-- 2) 더미 포토후기 30건 (디자인 확인용)
-- image_url은 실제 업로드 URL로 교체하거나, 관리자에서 이미지 등록 후 사용하세요.
INSERT INTO reviews (image_url, title, text_content, display_order, is_active, created_at, updated_at) VALUES
('https://placehold.co/400x300/e8e8e8/666?text=Review+1', '그랜저 구매 후기', '친절한 상담과 빠른 차량 인도에 만족합니다. 추천해요!', 0, 1, datetime('now', '-30 days'), datetime('now', '-30 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+2', '쏘나타 장기렌트 완료', '처음부터 끝까지 믿고 맡겼습니다. 다음에도 이용할게요.', 1, 1, datetime('now', '-29 days'), datetime('now', '-29 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+3', '아이오닉5 전기차 구매', '전기차 구매 조건이 좋아서 여기서 계약했어요. 만족합니다.', 2, 1, datetime('now', '-28 days'), datetime('now', '-28 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+4', '스포티지 신차 할부', '할부 금리도 괜찮고 상담도 꼼꼼해서 좋았어요.', 3, 1, datetime('now', '-27 days'), datetime('now', '-27 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+5', '카니발 9인승 리스', '가족용으로 카니발 구했어요. 조건 만족스럽습니다.', 4, 1, datetime('now', '-26 days'), datetime('now', '-26 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+6', '투싼 1.6T 구매 후기', '처음 구매인데 설명 잘 해주셔서 감사해요.', 5, 1, datetime('now', '-25 days'), datetime('now', '-25 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+7', 'K8 가솔린 구매', '디자인도 좋고 조건도 좋아서 여기서 구매했습니다.', 6, 1, datetime('now', '-24 days'), datetime('now', '-24 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+8', 'EV6 전기차 리스', '전기차 리스 조건이 좋아요. 추천합니다.', 7, 1, datetime('now', '-23 days'), datetime('now', '-23 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+9', '쏘렌토 2.5T 후기', '대형 SUV 원했는데 조건 맞춰서 잘 구했어요.', 8, 1, datetime('now', '-22 days'), datetime('now', '-22 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+10', '코나 하이브리드', '연비 좋은 차로 갈아탔어요. 상담 친절했습니다.', 9, 1, datetime('now', '-21 days'), datetime('now', '-21 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+11', '싼타페 구매', '중형 SUV로 싼타페 선택했어요. 만족합니다.', 10, 1, datetime('now', '-20 days'), datetime('now', '-20 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+12', 'GV80 제네시스', '고급차 구매 상담 받았어요. 전문적이에요.', 11, 1, datetime('now', '-19 days'), datetime('now', '-19 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+13', 'G80 2.5 가솔린', '제네시스 G80 조건 좋게 구했습니다.', 12, 1, datetime('now', '-18 days'), datetime('now', '-18 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+14', '벤츠 E클래스 리스', '리스로 명품차 타고 있어요. 조건 만족해요.', 13, 1, datetime('now', '-17 days'), datetime('now', '-17 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+15', 'BMW 5시리즈', 'BMW 리스 상담 받고 계약했어요. 좋아요.', 14, 1, datetime('now', '-16 days'), datetime('now', '-16 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+16', '아우디 A6 리스', '아우디 리스 조건이 괜찮아서 여기서 했어요.', 15, 1, datetime('now', '-15 days'), datetime('now', '-15 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+17', '그랜저 하이브리드', '연비 좋은 그랜저로 바꿨어요. 추천합니다.', 16, 1, datetime('now', '-14 days'), datetime('now', '-14 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+18', '쏘나타 센슈어스', '고급감 있는 쏘나타 구매했어요. 만족해요.', 17, 1, datetime('now', '-13 days'), datetime('now', '-13 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+19', '투싼 N라인', '스포티한 투싼으로 구매했습니다. 좋아요.', 18, 1, datetime('now', '-12 days'), datetime('now', '-12 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+20', '스포티지 하이브리드', '하이브리드로 바꿨는데 조건 좋았어요.', 19, 1, datetime('now', '-11 days'), datetime('now', '-11 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+21', '아이오닉6 구매', '전기 세단 아이오닉6 구매 후기입니다. 만족해요.', 20, 1, datetime('now', '-10 days'), datetime('now', '-10 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+22', 'EV9 7인승 전기차', '대형 전기차 EV9 구매했습니다. 조건 좋아요.', 21, 1, datetime('now', '-9 days'), datetime('now', '-9 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+23', '코나 N', '코나 N 구매 후기. 드라이빙 재밌어요.', 22, 1, datetime('now', '-8 days'), datetime('now', '-8 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+24', '쏘렌토 하이브리드', '7인승 하이브리드로 바꿨어요. 연비 좋아요.', 23, 1, datetime('now', '-7 days'), datetime('now', '-7 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+25', '카니발 하이브리드', '가족용 카니발 하이브리드 구매. 추천합니다.', 24, 1, datetime('now', '-6 days'), datetime('now', '-6 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+26', '싼타페 하이브리드', '싼타페 하이브리드 조건 좋게 구했어요.', 25, 1, datetime('now', '-5 days'), datetime('now', '-5 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+27', 'K8 하이브리드', 'K8 하이브리드 구매 후기. 만족합니다.', 26, 1, datetime('now', '-4 days'), datetime('now', '-4 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+28', '스토닉 구매', '소형 SUV 스토닉 구매했어요. 상담 친절해요.', 27, 1, datetime('now', '-3 days'), datetime('now', '-3 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+29', '니로 EV', '니로 전기차로 갈아탔어요. 조건 만족해요.', 28, 1, datetime('now', '-2 days'), datetime('now', '-2 days')),
('https://placehold.co/400x300/e8e8e8/666?text=Review+30', '셀토스 장기렌트', '셀토스 장기렌트 완료 후기. 다음에도 이용할게요.', 29, 1, datetime('now', '-1 days'), datetime('now', '-1 days'));
