// ---------- Theme toggle ----------
const themeBtn = document.getElementById("themeToggleBtn");
const THEME_KEY = "ripasso-theme";

initTheme();

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}

themeBtn.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
});

// ---------------- PWA Install ----------------
let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

// ---------------- Service Worker ----------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/sw.js");
}

// ---------------- UI Elements ----------------
const panel = document.getElementById("panel");
const statusEl = document.getElementById("status");

const viewSubjectsBtn = document.getElementById("viewSubjectsBtn");
const viewChaptersBtn = document.getElementById("viewChaptersBtn");
const viewStudyBtn = document.getElementById("viewStudyBtn");

const searchEl = document.getElementById("search");
const expandAllBtn = document.getElementById("expandAllBtn");
const collapseAllBtn = document.getElementById("collapseAllBtn");

let manifest = null;
let selectedSubject = null;
let selectedChapterRef = null;
let currentChapter = null;

init();

async function init() {
  setStatus("Caricamento materie…");
  manifest = await fetchJSON("data/manifest.json");

  // start view
  renderSubjects();

  viewSubjectsBtn.onclick = renderSubjects;
  viewChaptersBtn.onclick = () => selectedSubject && renderChapters(selectedSubject);
  viewStudyBtn.onclick = () => currentChapter && renderStudy(currentChapter);

  searchEl.addEventListener("input", () => currentChapter && renderStudy(currentChapter));
  expandAllBtn.onclick = () => setAllDetails(true);
  collapseAllBtn.onclick = () => setAllDetails(false);

  setStatus("Pronto ✅");
}

function setNavState({ chaptersEnabled, studyEnabled }) {
  viewChaptersBtn.disabled = !chaptersEnabled;
  viewStudyBtn.disabled = !studyEnabled;
}

function renderSubjects() {
  selectedSubject = null;
  selectedChapterRef = null;
  currentChapter = null;

  setNavState({ chaptersEnabled: false, studyEnabled: false });
  searchEl.value = "";
  panel.innerHTML = `
    <div class="row space-between">
      <h2>Materie</h2>
      <span class="pill">${manifest.subjects.length} materie</span>
    </div>
    <div class="hr"></div>
    <div class="list" id="subjectsList"></div>
    <p class="muted" style="margin-top:10px;">Tocca una materia per vedere i capitoli.</p>
  `;

  const list = document.getElementById("subjectsList");
  for (const subj of manifest.subjects) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="row space-between">
        <div><b>${escapeHtml(subj.name)}</b></div>
        <span class="pill">${subj.chapters.length} capitoli</span>
      </div>
    `;
    el.onclick = () => renderChapters(subj);
    list.appendChild(el);
  }
}

function renderChapters(subj) {
  selectedSubject = subj;
  selectedChapterRef = null;
  currentChapter = null;

  setNavState({ chaptersEnabled: true, studyEnabled: false });
  searchEl.value = "";

  panel.innerHTML = `
    <div class="row space-between">
      <h2>${escapeHtml(subj.name)}</h2>
      <span class="pill">${subj.chapters.length} capitoli</span>
    </div>
    <div class="hr"></div>
    <div class="list" id="chaptersList"></div>
    <p class="muted" style="margin-top:10px;">Tocca un capitolo per aprire lo studio.</p>
  `;

  const list = document.getElementById("chaptersList");
  for (const ch of subj.chapters) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="row space-between">
        <div>
          <div><b>${escapeHtml(ch.title)}</b></div>
          <div class="muted">${escapeHtml(ch.id || "")}</div>
        </div>
        <span class="pill">Apri</span>
      </div>
    `;
    el.onclick = () => openChapter(ch);
    list.appendChild(el);
  }
}

async function openChapter(chRef) {
  selectedChapterRef = chRef;
  setStatus(`Apro: ${selectedSubject.name} — ${chRef.title}…`);

  currentChapter = await fetchJSON(chRef.json);
  setNavState({ chaptersEnabled: true, studyEnabled: true });

  renderStudy(currentChapter);
  setStatus("Capitolo caricato ✅");
}

