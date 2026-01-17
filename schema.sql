-- 카플랫폼 문의 테이블 생성
CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wr_name TEXT NOT NULL,
    wr_subject TEXT NOT NULL,
    wr_7 TEXT,
    wr_3 TEXT,
    wr_4 TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON inquiries(created_at);
