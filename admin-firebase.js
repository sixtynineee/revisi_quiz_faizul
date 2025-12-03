// admin-firebase.js (FINAL) - Materi & Soal support + theme toggle + flexible admin check
// Replace your existing admin-firebase.js with this file

// ----------------------- CONFIG (GANTI DENGAN FIREBASE MU) -----------------------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// ----------------------- Imports (Firebase modular via CDN) -----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ----------------------- Init Firebase -----------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----------------------- Local fallback keys & defaults -----------------------
const STORAGE_KEY = "quizData_v2_materi";
const DEFAULT_DATA = {
  courses: [
    {
      id: "local-1",
      name: "Sample Course (Local)",
      description: "Contoh course yang disimpan lokal",
      materi: [
        {
          id: "m-1",
          title: "Pengantar",
          description: "Materi pengantar singkat",
          questions: [
            { id: "q-1", question: "Apa kepanjangan CPU?", options: {A:"Central Processing Unit",B:"Control Process Unit",C:"",D:""}, correct: "A", explanation: "CPU adalah unit pemrosesan utama." }
          ]
        }
      ]
    }
  ]
};

// ----------------------- Utilities -----------------------
const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  children.flat().filter(Boolean).forEach(c => e.append(typeof c === "string" ? document.createTextNode(c) : c));
  return e;
};
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const escapeHTML = str => String(str || "").replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
const makeId = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

// ----------------------- Local storage helpers -----------------------
function readLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  try { return JSON.parse(raw); } catch (e) { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA)); return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}
function writeLocalData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

// ----------------------- Firestore wrappers -----------------------
async function fetchCoursesRemote() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = [];
    snap.forEach(d => {
      const data = d.data();
      // ensure materi array exists
      if (!Array.isArray(data.materi)) data.materi = data.questions ? [{ id: makeId('m-'), title: 'Imported', questions: data.questions }] : [];
      list.push({ id: d.id, ...data });
    });
    return list;
  } catch (err) {
    console.warn("fetchCoursesRemote failed:", err);
    return null;
  }
}
async function saveCourseRemote(course) {
  try {
    const payload = { 
        name: course.name, 
        description: course.description || '', 
        materi: course.materi || [], 
        updatedAt: Timestamp.now() 
    };
    if(!course.id || String(course.id).startsWith('local-')) {
        payload.createdAt = Timestamp.now();
        const ref = await addDoc(collection(db, "courses"), payload);
        return { success: true, id: ref.id };
    } else {
        await updateDoc(doc(db, "courses", course.id), payload);
        return { success: true, id: course.id };
    }
  } catch (err) {
    console.warn("saveCourseRemote failed", err);
    return { success: false };
  }
}
async function deleteCourseRemote(id) {
  try {
    await deleteDoc(doc(db, "courses", id));
    return { success: true };
  } catch (err) {
    console.warn("deleteCourseRemote failed", err);
    return { success: false };
  }
}

// ----------------------- Admin check (flexible: uid OR email as doc id) -----------------------
async function isAdminUidOrEmail(uid, email) {
  if (!uid && !email) return false;
  try {
    // check by uid first
    if (uid) {
      const snapUid = await getDoc(doc(db, "admins", uid));
      if (snapUid.exists()) return true;
    }
    // check by email as doc id
    if (email) {
      const sanitized = email; // use raw email as doc id (you said it's stored like that)
      const snapEmail = await getDoc(doc(db, "admins", sanitized));
      if (snapEmail.exists()) return true;
    }
    return false;
  } catch (err) {
    console.warn("isAdminUidOrEmail error", err);
    return false;
  }
}

// ----------------------- Toast -----------------------
function toast(msg, type='info') {
  const t = el('div', { class: `wa-toast ${type}` }, msg);
  Object.assign(t.style, { position:'fixed', right:'20px', top:'20px', background: type==='success' ? '#25D366' : type==='error' ? '#ff6b6b' : '#0b74de', color:'#fff', padding:'10px 14px', borderRadius:'10px', zIndex:9999, boxShadow:'0 6px 18px rgba(0,0,0,0.2)' });
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity = '0', 2800);
  setTimeout(()=> t.remove(), 3200);
}