function renderStudy(chapter) {
  const q = (searchEl.value || "").toLowerCase().trim();
  const topics = (chapter.topics || []).filter(t => {
    if (!q) return true;
    const hit =
      (t.title || "").toLowerCase().includes(q) ||
      (t.definition || "").toLowerCase().includes(q) ||
      (t.explanation || "").toLowerCase().includes(q) ||
      (t.questions || []).some(qq => (qq.prompt || "").toLowerCase().includes(q));
    return hit;
  });

  panel.innerHTML = `
    <div class="row space-between">
      <div>
        <h2>${escapeHtml(chapter.chapterTitle || selectedChapterRef.title)}</h2>
        <p class="muted">${escapeHtml(selectedSubject.name)}</p>
      </div>
      <span class="pill">${topics.length} / ${(chapter.topics || []).length} argomenti</span>
    </div>
    <div class="hr"></div>
    <div id="topics"></div>
  `;

  const wrap = document.getElementById("topics");
  for (const t of topics) {
    const det = document.createElement("details");
    det.open = false;

    const sum = document.createElement("summary");
    sum.textContent = t.title || "Argomento";
    det.appendChild(sum);

    const body = document.createElement("div");
    body.className = "topic";
    body.innerHTML = `
      <div class="pill">${(t.questions?.length || 0)} domande</div>

      <div style="margin-top:10px;"><b>Definizione</b></div>
      <div class="muted">${escapeHtml(t.definition || "—")}</div>

      <div style="margin-top:10px;"><b>Spiegazione</b></div>
      <div class="muted">${escapeHtml(t.explanation || "—")}</div>

      <div class="hr"></div>
      <div><b>Domande</b></div>
    `;

    for (const qq of (t.questions || [])) {
      body.appendChild(renderQuestion(qq));
    }

    det.appendChild(body);
    wrap.appendChild(det);
  }
}

function renderQuestion(qq) {
  const box = document.createElement("div");
  box.className = "q";
  const type = qq.type || "short";

  const title = document.createElement("div");
  title.className = "q-title";
  title.textContent = `☐ ${qq.prompt || ""} (${type})`;
  box.appendChild(title);

  if (type === "mcq") {
    const opts = qq.options || [];
    const group = "g_" + Math.random().toString(16).slice(2);

    const form = document.createElement("div");
    opts.forEach((opt, i) => {
      const lab = document.createElement("label");
      lab.className = "opt";
      lab.innerHTML = `
        <input type="radio" name="${group}" value="${i}">
        <div>${escapeHtml(opt)}</div>
      `;
      form.appendChild(lab);
    });

    const btn = document.createElement("button");
    btn.className = "btn-small";
    btn.textContent = "Verifica";

    const fb = document.createElement("div");
    fb.className = "muted";
    fb.style.marginTop = "8px";

    btn.onclick = () => {
      const selected = form.querySelector("input:checked");
      if (!selected) {
        fb.innerHTML = `<span class="bad">Seleziona una risposta.</span>`;
        return;
      }
      const chosen = Number(selected.value);
      const ok = chosen === qq.correctIndex;

      if (ok) {
        fb.innerHTML = `<span class="ok">Corretto ✅</span> ${qq.explanation ? "— " + escapeHtml(qq.explanation) : ""}`;
      } else {
        const corr = opts[qq.correctIndex] ?? "n/d";
        fb.innerHTML = `<span class="bad">Sbagliato ❌</span> (Corretta: <b>${escapeHtml(corr)}</b>) ${qq.explanation ? "— " + escapeHtml(qq.explanation) : ""}`;
      }
    };

    box.appendChild(form);
    box.appendChild(btn);
    box.appendChild(fb);
    return box;
  }

  if (type === "tf") {
    const btnTrue = document.createElement("button");
    btnTrue.className = "btn-small";
    btnTrue.textContent = "Vero";

    const btnFalse = document.createElement("button");
    btnFalse.className = "btn-small";
    btnFalse.textContent = "Falso";
    btnFalse.style.marginLeft = "8px";

    const fb = document.createElement("div");
    fb.className = "muted";
    fb.style.marginTop = "8px";

    function check(val) {
      const ok = (val === true) === (qq.correct === true);
      fb.innerHTML = ok
        ? `<span class="ok">Corretto ✅</span> ${qq.explanation ? "— " + escapeHtml(qq.explanation) : ""}`
        : `<span class="bad">Sbagliato ❌</span> ${qq.explanation ? "— " + escapeHtml(qq.explanation) : ""}`;
    }

    btnTrue.onclick = () => check(true);
    btnFalse.onclick = () => check(false);

    box.appendChild(btnTrue);
    box.appendChild(btnFalse);
    box.appendChild(fb);
    return box;
  }

  // short
  const btn = document.createElement("button");
  btn.className = "btn-small";
  btn.textContent = "Mostra risposta";

  const ans = document.createElement("div");
  ans.className = "muted";
  ans.style.marginTop = "8px";
  ans.textContent = "Risposta nascosta.";

  btn.onclick = () => {
    ans.innerHTML = `<b>Risposta:</b> ${escapeHtml(qq.answer || "—")}`;
  };

  box.appendChild(btn);
  box.appendChild(ans);
  return box;
}

function setAllDetails(open) {
  document.querySelectorAll("details").forEach(d => d.open = open);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossibile caricare ${url} (${res.status})`);
  return await res.json();
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
