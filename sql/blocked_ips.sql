-- IP 영구 차단 + 문의 IP 기록 (D1에서 한 번 실행)
CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);

-- 기존 DB에 문의 IP 컬럼 추가 (이미 있으면 오류 무시)
ALTER TABLE inquiries ADD COLUMN client_ip TEXT;
