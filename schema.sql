-- 카플랫폼 문의 테이블 생성
CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wr_name TEXT NOT NULL,
    wr_subject TEXT NOT NULL,
    wr_7 TEXT,
    wr_3 TEXT,
    wr_4 TEXT,
    status TEXT DEFAULT 'new',
    memo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON inquiries(created_at);

-- 관리자 계정 테이블 생성 (단순 비밀번호 비교용)
CREATE TABLE IF NOT EXISTS admin_password (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 초기 관리자 비밀번호 설정 (admin123)
-- 테이블이 비어있을 경우에만 삽입
INSERT OR IGNORE INTO admin_password (id, password, updated_at) 
VALUES (1, 'admin123', datetime('now', '+9 hours'));

-- IP 기반 문의 제한 테이블 생성 (24시간 내 2회 제한)
CREATE TABLE IF NOT EXISTS inquiry_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    inquiry_count INTEGER DEFAULT 1,
    first_inquiry_at DATETIME NOT NULL,
    last_inquiry_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- IP 주소 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_ip_address ON inquiry_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_last_inquiry_at ON inquiry_limits(last_inquiry_at);