// ----------------------- UI Injection (minimal admin CSS fallback) -----------------------
function injectStylesIfMissing() {
  if (document.getElementById('admin-inline-styles')) return;
  const s = document.createElement('style');
  s.id = 'admin-inline-styles';
  s.textContent = `
    /* Admin inline minimal styles (adapts to your style.css variables) */
    body { margin:0; font-family: Inter, system-ui, -apple-system, sans-serif; background:var(--bg, #f0f2f5); color:var(--text, #111b21); }
    .wa-root { display:flex; min-height:100vh; gap:18px; padding:18px; }
    .wa-sidebar{ width:280px; background: var(--card, #fff); border-radius:12px; padding:16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); height:fit-content; }
    .wa-main{ flex:1; display:flex; flex-direction:column; gap:18px; }
    .wa-card{ background:var(--card, #fff); border-radius:12px; padding:20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.03); }
    .muted{ color:var(--muted, #667781); font-size:13px; }
    .menu button{ display:block; width:100%; text-align:left; margin-bottom:4px; padding:10px 12px; border-radius:8px; border:0; background:transparent; cursor:pointer; font-weight:500; color:var(--text, #41525d); transition:0.2s; }
    .menu button:hover{ background:rgba(255,255,255,0.03); }
    .menu button.active{ background:rgba(255,255,255,0.06); color:var(--text); }
    .course-item{ display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:8px; background:var(--glass, #f0f2f5); margin-bottom:8px; border:1px solid transparent; }
    .course-item:hover{ border-color:rgba(255,255,255,0.02); }
    input,textarea,select{ width:100%; padding:10px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); margin-bottom:8px; box-sizing:border-box; font-family:inherit; background:var(--card); color:var(--text); }
    .btn { padding:8px 16px; border-radius:24px; cursor:pointer; background:var(--accent, #008069); color:white; border:0; font-weight:600; font-size:14px; transition:0.2s; }
    .btn:hover { filter:brightness(0.95); }
    .btn.ghost { background:transparent; color:var(--accent, #008069); border:1px solid rgba(0,0,0,0.08); }
    .btn.danger { background:var(--danger, #ef4444); color:white; }
    .btn.sm { padding: 4px 10px; font-size:12px; }
    .badge { width:40px; height:40px; border-radius:50%; background:var(--glass); display:grid; place-items:center; font-weight:700; color:var(--accent); flex-shrink:0; }
    .q-row { background:var(--card); padding:10px; border:1px solid rgba(0,0,0,0.04); border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:flex-start; }
    .materi-row { background:var(--card); padding:10px; border:1px solid rgba(0,0,0,0.04); border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .materi-title { font-weight:600; }
    @media (max-width:900px){ .wa-root{ flex-direction:column; padding:10px } .wa-sidebar{ width:100%; box-sizing:border-box; } }
  `;
  document.head.appendChild(s);
}

