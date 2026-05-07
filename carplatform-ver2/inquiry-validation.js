/* 문의 폼: 금칙어·자음/모음만·연속숫자 등 — script.js보다 먼저 로드 */
(function (g) {
  const BANNED_WORDS = [
    '씨발', '시발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', 'ㅅㅍ', 'ㅆㅍ',
    '좆', '좃', '존나', '졸라', '병신', '븅신',
    '개새끼', '개새', '개년', '개놈', '개자식', '개같', '개소리',
    '미친놈', '미친년', '미친새끼',
    '지랄', '닥쳐', '닥치', '꺼져', '꺼지', '죽어', '죽일',
    '느금', '니미', '느그', '애미', '애비', '애미년', '엿먹',
    '병맛', '엿같', '좆같', '꼴리',
    '십새', '18넘', '18년', '18놈', '18녀',
    'fuck', 'shit', 'bitch', 'asshole', 'damn', 'porn', 'sex',
    '섹스', '야동', '포르노',
    '보지', '자지', '걸레', '창녀', '창남', '음란',
    '자위', '딸딸', '오피', '유흥',
    '강간', '성폭', 'rape',
  ];

  function normalizeForBan(text) {
    if (!text) return '';
    return String(text).replace(/[\s\u200b\uFEFF·]+/g, '');
  }

  function hasBannedWord(text) {
    if (!text) return false;
    const raw = String(text);
    const flat = normalizeForBan(raw);
    return BANNED_WORDS.some((w) => {
      if (/^[a-zA-Z]+$/.test(w)) {
        try {
          const re = new RegExp(`\\b${w}\\b`, 'i');
          return re.test(raw) || re.test(flat);
        } catch (e) {
          return raw.toLowerCase().includes(w.toLowerCase());
        }
      }
      return raw.includes(w) || flat.includes(w);
    });
  }

  function isJamoOnly(text) {
    return /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(text);
  }

  function hasJamoRun(text) {
    // 성함에 자모(초성/모음) 1글자라도 섞이면 차단
    return /[ㄱ-ㅎㅏ-ㅣ]/.test(String(text || ''));
  }

  function isPlaceholderCarName(text) {
    if (!text) return false;
    const trimmed = String(text).trim().toLowerCase();
    if (/^(test|tester|sample|temp|none|null|na|n\/a)$/.test(trimmed)) return true;
    if (/^(.)\1{1,}$/.test(trimmed)) return true;
    if (/^[a-z]{2}$/.test(trimmed)) return true;
    return false;
  }

  /** 이름·차종 등 자유 입력: 6자리 이상 동일숫자 연속 또는 6자리 연속 증가/감소 숫자열 */
  function textHasBlockedDigitRuns(s) {
    if (!s) return false;
    if (/(\d)\1{5,}/.test(s)) return true;
    for (let i = 0; i <= s.length - 6; i++) {
      const slice = s.slice(i, i + 6);
      if (!/^\d{6}$/.test(slice)) continue;
      let asc = true;
      let desc = true;
      for (let j = 1; j < 6; j++) {
        const cur = slice.charCodeAt(j) - 48;
        const prev = slice.charCodeAt(j - 1) - 48;
        if (cur !== prev + 1) asc = false;
        if (cur !== prev - 1) desc = false;
      }
      if (asc || desc) return true;
    }
    return false;
  }

  /** 성함: 4자리 이상 동일숫자 반복 또는 4자리 연속 증가/감소 숫자열 */
  function nameHasBlockedDigitRuns(s) {
    if (!s) return false;
    const str = String(s);
    if (/(\d)\1{3,}/.test(str)) return true;
    const minLen = 4;
    for (let i = 0; i <= str.length - minLen; i++) {
      const slice = str.slice(i, i + minLen);
      if (!/^\d{4}$/.test(slice)) continue;
      let asc = true;
      let desc = true;
      for (let j = 1; j < minLen; j++) {
        const cur = slice.charCodeAt(j) - 48;
        const prev = slice.charCodeAt(j - 1) - 48;
        if (cur !== prev + 1) asc = false;
        if (cur !== prev - 1) desc = false;
      }
      if (asc || desc) return true;
    }
    return false;
  }

  function isInvalidName(name) {
  const normalized = String(name || '').trim();
  if (!normalized || normalized.length < 2) return true;
  if (isJamoOnly(normalized)) return true;
  if (hasJamoRun(normalized)) return true;
  if (nameHasBlockedDigitRuns(normalized)) return true;
    return false;
  }

  /** 차종: 2글자 이상, 한글 자모만/숫자만 문자열·연속숫자 패턴 차단 (금칙어는 별도 hasBannedWord) */
  function isInvalidCarNameText(text) {
  const normalized = String(text || '').trim();
  if (!normalized || normalized.length < 2) return true;
  if (isJamoOnly(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (textHasBlockedDigitRuns(normalized)) return true;
  if (isPlaceholderCarName(normalized)) return true;
    return false;
  }

  /** 11자리 휴대폰: 전체 동일숫자, 8자리 이상 동일숫자 반복, 6자리 연속 증가/감소 구간 */
  function isInvalidPhonePattern(digits) {
    if (!/^[0-9]{11}$/.test(digits)) return true;
    if (/^(\d)\1{10}$/.test(digits)) return true;
    if (/(\d)\1{7,}/.test(digits)) return true;
    for (let i = 0; i <= digits.length - 6; i++) {
      let asc = true;
      let desc = true;
      for (let j = 1; j < 6; j++) {
        const cur = digits.charCodeAt(i + j) - 48;
        const prev = digits.charCodeAt(i + j - 1) - 48;
        if (cur !== prev + 1) asc = false;
        if (cur !== prev - 1) desc = false;
      }
      if (asc || desc) return true;
    }
    return false;
  }

  g.hasBannedWord = hasBannedWord;
  g.isInvalidName = isInvalidName;
  g.isInvalidCarNameText = isInvalidCarNameText;
  g.isInvalidPhonePattern = isInvalidPhonePattern;
  g.textHasBlockedDigitRuns = textHasBlockedDigitRuns;
})(typeof globalThis !== 'undefined' ? globalThis : this);
