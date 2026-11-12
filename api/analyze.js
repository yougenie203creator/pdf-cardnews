const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const SYSTEM_PROMPT = `당신은 논문과 보고서를 초등학생도 이해할 수 있게 바꾸는 교육 콘텐츠 편집자입니다.
반드시 아래 JSON 형식만 반환하세요. 마크다운 코드펜스나 설명 문장은 쓰지 마세요.
{
  "easyExplanation": "쉬운 말 해설",
  "summary": ["핵심 문장 1", "핵심 문장 2", "핵심 문장 3"],
  "cards": [
    {"number": 1, "title": "카드 제목", "body": "카드 본문"},
    {"number": 2, "title": "카드 제목", "body": "카드 본문"},
    {"number": 3, "title": "카드 제목", "body": "카드 본문"},
    {"number": 4, "title": "카드 제목", "body": "카드 본문"}
  ]
}
쉬운 말 해설은 어려운 용어를 풀어 쓰고, PDF에 없는 내용은 추측하지 마세요. 사실과 의견을 구분하세요.`;

function jsonResponse(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").json(body);
}

function extractJson(text) {
  const cleaned = String(text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("Gemini 응답이 JSON 형식이 아닙니다.");
}

function validateResult(result) {
  if (!result || typeof result.easyExplanation !== "string" || !Array.isArray(result.summary) || !Array.isArray(result.cards)) {
    throw new Error("Gemini 응답 형식이 올바르지 않습니다.");
  }
  result.summary = result.summary.slice(0, 3).map(String);
  result.cards = result.cards.slice(0, 4).map((card, index) => ({
    number: index + 1,
    title: String(card.title || `카드 ${index + 1}`),
    body: String(card.body || "")
  }));
  return result;
}

async function callGemini(payload, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 270000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
        return validateResult(extractJson(text));
      }
      lastError = new Error(data?.error?.message || `Gemini API 오류(${response.status})`);
      if (![429, 500, 503].includes(response.status)) throw lastError;
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error("Gemini 응답 시간이 초과되었습니다.") : error;
      if (error.name !== "AbortError" && attempt === 2) throw lastError;
    } finally {
      clearTimeout(timer);
    }
    await new Promise(resolve => setTimeout(resolve, 1500 * (2 ** attempt)));
  }
  throw lastError || new Error("Gemini 호출에 실패했습니다.");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST 요청만 허용됩니다." });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse(res, 500, { error: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다." });

  try {
    const { pdfBase64, level } = req.body || {};
    if (!pdfBase64 || typeof pdfBase64 !== "string") return jsonResponse(res, 400, { error: "PDF 데이터가 없습니다." });
    const pdfBytes = Buffer.from(pdfBase64, "base64");
    if (pdfBytes.length > MAX_PDF_BYTES) return jsonResponse(res, 413, { error: "PDF는 4MB 이하만 업로드할 수 있습니다." });

    const levelText = level === "high" ? "초등학교 고학년(4~6학년) 수준" : "초등학교 저학년(1~3학년) 수준";
    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: `이 PDF를 ${levelText}에 맞춰 분석하세요. 1) 쉬운 말 해설, 2) 정확히 3줄 요약, 3) SNS 카드뉴스 4장 구성안을 JSON으로 작성하세요.` }
      ] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
    };
    const result = await callGemini(payload, apiKey);
    return jsonResponse(res, 200, result);
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: error.message || "분석 중 오류가 발생했습니다." });
  }
};
