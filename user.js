
// ----- FIREBASE CONFIG -----
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// Firebase imports (CDN modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----- DOM helpers & small utilities -----
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const id = n => document.getElementById(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function escapeHtml(s){ if (s==null) return ""; return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'", "&#039;"); }
function shuffle(arr){ if (!Array.isArray(arr)) return []; const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function toast(msg, type='info'){ const t = document.createElement('div'); t.className = 'wa-toast ' + type; t.textContent = msg; Object.assign(t.style, { position:'fixed', right:'18px', top:'18px', padding:'8px 12px', borderRadius:'10px', zIndex:12000, color:'#fff' }); t.style.background = type==='success' ? '#25D366' : type==='error' ? '#ff6b6b' : '#0b74de'; document.body.appendChild(t); setTimeout(()=> t.classList.add('hide'), 2500); setTimeout(()=> t.remove(), 3000); }

// ----- local storage keys -----
const LOCAL_COURSES_KEY = "local_courses_data_v1";
const LAST_RESULT_KEY = "last_quiz_result_v1"; // used as fallback

// ----- state -----
let COURSES_CACHE = null;      // raw from firestore/local
let CURRENT_COURSE = null;     // normalized & shuffled
let USER_ANSWERS = {};         // { idx: optionIndex }
let REVIEW_MODE = false;

// ----- data fetch (Firestore first, fallback local) -----
async function fetchRemoteCourses(){
  try {
    const snap = await getDocs(collection(db, "courses"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err){
    console.warn("fetchRemoteCourses error", err);
    return null;
  }
}
function readLocalCourses(){
  try { return JSON.parse(localStorage.getItem(LOCAL_COURSES_KEY)) || []; }
  catch(e){ return []; }
}
function saveLocalCourses(list){ try { localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(list)); } catch(e){} }

function sortCourses(list){
  return (list||[]).slice().sort((a,b)=>{
    const r = /^(.*?)(\d+)?$/;
    const am = (a.name||a.title||"").match(r) || ["","","0"];
    const bm = (b.name||b.title||"").match(r) || ["","","0"];
    const at = (am[1]||"").trim().toLowerCase();
    const bt = (bm[1]||"").trim().toLowerCase();
    const cmp = at.localeCompare(bt);
    if (cmp!==0) return cmp;
    return (parseInt(am[2]||"0",10) - parseInt(bm[2]||"0",10));
  });
}

async function loadCourses(){
  if (COURSES_CACHE) return COURSES_CACHE;
  const remote = await fetchRemoteCourses();
  let list = null;
  if (Array.isArray(remote) && remote.length>0) list = remote;
  else list = readLocalCourses();
  COURSES_CACHE = sortCourses(list);
  return COURSES_CACHE;
}

// ----- normalize question format to internal model -----
// internal question: { id, question, options: [{text,key}], correctIndex, explanation }
function normalizeCourse(raw){
  if (!raw) return null;
  const name = raw.name ?? raw.title ?? 'Untitled';
  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = questionsRaw.map((q, qi)=>{
    let opts = [];
    if (Array.isArray(q.options)){
      opts = q.options.map((t,i)=>({ text: t, key: ["A","B","C","D","E"][i]||String(i)}));
    } else if (q.options && typeof q.options === 'object'){
      ["A","B","C","D","E"].forEach(k=>{ if (q.options[k]!=null) opts.push({ text:q.options[k], key:k}); });
      Object.keys(q.options).forEach(k=>{ if (!["A","B","C","D","E"].includes(k)) opts.push({ text:q.options[k], key:k}); });
    } else {
      ["A","B","C","D"].forEach(k=>{ if (q['opt'+k]) opts.push({ text: q['opt'+k], key:k }); });
    }

    let correctIndex = 0;
    if (typeof q.correct === 'string'){
      const idx = ["A","B","C","D","E"].indexOf(q.correct.toUpperCase());
      if (idx>=0) correctIndex = idx;
    } else if (typeof q.answer === 'number') correctIndex = q.answer;
    else if (typeof q.correct === 'number') correctIndex = q.correct;
    else if (q.correctText || q.correct_answer_text){
      const corr = q.correctText ?? q.correct_answer_text;
      const idx = opts.findIndex(o => String(o.text).trim() === String(corr).trim());
      if (idx>=0) correctIndex = idx;
    }

    return {
      id: q.id ?? `q-${qi}`,
      question: q.question ?? q.title ?? "",
      options: opts,
      correctIndex: (typeof correctIndex === 'number'? correctIndex : 0),
      explanation: q.explanation ?? q.explain ?? ""
    };
  });

  return { id: raw.id ?? raw._id ?? name, name, questions };
}

// ----- RENDER course list -----
async function renderCourses(){
  const list = await loadCourses();
  const container = id('coursesList');
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0){ container.innerHTML = '<div class="muted">Belum ada soal</div>'; return; }

  list.forEach((c, i)=>{
    const node = document.createElement('div');
    node.className = 'course-item new-item';
    node.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((c.name||c.title||'')[0]||'?')}</div>
        <div>
          <div style="font-weight:600">${escapeHtml(c.name ?? c.title)}</div>
          <div class="muted" style="font-size:13px">${(Array.isArray(c.questions)?c.questions.length:0)} soal</div>
        </div>
      </div>
      <div>
        <button class="btn primary start-btn" data-id="${escapeHtml(c.id ?? c._id ?? '')}">Mulai</button>
      </div>
    `;
    container.appendChild(node);
    setTimeout(()=> node.classList.add('shown'), 30*i);
  });

  // attach start handlers (use fresh query after DOM inserted)
  $$('.start-btn').forEach(b=>{
    b.onclick = async () => {
      const idv = b.dataset.id;
      const listAll = await loadCourses();
      const raw = listAll.find(x => String(x.id) === String(idv) || String(x._id) === String(idv));
      if (!raw){ toast('Course tidak ditemukan','error'); return; }
      const normalized = normalizeCourse(raw);
      startQuiz(normalized);
    };
  });
}

// ----- START QUIZ -----
function startQuiz(course){
  CURRENT_COURSE = JSON.parse(JSON.stringify(course));
  USER_ANSWERS = {};
  REVIEW_MODE = false;

  if (!Array.isArray(CURRENT_COURSE.questions)) CURRENT_COURSE.questions = [];

  // shuffle questions
  CURRENT_COURSE.questions = shuffle(CURRENT_COURSE.questions);

  // shuffle options per question and remap correctIndex
  CURRENT_COURSE.questions = CURRENT_COURSE.questions.map(q=>{
    const ops = q.options.map((o, idx)=> ({ text:o.text, key:o.key, __orig: idx }));
    const sh = shuffle(ops);
    const newCorrect = sh.findIndex(x => x.__orig === q.correctIndex);
    return { ...q, options: sh.map(s => ({ text:s.text, key:s.key })), correctIndex: (newCorrect>=0?newCorrect:0) };
  });

  // render
  if (id('quizTitle')) id('quizTitle').textContent = CURRENT_COURSE.name || 'Quiz';
  renderQuizView();

  // show quiz section
  if (typeof showOnlySectionAnimated === 'function') showOnlySectionAnimated('quizSection');
  else {
    const cs = id('coursesSection'), qsct = id('quizSection');
    if (cs) cs.style.display = 'none';
    if (qsct) qsct.style.display = 'block';
  }

  // show finish button
  const fb = id('finishQuizBtn'); if (fb) fb.style.display = 'inline-flex';
}

// ----- render quiz UI -----
function renderQuizView(){
  const box = id('quizContainer');
  if (!box || !CURRENT_COURSE) return;
  box.innerHTML = '';
  CURRENT_COURSE.questions.forEach((q, idx)=>{
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `qcard-${idx}`;
    const opts = q.options.map((o,i)=> `<div class="choice" data-q="${idx}" data-opt="${i}"><span class="label">${["A","B","C","D","E"][i]||i+1+'.'}</span><span class="text">${escapeHtml(o.text)}</span></div>`).join('');
    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">${opts}</div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;margin-top:10px">${escapeHtml(q.explanation||'')}</div>
    `;
    box.appendChild(card);
  });
  attachChoiceEvents();
  updateProgressHeader();
}

// ----- choice handling (delegated to quizContainer) -----
// use event delegation so re-rendering doesn't detach handlers
function attachChoiceEvents(){
  const box = id('quizContainer');
  if (!box) return;
  // remove previous listener if exists by cloning node (safe approach)
  const newBox = box.cloneNode(true);
  box.parentNode.replaceChild(newBox, box);

  newBox.addEventListener('click', ev => {
    const el = ev.target.closest('.choice');
    if (!el) return;
    const qidx = parseInt(el.dataset.q,10);
    const opt = parseInt(el.dataset.opt,10);
    if (REVIEW_MODE) return;
    USER_ANSWERS[qidx] = opt;
    // visuals: clear group and set chosen
    const group = newBox.querySelector(`#choices-${qidx}`);
    if (group) group.querySelectorAll('.choice').forEach(x=>x.classList.remove('chosen'));
    el.classList.add('chosen');
    updateProgressHeader();
    // auto-scroll next unanswered
    setTimeout(()=> {
      const next = findNextUnanswered(qidx+1);
      if (next!=null){
        const node = id(`qcard-${next}`);
        if (node) node.scrollIntoView({ behavior:'smooth', block:'center' });
      }
    }, 180);
  });
}

function findNextUnanswered(start=0){
  for (let i=start;i<CURRENT_COURSE.questions.length;i++) if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  for (let i=0;i<start;i++) if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  return null;
}

function updateProgressHeader(){
  const total = CURRENT_COURSE ? CURRENT_COURSE.questions.length : 0;
  const answered = Object.keys(USER_ANSWERS).length;
  if (id('quizProgress')) id('quizProgress').textContent = `${answered} / ${total} terjawab`;
  if (id('quizAnswered')) id('quizAnswered').textContent = `${total===0?0:Math.round((answered/total)*100)}% terjawab`;
}

// ----- confirm modal (simple inline) -----
function ensureConfirmModal(){
  if (id('confirmModal')) return;
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.position='fixed'; modal.style.inset='0'; modal.style.display='none'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex=12000; modal.style.background='rgba(0,0,0,0.45)';
  modal.innerHTML = `
    <div class="modal-card card" style="min-width:320px;max-width:90%;">
      <h3 style="margin:0 0 6px 0">Konfirmasi Submit</h3>
      <p style="margin:0 0 12px 0">Apakah Anda yakin ingin mengakhiri kuis sekarang? Jawaban akan dinilai.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" id="confirmCancel">Batal</button>
        <button class="btn primary" id="confirmYes">Ya, Selesai</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  id('confirmCancel').onclick = ()=> modal.style.display='none';
  id('confirmYes').onclick = ()=> { modal.style.display='none'; doFinishQuiz(); };
}
function showConfirmModal(){ const m = id('confirmModal'); if (!m) return; m.style.display='flex'; setTimeout(()=> id('confirmYes') && id('confirmYes').focus(), 60); }

// ----- finish logic: inline rendering (no automatic redirect) -----
function finishQuizHandler(){ ensureConfirmModal(); showConfirmModal(); }

function doFinishQuiz(){
  if (!CURRENT_COURSE) return;
  REVIEW_MODE = true;
  let score = 0;
  const total = CURRENT_COURSE.questions.length;

  // mark each question visually
  CURRENT_COURSE.questions.forEach((q, idx)=>{
    const correct = q.correctIndex;
    const user = USER_ANSWERS[idx];
    const choicesContainer = document.querySelector(`#choices-${idx}`);
    if (choicesContainer) {
      choicesContainer.querySelectorAll('.choice').forEach(c=>{
        c.classList.remove('chosen','final-correct','final-wrong');
        const opt = parseInt(c.dataset.opt,10);
        if (opt === correct) c.classList.add('final-correct');
        else if (user === opt) c.classList.add('final-wrong');
        // disable pointer
        c.classList.add('disabled');
      });
    }
    const exp = id(`exp-${idx}`); if (exp) exp.style.display='block';
    if (user === correct) score++;
  });

  // hide finish button to prevent double submit
  const fin = id('finishQuizBtn'); if (fin) fin.style.display = 'none';

  // create summary & review nodes and insert right after quizContainer
  const quizContainer = id('quizContainer');
  const parent = quizContainer && quizContainer.parentNode ? quizContainer.parentNode : null;

  // Remove any previous inline results (avoid duplicates)
  const prev = parent && parent.querySelector('.inline-quiz-result-wrapper');
  if (prev) prev.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'inline-quiz-result-wrapper';
  wrapper.style.marginTop = '14px';

  // Summary card
  const summary = document.createElement('div');
  summary.className = 'card';
  summary.innerHTML = `
    <h3>Hasil</h3>
    <p><strong>${score} / ${total}</strong> soal benar</p>
    <p class="muted">${score === total ? '🔥 Sempurna!' : score >= total/2 ? '🎯 Mantap!' : '💡 Jangan menyerah!'}</p>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn" id="btnRetryInline">Ulangi</button>
      <button class="btn" id="btnReviewInline">Review Jawaban</button>
      <button class="btn" id="btnBackInline">Kembali ke daftar</button>
    </div>
  `;
  wrapper.appendChild(summary);

  // Review details
  const review = document.createElement('div');
  review.id = 'reviewContainer';
  review.style.marginTop = '12px';
  CURRENT_COURSE.questions.forEach((q, idx)=>{
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices">
        ${q.options.map((o,i)=>{
          const usr = USER_ANSWERS[idx];
          const corr = q.correctIndex;
          const cls = (i===corr) ? 'final-correct' : (usr===i && usr!==corr ? 'final-wrong' : '');
          return `<div class="choice ${cls}"><span class="label">${["A","B","C","D","E"][i]||i+1+'.'}</span> <span class="text">${escapeHtml(o.text)}</span></div>`;
        }).join('')}
      </div>
      <div class="explanation muted" style="margin-top:8px">${escapeHtml(q.explanation||'')}</div>
    `;
    review.appendChild(card);
  });
  wrapper.appendChild(review);

  // Insert wrapper after the quizContainer
  if (parent) {
    if (quizContainer.nextSibling) parent.insertBefore(wrapper, quizContainer.nextSibling);
    else parent.appendChild(wrapper);
    // scroll to result smoothly
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    // fallback: append to body
    document.body.appendChild(wrapper);
  }

  // wire inline buttons
  setTimeout(()=> {
    const retry = document.getElementById('btnRetryInline');
    const rev = document.getElementById('btnReviewInline');
    const back = document.getElementById('btnBackInline');
    if (retry) retry.onclick = ()=> { USER_ANSWERS = {}; REVIEW_MODE = false; startQuiz(CURRENT_COURSE); window.scrollTo({top:0,behavior:'smooth'}); };
    if (rev) rev.onclick = ()=> document.getElementById('reviewContainer')?.scrollIntoView({behavior:'smooth'});
    if (back) back.onclick = ()=> { USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses(); if (id('quizSection')) id('quizSection').style.display='none'; if (id('coursesSection')) id('coursesSection').style.display='block'; };
  }, 40);

  // persist last result locally as fallback (no redirect)
  try { localStorage.setItem(LAST_RESULT_KEY, JSON.stringify({
    courseId: CURRENT_COURSE.id,
    courseName: CURRENT_COURSE.name,
    totalQuestions: total,
    correct: score,
    timestamp: new Date().toISOString(),
    answers: CURRENT_COURSE.questions.map((q, idx)=>({
      question: q.question,
      options: q.options.map(o=>o.text),
      correctIndex: q.correctIndex,
      userAnswerIndex: USER_ANSWERS[idx] ?? null,
      explanation: q.explanation ?? ""
    }))
  })); } catch(e){}
}

// ----- UI wiring (theme + nav + buttons) -----
function wireUI(){
  // finish button
  const fin = id('finishQuizBtn');
  if (fin) fin.onclick = ()=> finishQuizHandler();

  // back to courses
  const back = id('backToCourses');
  if (back) back.onclick = ()=> {
    if (Object.keys(USER_ANSWERS).length > 0 && !confirm('Kembali akan membatalkan kuis. Lanjutkan?')) return;
    USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses();
    if (typeof showOnlySectionAnimated === 'function') showOnlySectionAnimated('coursesSection');
    else { id('quizSection') && (id('quizSection').style.display='none'); id('coursesSection') && (id('coursesSection').style.display='block'); }
  };

  // theme toggle (persist)
  const themeToggle = id('themeToggle');
  if (themeToggle){
    themeToggle.onclick = ()=> {
      document.documentElement.classList.toggle('dark-mode');
      try { localStorage.setItem('darkMode', document.documentElement.classList.contains('dark-mode')); } catch(e){}
    };
  }
  try { if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark-mode'); } catch(e){}
}

// ----- init -----
async function init(){
  wireUI();
  ensureConfirmModal();
  await renderCourses();
}
init();
