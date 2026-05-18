function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function normalizeStr(v) {
  if (v == null) return "";
  const s = String(v).trim();
  try {
    return typeof s.normalize === "function" ? s.normalize("NFC") : s;
  } catch {
    return s;
  }
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

const compatJamo = /[\u3131-\u318E]/;

export async function onRequest(context) {
  const { request } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const name = normalizeStr(body.name);
  const phoneDigits = onlyDigits(body.phone_digits || body.phone);
  const vehicleName = normalizeStr(body.vehicle_name || body.car_name);

  if (!name || name.replace(/\s+/g, "").length < 2) {
    return json({ ok: false, message: "이름을 2글자 이상 입력해 주세요." }, 400);
  }
  if (compatJamo.test(name)) {
    return json({ ok: false, message: "이름에 초성(ㄱ/ㅅ 등)만 입력하면 접수할 수 없습니다." }, 400);
  }
  if (!/[\uAC00-\uD7A3]/.test(name)) {
    return json({ ok: false, message: "이름은 한글로 정확히 입력해 주세요." }, 400);
  }

  if (!phoneDigits) {
    return json({ ok: false, message: "휴대전화 번호를 입력해 주세요." }, 400);
  }
  if (!(phoneDigits.length === 11 && /^01[016789]\d{8}$/.test(phoneDigits))) {
    return json({ ok: false, message: "휴대전화 11자리(010, 011, 016~019)로 입력해 주세요." }, 400);
  }
  if (/^(010|011|016|017|018|019)0{8}$/.test(phoneDigits)) {
    return json({ ok: false, message: "유효한 휴대전화 번호를 입력해 주세요." }, 400);
  }
  if (/^(\d)\1+$/.test(phoneDigits)) {
    return json({ ok: false, message: "유효한 휴대전화 번호를 입력해 주세요." }, 400);
  }

  if (vehicleName) {
    if (compatJamo.test(vehicleName) && !/[\uAC00-\uD7A3A-Za-z]/.test(vehicleName)) {
      return json({ ok: false, message: "차량명은 초성이 아닌 전체 단어로 입력해 주세요." }, 400);
    }
    if (/^[\u3131-\u318E]+$/.test(vehicleName.replace(/\s+/g, ""))) {
      return json({ ok: false, message: "차량명은 초성이 아닌 전체 단어로 입력해 주세요." }, 400);
    }
  }

  return json({ ok: true });
}
