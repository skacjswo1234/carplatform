-- 기존 문의에 IP가 비어 있을 때 inquiry_limits 시간과 맞춰 client_ip 보정 (D1에서 1회 실행 권장)
UPDATE inquiries
SET client_ip = (
  SELECT il.ip_address
  FROM inquiry_limits il
  WHERE il.ip_address IS NOT NULL
    AND il.ip_address != ''
    AND il.ip_address != 'unknown'
    AND datetime(il.last_inquiry_at) >= datetime(inquiries.created_at, '-2 hours')
    AND datetime(il.last_inquiry_at) <= datetime(inquiries.created_at, '+2 hours')
  ORDER BY ABS(
    (julianday(il.last_inquiry_at) - julianday(inquiries.created_at)) * 86400
  )
  LIMIT 1
)
WHERE (client_ip IS NULL OR client_ip = '')
  AND EXISTS (
    SELECT 1 FROM inquiry_limits il2
    WHERE il2.ip_address IS NOT NULL
      AND il2.ip_address != ''
      AND il2.ip_address != 'unknown'
      AND datetime(il2.last_inquiry_at) >= datetime(inquiries.created_at, '-2 hours')
      AND datetime(il2.last_inquiry_at) <= datetime(inquiries.created_at, '+2 hours')
  );