// ----------------------- Build Shell & UI wiring -----------------------
function buildShell() {
  injectStylesIfMissing();
  // We do not wipe body — we operate on existing DOM (we assume admin.html structure provided)
  // Wire up login form / logout / menu
  const loginForm = qs('#loginForm');
  const logoutWrap = qs('#logoutWrap');
  const signedEmail = qs('#signedEmail');
  const adminEmailLabel = qs('#adminEmailLabel');
  const loginEmail = qs('#loginEmail');
  const loginPass = qs('#loginPass');

  // menu nav
  qsa('.menu button').forEach(b => b.addEventListener('click', (ev) => {
    qsa('.menu button').forEach(x => x.classList.remove('active'));
    ev.currentTarget.classList.add('active');
    navigateToView(ev.currentTarget.dataset.view);
  }));

  // login
  if (loginForm) {
    loginForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = (loginEmail && loginEmail.value || '').trim();
      const pass = (loginPass && loginPass.value) || '';
      if(!email || !pass) return toast('Email & password wajib diisi','error');
      try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged will handle UI
      } catch (err) {
        console.error('Login error', err);
        toast('Gagal login', 'error');
      }
    });
  }

  qs('#btnLogout') && qs('#btnLogout').addEventListener('click', async () => {
    try { await signOut(auth); location.reload(); } catch(e){ console.warn(e); }
  });

  qs('#btnRefresh') && qs('#btnRefresh').addEventListener('click', () => refreshAndRender());
  qs('#btnNewCourse') && qs('#btnNewCourse').addEventListener('click', () => openCourseEditor());

  // admin theme toggle
  const tBtn = qs('#themeBtnAdmin');
  const tCheckbox = qs('#themeToggleAdmin');
  // set initial from localStorage
  try {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', saved === 'dark');
    if(tCheckbox) tCheckbox.checked = saved === 'dark';
    if(tBtn) tBtn.textContent = saved === 'dark' ? '☀' : '☾';
    // wire
    if(tCheckbox) tCheckbox.addEventListener('change', () => {
      const dark = !!tCheckbox.checked;
      document.body.classList.toggle('dark', dark);
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch(e){}
      if(tBtn) tBtn.textContent = dark ? '☀' : '☾';
    });
    if(tBtn) tBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      if(tCheckbox) tCheckbox.checked = isDark;
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
      if(tBtn) tBtn.textContent = isDark ? '☀' : '☾';
    });
  } catch(e){}

}

// ----------------------- App State -----------------------
let APP = { user:null, courses:[], participants:[], scores:[] };

// ----------------------- Navigation & Rendering -----------------------
async function navigateToView(view) {
  qs('#mainTitle').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  await renderView(view);
}

async function renderView(view='dashboard') {
  const container = qs('#contentInner');
  container.innerHTML = '<div class="muted">Memuat...</div>';
  if (view === 'dashboard') return renderDashboard(container);
  if (view === 'courses') return renderCourses(container);
  if (view === 'peserta') return renderPeserta(container);
  if (view === 'skor') return renderSkor(container);
}

function renderDashboard(container) {
  const ccount = APP.courses.length;
  const qcount = APP.courses.reduce((t,c)=> t + (Array.isArray(c.materi)? c.materi.reduce((s,m)=> s + ((Array.isArray(m.questions)?m.questions.length:0)),0) : 0 ),0);
  const pcount = APP.participants.length;
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px">
        <div style="background:var(--glass);padding:16px;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--accent)">${ccount}</div><div class="muted">Courses</div></div>
        <div style="background:var(--glass);padding:16px;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--accent)">${qcount}</div><div class="muted">Total Soal</div></div>
        <div style="background:var(--glass);padding:16px;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--accent)">${pcount}</div><div class="muted">Peserta</div></div>
    </div>
    <h4>Course Terbaru</h4>
    <div id="dashCourses"></div>
  `;
  const list = qs('#dashCourses');
  APP.courses.slice(0,5).forEach(c => list.appendChild(createCourseRow(c)));
}

function renderCourses(containerEl) {
  const container = containerEl || qs('#contentInner');
  container.innerHTML = `<div id="allCourses"></div>`;
  const listEl = qs('#allCourses');
  if(APP.courses.length === 0) { listEl.innerHTML = '<div class="muted">Belum ada course.</div>'; return; }
  APP.courses.forEach(c => listEl.appendChild(createCourseRow(c)));
}

function createCourseRow(c) {
  const div = document.createElement('div'); div.className = 'course-item';
  const mCount = Array.isArray(c.materi) ? c.materi.length : 0;
  const qCount = Array.isArray(c.materi) ? c.materi.reduce((s,m)=> s + ((Array.isArray(m.questions)?m.questions.length:0)),0) : 0;
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
        <div class="badge">${(c.name||'C')[0].toUpperCase()}</div>
        <div><div style="font-weight:600">${escapeHTML(c.name)}</div><div class="muted">${mCount} materi • ${qCount} soal • ${c.description?escapeHTML(c.description):'-'}</div></div>
    </div>
    <div style="display:flex;gap:6px">
        <button class="btn ghost sm" data-act="view">View</button>
        <button class="btn sm" data-act="edit">Edit</button>
        <button class="btn danger sm" data-act="delete">Del</button>
    </div>
  `;
  div.querySelector('[data-act="view"]').onclick = () => openCourseViewer(c);
  div.querySelector('[data-act="edit"]').onclick = () => openCourseEditor(c);
  div.querySelector('[data-act="delete"]').onclick = async () => {
    if(!confirm(`Hapus "${c.name}"?`)) return;
    await deleteCourse(c.id);
  };
  return div;
}

