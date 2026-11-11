"use strict";

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const state = { file: null, toastTimer: null };
const $ = (id) => document.getElementById(id);

const el = {
  file: $("pdfFile"), drop: $("dropZone"), fileName: $("fileName"),
  accessWrap: $("accessWrap"), accessCode: $("accessCode"),
  analyze: $("analyzeButton"), ready: $("readyState"), loading: $("loading"),
  error: $("errorBox"), results: $("results"), easy: $("easyExplanation"),
  takeaways: $("takeaways"), news: $("cardNews"), copyAll: $("copyAllButton"), toast: $("toast")
};

el.file.addEventListener("change", (event) => selectFile(event.target.files[0]));
el.analyze.addEventListener("click", analyze);
el.copyAll.addEventListener("click", copyAll);

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => copyText($(button.dataset.copy).textContent, "내용이 클립보드에 복사되었습니다!"));
});

["dragenter", "dragover"].forEach((name) => el.drop.addEventListener(name, (event) => {
  event.preventDefault();
  el.drop.classList.add("drag-over");
}));
["dragleave", "drop"].forEach((name) => el.drop.addEventListener(name, (event) => {
  event.preventDefault();
  el.drop.classList.remove("drag-over");
}));
el.drop.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));

function selectFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf") {
    resetFile("PDF 파일만 업로드할 수 있습니다.");
    return;
  }
  if (file.size > MAX_PDF_BYTES) {
    resetFile("4MB 이하의 PDF만 업로드할 수 있습니다.");
    return;
  }
  state.file = file;
  el.fileName.textContent = `● ${file.name}`;
  el.ready.textContent = "PDF 파일이 준비되었습니다.";
  el.analyze.disabled = false;
  showToast("PDF 파일이 준비되었습니다.");
}

function resetFile(message) {
  state.file = null;
  el.file.value = "";
  el.fileName.textContent = "선택된 파일이 없습니다.";
  el.ready.textContent = "";
  el.analyze.disabled = true;
  showToast(message);
}

async function analyze() {
  if (!state.file) {
    showToast("먼저 PDF 파일을 업로드해 주세요.");
    return;
  }
  setBusy(true);
  hide(el.results); hide(el.error);
  try {
    const headers = { "Content-Type": "application/octet-stream" };
    const savedCode = sessionStorage.getItem("accessCode");
    const code = el.accessCode.value.trim() || savedCode;
    if (code) headers["x-access-code"] = code;

    const response = await fetch("/api/analyze", {
      method: "POST", headers, body: state.file
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data.code === "ACCESS_CODE_REQUIRED") {
        sessionStorage.removeItem("accessCode");
        show(el.accessWrap);
        el.accessCode.focus();
      }
      throw new Error(data.error || `요청에 실패했습니다. (${response.status})`);
    }

    if (code) sessionStorage.setItem("accessCode", code);
    render(data);
    show(el.results);
    el.results.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("분석이 완료되었습니다!");
  } catch (error) {
    showError(error.message);
  } finally {
    setBusy(false);
  }
}

function render(data) {
  el.easy.textContent = String(data.card1_easy_explanation || "");
  el.takeaways.replaceChildren();
  (Array.isArray(data.card2_takeaways) ? data.card2_takeaways : []).slice(0, 3).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = String(text);
    el.takeaways.appendChild(li);
  });

  el.news.replaceChildren();
  (Array.isArray(data.card3_card_news) ? data.card3_card_news : []).slice(0, 4).forEach((text, index) => {
    const card = document.createElement("article");
    card.className = "news-card";
    const meta = document.createElement("div");
    meta.className = "news-meta";
    meta.append(`SLIDE ${String(index + 1).padStart(2, "0")}`, "Card News");
    const title = document.createElement("h4");
    title.textContent = String(text).split("\n")[0] || `슬라이드 ${index + 1}`;
    const body = document.createElement("p");
    body.textContent = String(text);
    const actions = document.createElement("div");
    actions.className = "news-actions";
    const download = document.createElement("button");
    download.className = "download-button";
    download.type = "button";
    download.textContent = "PNG 저장";
    download.addEventListener("click", () => downloadCardPng(index + 1, String(text)));
    actions.appendChild(download);
    card.append(meta, title, body, actions);
    el.news.appendChild(card);
  });
}

function getAllText() {
  const summaries = Array.from(el.takeaways.children).map((item, i) => `${i + 1}. ${item.textContent}`).join("\n");
  const cards = Array.from(el.news.querySelectorAll(".news-card p")).map((item, i) => `(슬라이드 ${i + 1})\n${item.textContent}`).join("\n\n");
  return `[초등학생도 이해하는 쉬운 말 해설]\n${el.easy.textContent}\n\n[핵심 테이크어웨이]\n${summaries}\n\n[SNS 카드뉴스 슬라이드]\n${cards}`;
}

function copyAll() { copyText(getAllText(), "전체 결과가 클립보드에 복사되었습니다!"); }

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    showToast("복사에 실패했습니다. 직접 선택해서 복사해 주세요.");
  }
}

function downloadCardPng(number, text) {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1350;
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#1e1b4b";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#818cf8";
  ctx.fillRect(0, 0, width, 22);
  ctx.fillStyle = "#c7d2fe";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText(`SLIDE ${String(number).padStart(2, "0")}   CARD NEWS`, 76, 105);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 58px Arial, sans-serif";
  const lines = wrapCanvasText(ctx, text, 860, 70);
  let y = 230;
  lines.forEach((line) => { ctx.fillText(line, 76, y); y += 82; });
  ctx.fillStyle = "#c7d2fe";
  ctx.font = "400 25px Arial, sans-serif";
  ctx.fillText("PDF 쉬운 해설 & 카드뉴스", 76, 1260);
  const link = document.createElement("a");
  link.download = `card-news-${String(number).padStart(2, "0")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast(`슬라이드 ${number} PNG를 저장했습니다.`);
}

function wrapCanvasText(ctx, text, maxWidth, fontSize) {
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  const result = [];
  String(text).split(/\n/).forEach((paragraph) => {
    let line = "";
    for (const char of paragraph) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        result.push(line);
        line = char;
      } else line = test;
    }
    if (line) result.push(line);
  });
  return result.slice(0, 12);
}

function setBusy(busy) { el.loading.classList.toggle("hidden", !busy); el.analyze.disabled = busy || !state.file; }
function show(element) { element.classList.remove("hidden"); }
function hide(element) { element.classList.add("hidden"); }
function showError(message) { el.error.textContent = message; show(el.error); }
function showToast(message) { clearTimeout(state.toastTimer); el.toast.textContent = message; el.toast.classList.add("show"); state.toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2500); }
