// user.js (FIXED VERSION)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/* ---------- CONFIG ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- UTIL ---------- */
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const escapeHtml = s => String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const shuffle = arr => {
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};

/* ---------- STATE ---------- */
let COURSES = [];
let CUR_COURSE = null;
let CUR_MATERI = null;
let QUESTIONS = [];
let USER_ANS = {};
let REVIEW = false;

/* ---------- FIRESTORE ---------- */
async function fetchCourses() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return list.map(c=>{
      if (!Array.isArray(c.materi)){
        if (Array.isArray(c.questions)){
          c.materi = [{
            id:"m-imported",
            title:"Materi",
            description:c.description||"",
            questions:c.questions
          }];
          delete c.questions;
        } else c.materi = [];
      } else {
        c.materi = c.materi.map(m=>({
          id: m.id || ("m-"+Math.random().toString(36).slice(2,8)),
          title: m.title || "Untitled",
          description: m.description || "",
          questions: Array.isArray(m.questions) ? m.questions : []
        }));
      }
      return c;
    }).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  } catch(e){
    console.warn(e);
    return [];
  }
}

/* ---------- COURSES VIEW ---------- */
async function renderCourses(){
  COURSES = await fetchCourses();
  const root = $("coursesList");
  root.innerHTML = "";

  if (COURSES.length===0){
    root.innerHTML = `<div class="muted">Belum ada mata kuliah.</div>`;
    return;
  }

  COURSES.forEach(c=>{
    const mCount = c.materi.length;
    const qCount = c.materi.reduce((s,m)=>s+m.questions.length,0);

    const item = document.createElement("div");
    item.className = "course-item";
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml(c.name[0].toUpperCase())}</div>
        <div><b>${escapeHtml(c.name)}</b><br>
        <span class="muted">${mCount} materi • ${qCount} soal</span></div>
      </div>
      <button class="btn sm view-materi" data-id="${c.id}">Lihat Materi</button>
    `;
    root.appendChild(item);
  });

  qsa(".view-materi").forEach(x=>{
    x.onclick = () => {
      CUR_COURSE = COURSES.find(c=>c.id===x.dataset.id);
      renderMateri();
      showSection("materi");
    };
  });
}

/* ---------- MATERI VIEW ---------- */
function renderMateri(){
  const list = $("materiList");
  const title = $("materiTitle");
  title.textContent = `Materi — ${CUR_COURSE.name}`;
  list.innerHTML = "";

  CUR_COURSE.materi.forEach((m,i)=>{
    const el = document.createElement("div");
    el.className = "course-item";
    el.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div class="badge">${escapeHtml(m.title[0].toUpperCase())}</div>
        <div><b>${escapeHtml(m.title)}</b><br>
        <span class="muted">${escapeHtml(m.description)}</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn sm start-materi" data-i="${i}">Mulai</button>
        <button class="btn ghost sm preview-materi" data-i="${i}">Lihat Soal</button>
      </div>
    `;
    list.appendChild(el);
  });

  $("backToCourses").onclick = () => showSection("courses");

  qsa(".start-materi").forEach(b=>{
    b.onclick = () => startQuiz(parseInt(b.dataset.i));
  });

  qsa(".preview-materi").forEach(b=>{
    b.onclick = () => previewMateri(parseInt(b.dataset.i));
  });
}