function renderPeserta(container) {
    container.innerHTML = `<div class="muted">Fitur manajemen peserta (Hapus/Block) dapat ditambahkan di sini.</div><br/>Total: ${APP.participants.length} User.`;
}
function renderSkor(container) {
    container.innerHTML = `<h4>Riwayat Skor</h4>`;
    APP.scores.forEach(s => {
        container.innerHTML += `<div class="course-item"><div style="font-weight:600">${s.score} Point</div><div class="muted">${s.participantId} @ ${s.courseId}</div></div>`;
    });
}

// ----------------------- MODAL & EDITORS (full code) -----------------------
// For brevity: reusing earlier functions for modal/course editor/materi/question
// (This block is long; it's the same editor implementation used earlier.)
// We'll include full implementation below to ensure completeness.
let modalRoot = null;
function openModal(contentEl) {
  if (!modalRoot) { modalRoot = el('div', { id:'wa_modal_root' }); document.body.appendChild(modalRoot); }
  modalRoot.innerHTML = '';
  const overlay = el('div', { style:'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9990;display:grid;place-items:center;padding:20px;backdrop-filter:blur(2px)' });
  const box = el('div', { class: 'wa-card', style:'width:100%;max-width:900px;max-height:90vh;overflow-y:auto;position:relative' });
  box.appendChild(contentEl);
  overlay.appendChild(box);
  modalRoot.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) modalRoot.innerHTML = ''; });
}
function closeModal() { if(modalRoot) modalRoot.innerHTML = ''; }

