const $ = selector => document.querySelector(selector);
const pdfInput = $("#pdfInput");
const dropZone = $("#dropZone");
const analyzeButton = $("#analyzeButton");
const levelToggle = $("#levelToggle");
const levelSlider = $("#levelSlider");
let selectedFile = null;
let latestCards = [];

function setLevel(value) {
  const high = String(value) === "2";
  levelToggle.checked = high;
  levelSlider.value = high ? "2" : "1";
  $("#levelDescription").textContent = high ? "초등학교 고학년 눈높이로 조금 더 자세히 설명해요." : "초등학교 저학년 눈높이로 쉽고 짧게 설명해요.";
}
levelToggle.addEventListener("change", () => setLevel(levelToggle.checked ? "2" : "1"));
levelSlider.addEventListener("input", event => setLevel(event.target.value));

function chooseFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return showStatus("PDF 파일만 선택할 수 있어요.", true);
  if (file.size > 4 * 1024 * 1024) return showStatus("PDF는 4MB 이하만 업로드할 수 있어요.", true);
  selectedFile = file;
  $("#fileName").textContent = `선택됨: ${file.name}`;
  analyzeButton.disabled = false;
  showStatus("");
}
pdfInput.addEventListener("change", event => chooseFile(event.target.files[0]));
["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove("dragover"); }));
dropZone.addEventListener("drop", event => chooseFile(event.dataTransfer.files[0]));

function showStatus(message, error = false) { $("#status").textContent = message; $("#status").style.color = error ? "#b15f68" : "#806aa6"; }
function readAsBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }

analyzeButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  analyzeButton.disabled = true;
  showStatus("PDF 파일을 읽고 Gemini가 분석 중입니다...");
  try {
    const pdfBase64 = await readAsBase64(selectedFile);
    const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfBase64, level: levelToggle.checked ? "high" : "low" }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "분석 중 오류가 발생했습니다.");
    renderResults(data);
    showStatus("분석이 끝났어요.");
  } catch (error) { showStatus(error.message, true); } finally { analyzeButton.disabled = false; }
});

function renderResults(data) {
  $("#easyExplanation").textContent = data.easyExplanation;
  $("#summary").innerHTML = data.summary.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  latestCards = data.cards || [];
  $("#cards").innerHTML = latestCards.map(card => `<div class="mini-card"><span class="card-label">CARD ${card.number}</span><h4>${escapeHtml(card.title)}</h4><p>${escapeHtml(card.body)}</p></div>`).join("");
  $("#results").hidden = false;
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

$("#downloadAll").addEventListener("click", () => {
  if (!latestCards.length) return;
  latestCards.forEach((card, index) => downloadCardPng(card, index));
});
function downloadCardPng(card, index) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const colors = ["#fff1dc", "#f0eaff", "#e5f7ee", "#e7efff"];
  ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#9b88a8"; ctx.lineWidth = 6; ctx.strokeRect(38, 38, 1004, 1004);
  ctx.fillStyle = "#806aa6"; ctx.font = "700 30px Pretendard, sans-serif"; ctx.fillText(`PDF CARD ${index + 1}`, 92, 125);
  ctx.fillStyle = "#3f3b48"; ctx.font = "700 64px Pretendard, sans-serif"; wrapText(ctx, card.title, 92, 260, 880, 82);
  ctx.font = "400 38px Pretendard, sans-serif"; wrapText(ctx, card.body, 92, 470, 860, 62);
  const link = document.createElement("a"); link.download = `card-news-${index + 1}.png`; link.href = canvas.toDataURL("image/png"); link.click();
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) { let line = ""; for (const char of String(text)) { const test = line + char; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, y); line = char; y += lineHeight; } else line = test; } if (line) ctx.fillText(line, x, y); }