/* ---------- PREVIEW ---------- */
function previewMateri(i){
  const m = CUR_COURSE.materi[i];
  const overlay = document.createElement("div");
  overlay.style = "position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:9999";

  const box = document.createElement("div");
  box.style = "background:var(--card);padding:16px;border-radius:12px;max-width:720px;width:100%;max-height:80vh;overflow:auto";
  box.innerHTML = `
    <h3>${escapeHtml(m.title)}</h3>
    <div class="muted">${escapeHtml(m.description)}</div>
    <hr>
    ${m.questions.map((q,i)=>`<div><b>${i+1}.</b> ${escapeHtml(q.question)}</div>`).join("")}
    <div style="text-align:right;margin-top:12px">
      <button id="closePrev" class="btn ghost">Tutup</button>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector("#closePrev").onclick = () => overlay.remove();
}

/* ---------- START QUIZ ---------- */
function startQuiz(i){
  CUR_MATERI = CUR_COURSE.materi[i];
  USER_ANS = {};
  REVIEW = false;

  QUESTIONS = shuffle(JSON.parse(JSON.stringify(CUR_MATERI.questions)));

  QUESTIONS = QUESTIONS.map(q=>{
    const ops = [
      {t:q.options.A, ok:q.correct==="A"},
      {t:q.options.B, ok:q.correct==="B"},
      {t:q.options.C, ok:q.correct==="C"},
      {t:q.options.D, ok:q.correct==="D"}
    ];
    const sh = shuffle(ops);
    const correctIndex = sh.findIndex(x=>x.ok);
    const newKey = ["A","B","C","D"][correctIndex];

    return {
      ...q,
      correct: newKey,
      options:{
        A:sh[0].t,
        B:sh[1].t,
        C:sh[2].t,
        D:sh[3].t
      }
    }
  });

  renderQuiz();
  showSection("quiz");
}

/* ---------- RENDER QUIZ ---------- */
function renderQuiz(){
  $("quizTitle").textContent = `${CUR_COURSE.name} — ${CUR_MATERI.title}`;
  const root = $("quizContainer");
  root.innerHTML = "";

  QUESTIONS.forEach((q,idx)=>{
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div id="choices-${idx}" class="choices">
        ${["A","B","C","D"].map(k=>`
          <div class="choice" data-idx="${idx}" data-opt="${k}">
            <span class="label">${k}.</span> ${escapeHtml(q.options[k])}
          </div>
        `).join("")}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none">
        ${escapeHtml(q.explanation||"Tidak ada penjelasan.")}
      </div>
    `;
    root.appendChild(card);
  });

  qsa(".choice").forEach(c=>{
    c.onclick = ()=>{
      if (REVIEW) return;

      const idx = +c.dataset.idx;
      const opt = c.dataset.opt;

      USER_ANS[idx] = opt;

      qsa(`#choices-${idx} .choice`).forEach(x=>x.classList.remove("chosen"));
      c.classList.add("chosen");
    };
  });

  $("finishQuizBtn").onclick = finishConfirm;
  $("cancelQuizBtn").onclick = () => showSection("materi");
}

/* ---------- FINISH CONFIRM ---------- */
function finishConfirm(){
  const o = document.createElement("div");
  o.style="position:fixed;inset:0;background:rgba(0,0,0,.4);display:grid;place-items:center;z-index:9999";

  const b = document.createElement("div");
  b.style="background:var(--card);padding:16px;border-radius:12px;min-width:260px";
  b.innerHTML = `
    <h3>Konfirmasi</h3>
    <p>Selesai mengerjakan?</p>
    <div style="text-align:right;display:flex;gap:8px;justify-content:flex-end">
      <button id="no" class="btn ghost">Batal</button>
      <button id="yes" class="btn primary">Ya</button>
    </div>
  `;
  o.appendChild(b);
  document.body.appendChild(o);

  b.querySelector("#no").onclick = ()=>o.remove();
  b.querySelector("#yes").onclick = ()=>{o.remove(); doFinish();};
}

/* ---------- FINISH ---------- */
function doFinish(){
  REVIEW = true;
  let score = 0;

  QUESTIONS.forEach((q,idx)=>{
    const user = USER_ANS[idx];

    if (user === q.correct) score++;

    qsa(`#choices-${idx} .choice`).forEach(c=>{
      const k = c.dataset.opt;
      c.classList.remove("chosen","final-correct","final-wrong");

      if (k === q.correct) c.classList.add("final-correct");
      else if (k === user) c.classList.add("final-wrong");
    });

    $(`exp-${idx}`).style.display = "block";
  });

  $("resultBox").innerHTML = `
    <div class="result-row">
      <strong>Skor:</strong> ${score}/${QUESTIONS.length} 
      (${Math.round(score/QUESTIONS.length*100)}%)
    </div>
  `;

  showSection("result");

  $("resultBack").onclick = () => showSection("materi");
  $("resultRetry").onclick = () => startQuiz(
    CUR_COURSE.materi.findIndex(m=>m.id===CUR_MATERI.id)
  );
}

/* ---------- SECTION SWITCH ---------- */
function showSection(name){
  const map={
    courses:"coursesSection",
    materi:"materiSection",
    quiz:"quizSection",
    result:"resultView"
  };
  Object.values(map).forEach(id=>{
    const el=$(id);
    if(el) el.style.display="none";
  });
  $(map[name]).style.display="block";
}

/* ---------- THEME ---------- */
function wireTheme(){
  const t=$("themeToggle");
  const saved = localStorage.getItem("theme") || "light";
  document.body.classList.toggle("dark",saved==="dark");
  t.textContent = saved==="dark" ? "☀" : "☾";

  t.onclick = ()=>{
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("theme",isDark?"dark":"light");
    t.textContent = isDark ? "☀" : "☾";
  };
}

/* ---------- INIT ---------- */
async function init(){
  wireTheme();
  $("backToCourses").onclick = ()=>showSection("courses");
  await renderCourses();
  showSection("courses");
}
document.addEventListener("DOMContentLoaded", init);