function openCourseViewer(course) {
  const wrap = el('div');
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 style="margin:0">${escapeHTML(course.name)}</h3>
        <button id="v_close" class="btn ghost sm">Tutup</button>
    </div>
    <div style="background:var(--glass);padding:12px;border-radius:8px;margin-bottom:12px">${escapeHTML(course.description||'No desc')}</div>
    <div id="v_materi_list"></div>
  `;
  const list = wrap.querySelector('#v_materi_list');
  (Array.isArray(course.materi)?course.materi:[]).forEach((m, i) => {
    list.innerHTML += `<div class="materi-row"><div><div class="materi-title">${escapeHTML(m.title)}</div><div class="muted">${(Array.isArray(m.questions)?m.questions.length:0)} soal</div></div><div><button class="btn ghost sm" data-i="${i}" data-act="view_questions">Lihat</button></div></div>`;
  });
  wrap.querySelectorAll('[data-act="view_questions"]').forEach(b => {
    b.onclick = () => {
      const idx = parseInt(b.dataset.i,10);
      const m = (course.materi||[])[idx];
      const qwrap = el('div');
      qwrap.innerHTML = `<h4>${escapeHTML(m.title)} — Soal</h4>`;
      (m.questions||[]).forEach((q, ii) => qwrap.innerHTML += `<div class="q-row"><div><b>${ii+1}. ${escapeHTML(q.question)}</b><br/><span class="muted">Ans: ${q.correct}</span></div></div>`);
      openModal(qwrap);
    };
  });
  wrap.querySelector('#v_close').onclick = closeModal;
  openModal(wrap);
}

// Course editor + materi + question (same as earlier full implementation)
function openCourseEditor(course=null) {
  const isEdit = !!course;
  let tempCourse = isEdit ? JSON.parse(JSON.stringify(course)) : { name:'', description:'', materi: [] };
  if (!Array.isArray(tempCourse.materi)) tempCourse.materi = [];

  let editingMateriIndex = null;
  let editingQuestionIndex = null;

  const wrap = el('div');
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin-top:0">${isEdit ? 'Edit Course' : 'Course Baru'}</h3>
      <div class="muted">Manage Materi & Soal</div>
    </div>

    <label class="muted">Nama Mata Kuliah</label>
    <input id="ce_name" value="${isEdit?escapeHTML(tempCourse.name):''}" />
    <label class="muted">Deskripsi</label>
    <input id="ce_desc" value="${isEdit?escapeHTML(tempCourse.description||''):''}" />

    <hr style="border:0;border-top:1px solid rgba(0,0,0,0.06);margin:16px 0"/>

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
      <h4 style="margin:0">Daftar Materi (<span id="materi_count">0</span>)</h4>
      <button id="btn_add_materi" class="btn sm">+ Materi Baru</button>
    </div>

    <div style="display:grid;grid-template-columns: 320px 1fr; gap:12px;">
      <div style="max-height:420px;overflow:auto;padding-right:6px">
        <div id="materi_list"></div>
      </div>

      <div style="background:var(--glass);padding:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.04);min-height:220px">
        <div id="materi_editor_area">
          <div class="muted">Pilih Materi untuk melihat / tambah soal.</div>
        </div>
      </div>
    </div>

    <div style="margin-top:16px;text-align:right;display:flex;gap:10px;justify-content:flex-end">
        <button id="ce_cancel" class="btn ghost">Batal</button>
        <button id="ce_save" class="btn">Simpan Course</button>
    </div>
  `;

  const materiListEl = wrap.querySelector('#materi_list');
  const materiCountEl = wrap.querySelector('#materi_count');
  const materiEditorArea = wrap.querySelector('#materi_editor_area');

  function renderMateriList() {
    materiListEl.innerHTML = '';
    const arr = tempCourse.materi || [];
    materiCountEl.textContent = arr.length;
    arr.forEach((m, i) => {
      const item = el('div', { class: 'materi-row' });
      item.innerHTML = `
        <div style="display:flex;flex-direction:column">
          <div style="font-weight:700">${escapeHTML(m.title || '(Tanpa Judul)')}</div>
          <div class="muted" style="font-size:13px">${m.description?escapeHTML(m.description):''}</div>
          <div class="muted" style="font-size:12px">${(Array.isArray(m.questions)?m.questions.length:0)} soal</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn ghost sm" data-i="${i}" data-act="select">Buka</button>
          <button class="btn sm" data-i="${i}" data-act="edit">Edit</button>
          <button class="btn danger sm" data-i="${i}" data-act="delete">Del</button>
        </div>
      `;
      // Bind events
      item.querySelector('[data-act="select"]').onclick = () => { editingMateriIndex = i; editingQuestionIndex = null; renderMateriEditor(); };
      item.querySelector('[data-act="edit"]').onclick = () => { openMateriForm(i); };
      item.querySelector('[data-act="delete"]').onclick = () => { if(confirm('Hapus materi ini?')) { tempCourse.materi.splice(i,1); if(editingMateriIndex===i) { editingMateriIndex=null; editingQuestionIndex=null; materiEditorArea.innerHTML = '<div class=\"muted\">Pilih Materi untuk melihat / tambah soal.</div>'; } renderMateriList(); } };
      materiListEl.appendChild(item);
    });
  }

  function openMateriForm(index = null) {
    const isEditMat = index !== null;
    const mat = isEditMat ? JSON.parse(JSON.stringify(tempCourse.materi[index])) : { id: makeId('m-'), title:'', description:'', questions: [] };
    const form = el('div');
    form.innerHTML = `
      <h4 style="margin-top:0">${isEditMat ? 'Edit Materi' : 'Tambah Materi'}</h4>
      <label class="muted">Judul Materi</label>
      <input id="mat_title" value="${isEditMat?escapeHTML(mat.title):''}" />
      <label class="muted">Deskripsi Materi (opsional)</label>
      <input id="mat_desc" value="${isEditMat?escapeHTML(mat.description||''):''}" />
      <div style="text-align:right;margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
        <button id="mat_cancel" class="btn ghost sm">Batal</button>
        <button id="mat_save" class="btn sm">${isEditMat?'Update Materi':'Simpan Materi'}</button>
      </div>
    `;
    openModal(form);
    form.querySelector('#mat_cancel').onclick = closeModal;
    form.querySelector('#mat_save').onclick = () => {
      const title = form.querySelector('#mat_title').value.trim();
      if(!title) return alert('Judul materi wajib diisi');
      mat.title = title;
      mat.description = form.querySelector('#mat_desc').value.trim();
      if(isEditMat) {
        tempCourse.materi[index] = mat;
      } else {
        tempCourse.materi.push(mat);
      }
      closeModal();
      renderMateriList();
    };
  }

  function renderMateriEditor() {
    const idx = editingMateriIndex;
    if(idx === null || !tempCourse.materi[idx]) {
      materiEditorArea.innerHTML = '<div class="muted">Pilih Materi untuk melihat / tambah soal.</div>';
      return;
    }
    const mat = tempCourse.materi[idx];
    materiEditorArea.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-weight:700">${escapeHTML(mat.title)}</div>
          <div class="muted" style="font-size:13px">${escapeHTML(mat.description||'')}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn_add_question" class="btn sm">+ Tambah Soal</button>
          <button id="btn_back_materi" class="btn ghost sm">Tutup Materi</button>
        </div>
      </div>

      <div id="q_list" style="max-height:320px;overflow:auto"></div>

      <div id="q_form_container" style="margin-top:10px"></div>
    `;

  const qList = materiEditorArea.querySelector('#q_list');
  (mat.questions || []).forEach((q, qi) => {
    const row = el('div', { class:'q-row' });
    row.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:600">${qi+1}. ${escapeHTML(q.question)}</div>
        <div class="muted" style="font-size:12px">Key: ${q.correct} | Opts: ${Object.values(q.options||{}).filter(Boolean).join(' • ')}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost sm" data-act="edit" data-qi="${qi}">Edit</button>
        <button class="btn danger sm" data-act="del" data-qi="${qi}">✕</button>
      </div>
    `;
    qList.appendChild(row);
    row.querySelector('[data-act="edit"]').onclick = () => { editingQuestionIndex = qi; openQuestionForm(); };
    row.querySelector('[data-act="del"]').onclick = () => { if(confirm('Hapus soal ini?')) { mat.questions.splice(qi,1); renderMateriEditor(); renderMateriList(); } };
  });

  materiEditorArea.querySelector('#btn_add_question').onclick = () => {
    editingQuestionIndex = null;
    openQuestionForm();
  };
  materiEditorArea.querySelector('#btn_back_materi').onclick = () => {
    editingMateriIndex = null;
    editingQuestionIndex = null;
    materiEditorArea.innerHTML = '<div class="muted">Pilih Materi untuk melihat / tambah soal.</div>';
  };
  }

  function openQuestionForm() {
    const idx = editingMateriIndex;
    if (idx === null) return alert('Pilih materi terlebih dahulu.');
    const mat = tempCourse.materi[idx];
    const isEditQ = editingQuestionIndex !== null && mat.questions && mat.questions[editingQuestionIndex];
    const qdata = isEditQ ? JSON.parse(JSON.stringify(mat.questions[editingQuestionIndex])) : { id: makeId('q-'), question:'', options: {A:'',B:'',C:'',D:''}, correct:'A', explanation:'' };

    const container = materiEditorArea.querySelector('#q_form_container');
    container.innerHTML = `
      <h4 style="margin:6px 0">${isEditQ ? 'Edit Soal' : 'Tambah Soal'}</h4>
      <label class="muted">Pertanyaan</label>
      <textarea id="q_text" rows="2">${isEditQ?escapeHTML(qdata.question):''}</textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <input id="q_a" placeholder="Opsi A" value="${isEditQ?escapeHTML(qdata.options.A):''}" />
        <input id="q_b" placeholder="Opsi B" value="${isEditQ?escapeHTML(qdata.options.B):''}" />
        <input id="q_c" placeholder="Opsi C" value="${isEditQ?escapeHTML(qdata.options.C):''}" />
        <input id="q_d" placeholder="Opsi D" value="${isEditQ?escapeHTML(qdata.options.D):''}" />
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        <div style="min-width:120px">
          <label class="muted">Jawaban Benar</label>
          <select id="q_correct">
            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
        </div>
        <div style="flex:1">
          <label class="muted">Penjelasan (opsional)</label>
          <input id="q_explain" value="${isEditQ?escapeHTML(qdata.explanation||''):''}" />
        </div>
      </div>
      <div style="text-align:right;margin-top:8px">
        <button id="q_cancel" class="btn ghost sm">Batal</button>
        <button id="q_save" class="btn sm">${isEditQ ? 'Update Soal' : 'Tambahkan Soal'}</button>
      </div>
    `;
    container.querySelector('#q_correct').value = qdata.correct || 'A';

    container.querySelector('#q_cancel').onclick = () => { container.innerHTML = ''; editingQuestionIndex = null; };
    container.querySelector('#q_save').onclick = () => {
      const qText = container.querySelector('#q_text').value.trim();
      if(!qText) return alert('Pertanyaan wajib diisi');
      const newQ = {
        id: qdata.id,
        question: qText,
        options: {
          A: container.querySelector('#q_a').value.trim(),
          B: container.querySelector('#q_b').value.trim(),
          C: container.querySelector('#q_c').value.trim(),
          D: container.querySelector('#q_d').value.trim()
        },
        correct: container.querySelector('#q_correct').value,
        explanation: container.querySelector('#q_explain').value.trim()
      };
      if(!newQ.options.A || !newQ.options.B) return alert('Minimal Opsi A dan B harus diisi');
      if(isEditQ) {
        mat.questions[editingQuestionIndex] = newQ;
      } else {
        mat.questions = mat.questions || [];
        mat.questions.push(newQ);
      }
      container.innerHTML = '';
      editingQuestionIndex = null;
      renderMateriEditor();
      renderMateriList();
    };
  }

  wrap.querySelector('#ce_save').onclick = async () => {
    const name = wrap.querySelector('#ce_name').value.trim();
    if(!name) return alert('Nama course harus diisi');

    wrap.querySelector('#ce_save').textContent = 'Menyimpan...';
    wrap.querySelector('#ce_save').disabled = true;

    const payload = {
      id: isEdit ? tempCourse.id : undefined,
      name: name,
      description: wrap.querySelector('#ce_desc').value.trim(),
      materi: tempCourse.materi || []
    };

    let res = await saveCourseRemote(payload);

    if(!res.success) {
      const local = readLocalData();
      if(isEdit && String(tempCourse.id).startsWith('local-')) {
        const idx = local.courses.findIndex(x=>x.id === tempCourse.id);
        if(idx >= 0) local.courses[idx] = { ...local.courses[idx], ...payload };
      } else if (isEdit) {
        const idx = local.courses.findIndex(x=>x.id === tempCourse.id);
        if(idx >= 0) local.courses[idx] = { ...local.courses[idx], ...payload, id: tempCourse.id };
        else { payload.id = makeId('local-'); local.courses.push(payload); }
      } else {
        payload.id = makeId('local-');
        local.courses.push(payload);
      }
      writeLocalData(local);
      toast('Disimpan ke Local (Remote Error)', 'error');
    } else {
      toast('Berhasil disimpan!', 'success');
    }

    closeModal();
    await refreshAndRender();
  };

  wrap.querySelector('#ce_cancel').onclick = closeModal;
  wrap.querySelector('#btn_add_materi').onclick = () => openMateriForm(null);

  renderMateriList();
  openModal(wrap);
}

