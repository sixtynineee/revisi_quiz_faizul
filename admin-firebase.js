// admin-firebase.js
// Single-file admin panel script (no build). Requires style.css present.
// Provides: Firebase Auth (admin), Firestore CRUD (courses/questions), local fallback,
// WhatsApp-like admin UI injection, dark-mode toggle, toasts.

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
const STORAGE_KEY = "quizData_v1";
const DEFAULT_DATA = {
  courses: [
    {
      id: "local-1",
      name: "Sample Course (Local)",
      description: "Contoh course yang disimpan lokal",
      questions: [
        { id: "q-1", question: "Apa kepanjangan CPU?", options: {A:"Central Processing Unit",B:"Control Process Unit"}, correct: "A", explanation: "CPU adalah unit pemrosesan utama." }
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

// ----------------------- Local storage helpers -----------------------
function readLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  try { return JSON.parse(raw); } catch (e) { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA)); return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}
function writeLocalData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
const makeId = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

// ----------------------- Firestore wrappers with graceful fallback -----------------------
async function fetchCoursesRemote() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    console.warn("fetchCoursesRemote failed:", err);
    return null;
  }
}
async function saveCourseRemote(course) {
  try {
    const ref = await addDoc(collection(db, "courses"), { name: course.name, description: course.description || '', questions: course.questions || [], createdAt: Timestamp.now() });
    return { success: true, id: ref.id };
  } catch (err) {
    console.warn("saveCourseRemote failed", err);
    return { success: false };
  }
}
async function updateCourseRemote(id, updates) {
  try {
    await updateDoc(doc(db, "courses", id), updates);
    return { success: true };
  } catch (err) {
    console.warn("updateCourseRemote failed", err);
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
async function isAdminUid(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch (err) {
    console.warn("isAdminUid error", err);
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

// ----------------------- UI building (WhatsApp-like) -----------------------
function injectStylesIfMissing() {
  if (document.getElementById('admin-inline-styles')) return;
  const s = document.createElement('style');
  s.id = 'admin-inline-styles';
  s.textContent = `
    /* minimal local ADMIN CSS overrides to work with your style.css */
    body { margin:0; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
    .wa-root { display:flex; min-height:100vh; gap:18px; background:var(--bg); color:var(--text); padding:18px; }
    .wa-sidebar{ width:300px; background: #fff; border-radius:12px; padding:12px; box-shadow: 0 6px 18px rgba(2,6,23,0.06); }
    .wa-main{ flex:1; }
    .wa-card{ background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border-radius:12px; padding:14px; box-shadow: var(--soft-shadow); border:1px solid rgba(255,255,255,0.03); }
    .muted{ color:var(--muted); font-size:13px; }
    .menu button{ display:block; width:100%; text-align:left; margin-bottom:6px; padding:8px 10px; border-radius:8px; border:0; background:transparent; cursor:pointer; }
    .menu button.active{ background:var(--accent); color:#fff; }
    .course-item{ display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:8px; background:var(--glass); border:1px solid rgba(255,255,255,0.03); margin-bottom:8px; }
    input,textarea,select{ width:100%; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.04); background:transparent; color:var(--text); margin-bottom:8px; }
    .btn { padding:8px 12px; border-radius:8px; cursor:pointer; background:var(--accent); color:white; border:0 }
    .btn.ghost { background:transparent; border:1px solid rgba(255,255,255,0.04); color:var(--text) }
    @media (max-width:900px){ .wa-root{ flex-direction:column; padding:12px } .wa-sidebar{ width:100% } }
  `;
  document.head.appendChild(s);
}

// Build DOM skeleton
function buildShell() {
  injectStylesIfMissing();
  document.body.innerHTML = '';
  const root = el('div', { class: 'wa-root' });
  const sidebar = el('aside', { class: 'wa-sidebar wa-card' });
  const main = el('main', { class: 'wa-main' });

  // sidebar content
  sidebar.append(
    el('div', { class: 'brand', html: `<div style="display:flex;gap:10px;align-items:center;"><div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent));display:grid;place-items:center;color:#fff;font-weight:700">WA</div><div><div style="font-weight:700;color:var(--accent)">Admin Panel</div><div class="muted" style="font-size:12px">Kelola soal & data</div></div></div>` }),
    el('div', { class: 'wa-card', html: `<div id="authBox"><div id="adminInfo" class="muted">Belum login</div><form id="loginForm" class="stack" style="margin-top:8px"><input id="loginEmail" placeholder="Email admin" type="email"/><input id="loginPass" placeholder="Password" type="password"/><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="submit">Masuk</button></div></form><div style="display:flex;gap:8px;margin-top:8px"><button id="btnLogout" class="btn ghost" style="display:none">Logout</button></div></div>` }),
    el('div', { class: 'wa-card', style: 'margin-top:12px', html: `<h4 class="muted">Menu</h4><div class="menu" id="leftMenu"><button data-view="dashboard" class="active">Dashboard</button><button data-view="courses">Mata Kuliah</button><button data-view="peserta">Peserta</button><button data-view="skor">Skor</button></div>` })
  );

  // main content topbar + container
  main.append(
    el('div', { class:'wa-topbar', html: `<div><h2 id="mainTitle" style="margin:0">Dashboard Admin</h2><div id="mainSubtitle" class="muted">Ringkasan data</div></div><div><button id="btnRefresh" class="btn ghost">Refresh</button> <button id="btnNewCourse" class="btn" style="margin-left:8px">Tambah Course</button></div>` }),
    el('section', { id:'mainContent', class:'wa-card', html: `<div id="contentInner">Memuat...</div>` })
  );

  root.append(sidebar, main);
  document.body.appendChild(root);

  // attach events
  qsa('.menu button').forEach(b => b.addEventListener('click', (ev) => {
    qsa('.menu button').forEach(x => x.classList.remove('active'));
    ev.currentTarget.classList.add('active');
    navigateToView(ev.currentTarget.dataset.view);
  }));
  qs('#loginForm').addEventListener('submit', async (ev) => { ev.preventDefault(); await handleLogin(qs('#loginEmail').value.trim(), qs('#loginPass').value); });
  qs('#btnLogout').addEventListener('click', async () => { await handleLogout(); });
  qs('#btnRefresh').addEventListener('click', () => refreshAndRender());
  qs('#btnNewCourse').addEventListener('click', () => openCourseEditor());
}

// ----------------------- Views & render -----------------------
let APP = { user:null, courses:[], participants:[], scores:[] };

async function navigateToView(view) {
  qs('#mainTitle').textContent = view === 'dashboard' ? 'Dashboard Admin' : view === 'courses' ? 'Mata Kuliah' : view === 'peserta' ? 'Peserta' : 'Skor';
  await renderView(view);
}

async function renderView(view='dashboard') {
  const container = qs('#contentInner');
  container.innerHTML = 'Memuat...';
  if (view === 'dashboard') return renderDashboard(container);
  if (view === 'courses') return renderCourses(container);
  if (view === 'peserta') return renderPeserta(container);
  if (view === 'skor') return renderSkor(container);
  container.innerHTML = 'Tidak ada view';
}

async function renderDashboard(container) {
  const ccount = APP.courses.length;
  const qcount = APP.courses.reduce((t,c)=> t + (Array.isArray(c.questions)?c.questions.length:0),0);
  const pcount = APP.participants.length;
  const scount = APP.scores.length;
  container.innerHTML = `<div style="display:flex;gap:14px;flex-wrap:wrap"><div class="wa-card" style="flex:1;min-width:220px;text-align:center;padding:18px"><div style="font-size:28px;font-weight:700">${ccount}</div><div class="muted">Mata Kuliah</div></div><div class="wa-card" style="flex:1;min-width:220px;text-align:center;padding:18px"><div style="font-size:28px;font-weight:700">${qcount}</div><div class="muted">Total Soal</div></div><div class="wa-card" style="flex:1;min-width:220px;text-align:center;padding:18px"><div style="font-size:28px;font-weight:700">${pcount}</div><div class="muted">Peserta</div></div><div class="wa-card" style="flex:1;min-width:220px;text-align:center;padding:18px"><div style="font-size:28px;font-weight:700">${scount}</div><div class="muted">Skor</div></div></div><div style="margin-top:12px" class="wa-card"><h4 class="muted">Latest Courses</h4><div id="latestCourses" style="margin-top:8px"></div></div>`;
  const list = qs('#latestCourses');
  list.innerHTML = '';
  APP.courses.slice(0,6).forEach(c => {
    const item = el('div', { class: 'course-item' }, el('div', { class:'left', html:`<div class="course-badge">${(c.name||'')[0]||'C'}</div><div style="margin-left:8px"><div style="font-weight:600">${c.name}</div><div class="muted">${(c.questions||[]).length} soal</div></div>` }), el('div', { html:`<button class="btn ghost" data-id="${c.id}" data-act="view">Buka</button> <button class="btn" data-id="${c.id}" data-act="edit">Edit</button>` }));
    list.appendChild(item);
    item.querySelector('[data-act="view"]').addEventListener('click', ()=> openCourseViewer(c));
    item.querySelector('[data-act="edit"]').addEventListener('click', ()=> openCourseEditor(c));
  });
}

async function renderCourses(container) {
  container.innerHTML = `<h3>Daftar Mata Kuliah</h3><div id="coursesList" style="margin-top:12px"></div>`;
  const listEl = qs('#coursesList');
  listEl.innerHTML = '';
  if (!APP.courses || APP.courses.length === 0) { listEl.innerHTML = '<div class="muted">Belum ada course. Klik "Tambah Course".</div>'; return; }
  APP.courses.forEach(c => {
    const it = el('div', { class:'course-item' }, el('div', { class:'left', html:`<div class="course-badge">${(c.name||'')[0]||'C'}</div><div style="margin-left:8px"><div style="font-weight:600">${c.name}</div><div class="muted">${(c.questions||[]).length} soal</div></div>` }), el('div', { html:`<button class="btn ghost" data-id="${c.id}" data-act="view">View</button> <button class="btn" data-id="${c.id}" data-act="edit">Edit</button> <button class="btn ghost" data-id="${c.id}" data-act="delete">Delete</button>` }) );
    listEl.appendChild(it);
    it.querySelector('[data-act="view"]').addEventListener('click', ()=> openCourseViewer(c));
    it.querySelector('[data-act="edit"]').addEventListener('click', ()=> openCourseEditor(c));
    it.querySelector('[data-act="delete"]').addEventListener('click', async ()=> {
      if (!confirm('Hapus course ini?')) return;
      await deleteCourse(c.id);
      await refreshAndRender();
    });
  });
}

async function renderPeserta(container) {
  container.innerHTML = `<h3>Peserta</h3><div id="pesertaList" style="margin-top:12px"></div>`;
  const l = qs('#pesertaList'); l.innerHTML = '';
  if (!APP.participants || APP.participants.length === 0) { l.innerHTML = '<div class="muted">Belum ada peserta.</div>'; return; }
  APP.participants.forEach(p => {
    const item = el('div', { class:'course-item' }, el('div', { class:'left', html:`<div class="course-badge">${(p.name||p.email||'U')[0]}</div><div style="margin-left:8px"><div style="font-weight:600">${p.name||p.email}</div><div class="muted">${p.email||''}</div></div>` }), el('div', { html:`<button class="btn ghost" data-id="${p.id}" data-act="delete">Hapus</button>` }) );
    l.appendChild(item);
    item.querySelector('[data-act="delete"]').addEventListener('click', ()=> { alert('Hapus peserta belum diimplementasikan via UI — saya bisa tambahkan jika mau.'); });
  });
}

async function renderSkor(container) {
  container.innerHTML = `<h3>Skor</h3><div id="skorList" style="margin-top:12px"></div>`;
  const l = qs('#skorList'); l.innerHTML = '';
  if (!APP.scores || APP.scores.length === 0) { l.innerHTML = '<div class="muted">Belum ada skor.</div>'; return; }
  APP.scores.forEach(s => {
    const time = s.createdAt && s.createdAt.seconds ? new Date(s.createdAt.seconds*1000).toLocaleString() : new Date().toLocaleString();
    const item = el('div', { class:'course-item' }, el('div', { class:'left', html:`<div class="course-badge">${s.score||0}</div><div style="margin-left:8px"><div style="font-weight:600">${s.participantId||'Peserta'}</div><div class="muted">${s.courseId||''}</div></div>` }), el('div', { html: time }) );
    l.appendChild(item);
  });
}

// ----------------------- Modal helpers -----------------------
let modalRoot = null;
function openModal(html) {
  if (!modalRoot) { modalRoot = el('div', { id:'wa_modal_root' }); document.body.appendChild(modalRoot); }
  modalRoot.innerHTML = `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.6);z-index:9999;"><div style="width:100%;max-width:900px;padding:14px">${html}</div></div>`;
  modalRoot.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
}
function closeModal() { if (modalRoot) modalRoot.innerHTML = ''; }

// ----------------------- Course viewer/editor -----------------------
function openCourseViewer(course) {
  const html = `<div class="wa-card"><h3>${escapeHTML(course.name)}</h3><div style="margin-top:8px">${(course.questions||[]).map((q,idx)=>`<div style="margin-bottom:12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02)"><div style="font-weight:600">${idx+1}. ${escapeHTML(q.question)}</div><div class="muted" style="margin-top:6px">${Object.entries(q.options||{}).map(([k,v])=>k+': '+escapeHTML(v)).join(' | ')}</div>${q.explanation?`<div style="margin-top:6px;color:#6b7280">${escapeHTML(q.explanation)}</div>`:''}</div>`).join('')}</div><div style="margin-top:10px"><button data-close class="btn ghost">Tutup</button></div></div>`;
  openModal(html);
}

function openCourseEditor(course=null) {
  const isEdit = !!course;
  const html = `<div class="wa-card"><h3>${isEdit ? 'Edit Course' : 'Tambah Course'}</h3>
    <div style="margin-top:10px">
      <label>Nama</label><input id="ce_name" value="${isEdit?escapeHTML(course.name):''}" />
      <label>Deskripsi</label><input id="ce_desc" value="${isEdit?escapeHTML(course.description||''):''}" />
      <hr />
      <h4>Tambah Soal Baru</h4>
      <label>Pertanyaan</label><textarea id="q_new_text"></textarea>
      <div style="display:flex;gap:8px"><input id="q_opt_a" placeholder="Opsi A"/><input id="q_opt_b" placeholder="Opsi B"/></div>
      <div style="display:flex;gap:8px;margin-top:8px"><input id="q_opt_c" placeholder="Opsi C"/><input id="q_opt_d" placeholder="Opsi D"/></div>
      <label>Jawaban benar (A/B/C/D)</label><input id="q_new_correct" placeholder="A"/>
      <label>Penjelasan (opsional)</label><input id="q_new_explain" />
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button data-close class="btn ghost">Batal</button>
        <button id="ce_save" class="btn">${isEdit ? 'Simpan' : 'Buat'}</button>
      </div>
    </div></div>`;
  openModal(html);
  qs('#ce_save').addEventListener('click', async () => {
    const name = qs('#ce_name').value.trim();
    if (!name) return alert('Nama course wajib diisi.');
    const desc = qs('#ce_desc').value.trim();
    const qtext = qs('#q_new_text').value.trim();
    const options = { A: qs('#q_opt_a').value.trim(), B: qs('#q_opt_b').value.trim(), C: qs('#q_opt_c').value.trim(), D: qs('#q_opt_d').value.trim() };
    const correct = (qs('#q_new_correct').value.trim().toUpperCase() || 'A');
    const qExplain = qs('#q_new_explain').value.trim();
    const newQ = qtext ? { id: makeId('q-'), question: qtext, options: Object.fromEntries(Object.entries(options).filter(([k,v])=>v)), correct, explanation: qExplain } : null;

    try {
      if (!isEdit) {
        const newCourse = { id: makeId('local-'), name, description: desc, questions: newQ ? [newQ] : [] };
        const res = await saveCourseRemote(newCourse);
        if (res.success) toast('Course dibuat (remote).','success');
        else {
          // fallback local
          const local = readLocalData();
          local.courses.push(newCourse);
          writeLocalData(local);
          toast('Course dibuat lokal (firestore error).','error');
        }
      } else {
        // if course id looks remote update remote
        if (!String(course.id).startsWith('local-')) {
          if (newQ) { // push question
            // naive approach: fetch doc, update questions array on remote
            const snap = await getDoc(doc(db, "courses", course.id));
            if (snap.exists()) {
              const data = snap.data();
              const qs = Array.isArray(data.questions)?data.questions:[];
              qs.push(newQ);
              await updateCourseRemote(course.id, { questions: qs });
            }
          }
          await updateCourseRemote(course.id, { name, description: desc });
          toast('Perubahan disimpan (remote).','success');
        } else {
          const local = readLocalData();
          const c = local.courses.find(x=>x.id===course.id);
          if (c) { c.name = name; c.description = desc; if (newQ) c.questions = c.questions||[], c.questions.push(newQ); writeLocalData(local); }
          toast('Perubahan disimpan (lokal).','success');
        }
      }
    } catch (err) {
      console.error(err); toast('Error saat menyimpan','error');
    } finally {
      closeModal(); await refreshAndRender();
    }
  });
}

// ----------------------- Data loading & refresh -----------------------
async function refreshAndRender() {
  // attempt remote first; if remote fails, fallback to local
  const remote = await fetchCoursesRemote();
  if (remote && Array.isArray(remote)) {
    APP.courses = remote.map(r => ({ id: r.id, name: r.name, description: r.description || '', questions: Array.isArray(r.questions)?r.questions:r.questions || [] }));
  } else {
    const local = readLocalData();
    APP.courses = local.courses || [];
  }

  // participants and scores naive fetch (no fallback)
  try { const ps = await getDocs(collection(db,'peserta')); APP.participants = ps.docs.map(d=>({ id:d.id, ...d.data() })); } catch(e){ APP.participants = []; }
  try { const ss = await getDocs(collection(db,'scores')); APP.scores = ss.docs.map(d=>({ id:d.id, ...d.data() })); } catch(e){ APP.scores = []; }

  // render current view
  const active = qs('.menu button.active')?.dataset.view || 'dashboard';
  await renderView(active);
  qs('#mainSubtitle').textContent = 'Ringkasan data • terakhir disegarkan: ' + new Date().toLocaleTimeString();
}

// ----------------------- Delete course wrapper -----------------------
async function deleteCourse(id) {
  if (String(id).startsWith('local-')) {
    const local = readLocalData();
    local.courses = local.courses.filter(c => c.id !== id);
    writeLocalData(local);
    return;
  }
  const res = await deleteCourseRemote(id);
  if (res.success) toast('Course dihapus (remote)','success');
  else {
    const local = readLocalData();
    local.courses = local.courses.filter(c => c.id !== id);
    writeLocalData(local);
    toast('Course dihapus (lokal)','error');
  }
}

// ----------------------- Auth handlers -----------------------
async function handleLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const ok = await isAdminUid(user.uid);
    if (!ok) {
      toast('Akun tidak memiliki akses admin','error');
      await signOut(auth);
      return;
    }
    APP.user = user;
    qs('#adminInfo').textContent = user.email || 'Admin';
    qs('#btnLogout').style.display = '';
    qs('#loginForm').style.display = 'none';
    toast('Login berhasil','success');
    await refreshAndRender();
  } catch (err) {
    console.error(err);
    toast('Login gagal: cek email/password atau koneksi','error');
  }
}
async function handleLogout() {
  try { await signOut(auth); } catch (e){ console.warn(e); }
  APP.user = null;
  qs('#adminInfo').textContent = 'Belum login';
  qs('#btnLogout').style.display = 'none';
  qs('#loginForm').style.display = '';
  toast('Logout berhasil','info');
  await refreshAndRender();
}

// ----------------------- Auth listener (auto sign-out if not admin) -----------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) { APP.user = null; qs('#adminInfo').textContent = 'Belum login'; qs('#btnLogout').style.display = 'none'; qs('#loginForm').style.display = ''; return; }
  const ok = await isAdminUid(user.uid);
  if (!ok) { await signOut(auth); toast('Akun tidak punya hak admin','error'); return; }
  APP.user = user;
  qs('#adminInfo').textContent = user.email || 'Admin';
  qs('#btnLogout').style.display = '';
  qs('#loginForm').style.display = 'none';
  await refreshAndRender();
});

// ----------------------- Init -----------------------
document.addEventListener('DOMContentLoaded', async () => {
  buildShell();
  const local = readLocalData();
  APP.courses = local.courses || [];
  APP.participants = [];
  APP.scores = [];
  await refreshAndRender();
  // dark-mode toggle via saved pref (simple)
  if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark-mode');
});

// ----------------------- Expose for debug -----------------------
window.ADMIN_PANEL = { refresh: refreshAndRender, APP, auth, db };