// ----------------------- Delete Handler -----------------------
async function deleteCourse(id) {
    if (String(id).startsWith('local-')) {
        const local = readLocalData();
        local.courses = local.courses.filter(c => c.id !== id);
        writeLocalData(local);
        toast('Course lokal dihapus');
        await refreshAndRender();
        return;
    }
    const res = await deleteCourseRemote(id);
    if(res.success) {
        toast('Course dihapus');
        await refreshAndRender();
    } else {
        toast('Gagal hapus remote', 'error');
    }
}

// ----------------------- Data Loading -----------------------
async function refreshAndRender() {
  const remote = await fetchCoursesRemote();
  if (remote && Array.isArray(remote)) {
    APP.courses = remote;
  } else {
    const local = readLocalData();
    APP.courses = local.courses || [];
  }

  // Fetch others (Participants/Scores) - Naive implementation
  try {
      const pSnap = await getDocs(collection(db, 'peserta')); // Adjust collection name
      APP.participants = []; pSnap.forEach(d=> APP.participants.push(d.data()));
  } catch(e) { APP.participants = []; }
  
  try {
      const sSnap = await getDocs(collection(db, 'scores'));
      APP.scores = []; sSnap.forEach(d=> APP.scores.push(d.data()));
  } catch(e) { APP.scores = []; }

  const active = qs('.menu button.active')?.dataset.view || 'dashboard';
  await renderView(active);
}

// ----------------------- Auth Logic -----------------------
async function handleLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const ok = await isAdminUidOrEmail(cred.user.uid, cred.user.email);
    if (!ok) { await signOut(auth); toast('Bukan akun Admin!', 'error'); return; }
    toast('Login Berhasil', 'success');
  } catch (err) {
    console.error(err); toast('Gagal Login', 'error');
  }
}
async function handleLogout() { await signOut(auth); location.reload(); }

onAuthStateChanged(auth, async (user) => {
  const loginForm = qs('#loginForm');
  const logoutWrap = qs('#logoutWrap');
  const signedEmail = qs('#signedEmail');
  const adminEmailLabel = qs('#adminEmailLabel');

  if (user) {
    const ok = await isAdminUidOrEmail(user.uid, user.email);
    if(ok) {
        APP.user = user;
        if(loginForm) loginForm.style.display = 'none';
        if(logoutWrap) { logoutWrap.style.display = 'block'; qs('#signedEmail').textContent = user.email || ''; }
        if(adminEmailLabel) adminEmailLabel.textContent = user.email || '';
        refreshAndRender();
    } else {
        await signOut(auth);
        toast('Tidak punya akses admin', 'error');
    }
  } else {
    APP.user = null;
    if(loginForm) loginForm.style.display = 'block';
    if(logoutWrap) logoutWrap.style.display = 'none';
    if(adminEmailLabel) adminEmailLabel.textContent = 'Belum login';
  }
});

// ----------------------- Boot -----------------------
document.addEventListener('DOMContentLoaded', () => {
    // boot UI
    buildShell();
    // wire login helper (connect submit to handleLogin)
    const loginForm = qs('#loginForm');
    if(loginForm) loginForm.addEventListener('submit', async (ev) => { ev.preventDefault(); await handleLogin((qs('#loginEmail')?.value||'').trim(), (qs('#loginPass')?.value||'').trim()); });

    // restore theme
    try {
      if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
    } catch(e){}

    refreshAndRender();
});
