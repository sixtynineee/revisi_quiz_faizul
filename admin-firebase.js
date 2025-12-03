// admin-firebase.js (FULL) - Admin login (email-only) + Course/Materi/Soal CRUD
// Replace firebaseConfig values with yours if needed.

// -------------------- FIREBASE CONFIG --------------------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// -------------------- IMPORTS (CDN modular) --------------------
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

// -------------------- INIT --------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------- ADMIN CONFIG --------------------
const ADMIN_EMAIL = "mfaizulkhoir154@gmail.com"; // only this email can access admin UI
const STORAGE_KEY = "quiz_local_v2_materi";

// -------------------- HELPERS --------------------
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") e.className = attrs[k];
    else if (k === "html") e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  kids.flat().filter(Boolean).forEach(k => e.append(typeof k === "string" ? document.createTextNode(k) : k));
  return e;
};
const escape = str => String(str ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const makeId = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
function toast(msg, type='info'){ console.log(`[toast:${type}]`, msg); /* you can replace with nicer UI */ }

// -------------------- LOCAL STORAGE FALLBACK --------------------
function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { courses: [] };
    return JSON.parse(raw);
  } catch (e) { return { courses: [] }; }
}
function writeLocal(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){ console.warn(e); }
}

// -------------------- UI SELECTORS (fallbacks) --------------------
const SELECTORS = {
  loginForm: qs('#loginForm') || qs('#adminLoginForm') || null,
  loginEmail: qs('#loginEmail') || qs('#adminEmail') || null,
  loginPass: qs('#loginPass') || qs('#adminPass') || null,
  logoutBtn: qs('#btnLogout') || qs('#adminLogoutBtn') || null,
  adminRoot: qs('#adminContainer') || qs('#admin-app') || qs('.admin-app') || document.body,
  loginContainer: qs('#loginContainer') || qs('#adminLoginBox') || null,
  courseListContainers: [ qs('#courseList'), qs('#adminQuestionsList'), qs('#allCourses'), qs('#dashCourses') ].filter(Boolean),
  btnNewCourse: qs('#btnNewCourse') || qs('#newCourseBtn') || null,
  mainTitle: qs('#mainTitle') || null
};

// -------------------- UI: show/hide login & admin --------------------
function showOnlyLogin() {
  try {
    if (SELECTORS.loginContainer) SELECTORS.loginContainer.style.display = 'block';
    // hide admin elements that might be present
    if (SELECTORS.courseListContainers.length) SELECTORS.courseListContainers.forEach(c=> c.style.display='none');
    if (SELECTORS.adminRoot && SELECTORS.loginContainer) {
      // keep adminRoot visible only after login — we won't wipe whole body
      // if adminRoot equals body, do nothing
      if (SELECTORS.adminRoot !== document.body && SELECTORS.adminRoot !== document.documentElement) {
        SELECTORS.adminRoot.style.display = 'none';
      }
    }
  } catch(e){}
}
function showOnlyAdmin() {
  try {
    if (SELECTORS.loginContainer) SELECTORS.loginContainer.style.display = 'none';
    if (SELECTORS.adminRoot && SELECTORS.adminRoot !== document.body && SELECTORS.adminRoot !== document.documentElement) {
      SELECTORS.adminRoot.style.display = 'block';
    }
    if (SELECTORS.courseListContainers.length) SELECTORS.courseListContainers.forEach(c=> c.style.display='block');
  } catch(e){}
}

// -------------------- AUTH FLOW --------------------
async function attemptLogin(email, pass) {
  if (!email || !pass) { toast('Email & password wajib'); return; }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    // verify email
    if ((cred.user?.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      toast('Bukan akun admin', 'error');
      return;
    }
    toast('Login berhasil', 'success');
    // show admin and refresh
    showOnlyAdmin();
    await refreshAndRender();
  } catch (err) {
    console.error('login err', err);
    toast('Gagal login — periksa kredensial', 'error');
  }
}
if (SELECTORS.loginForm && SELECTORS.loginEmail && SELECTORS.loginPass) {
  SELECTORS.loginForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e = SELECTORS.loginEmail.value.trim();
    const p = SELECTORS.loginPass.value;
    attemptLogin(e, p);
  });
}

// logout wiring
if (SELECTORS.logoutBtn) {
  SELECTORS.logoutBtn.addEventListener('click', async () => {
    try { await signOut(auth); showOnlyLogin(); } catch(e){ console.warn(e); }
  });
}

// onAuthStateChanged: only allow ADMIN_EMAIL
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // not logged in
    showOnlyLogin();
    return;
  }
  const e = (user.email || '').toLowerCase();
  if (e !== ADMIN_EMAIL.toLowerCase()) {
    // not allowed
    try { await signOut(auth); } catch(e){ console.warn(e); }
    showOnlyLogin();
    return;
  }
  // allowed admin
  showOnlyAdmin();
  await refreshAndRender();
});

// -------------------- FIRESTORE HELPERS --------------------
async function fetchCoursesRemote() {
  try {
    const snap = await getDocs(collection(db, 'courses'));
    const arr = [];
    snap.forEach(d => {
      const data = d.data() || {};
      // normalize materi
      if (!Array.isArray(data.materi)) {
        if (Array.isArray(data.questions)) {
          data.materi = [{ id: makeId('m-'), title: 'Materi', description: data.description||'', questions: data.questions }];
          delete data.questions;
        } else data.materi = [];
      } else {
        data.materi = data.materi.map(m => ({ id: m.id || makeId('m-'), title: m.title||'Untitled', description: m.description||'', questions: Array.isArray(m.questions)?m.questions:[] }));
      }
      arr.push({ id: d.id, ...data });
    });
    return arr;
  } catch (err) {
    console.warn('fetchCoursesRemote failed', err);
    return null;
  }
}
async function saveCourseRemote(course) {
  try {
    const payload = { name: course.name || '', description: course.description || '', materi: course.materi || [], updatedAt: Timestamp.now() };
    if (!course.id || String(course.id).startsWith('local-')) {
      payload.createdAt = Timestamp.now();
      const ref = await addDoc(collection(db, 'courses'), payload);
      return { success:true, id: ref.id };
    } else {
      await updateDoc(doc(db, 'courses', course.id), payload);
      return { success:true, id: course.id };
    }
  } catch (err) {
    console.warn('saveCourseRemote failed', err);
    return { success:false };
  }
}
async function deleteCourseRemote(id) {
  try {
    await deleteDoc(doc(db, 'courses', id));
    return { success:true };
  } catch (err) {
    console.warn('deleteCourseRemote failed', err);
    return { success:false };
  }
}

// -------------------- STATE --------------------
let APP = { courses: [] };

// -------------------- RENDER COURSES (ADMIN) --------------------
function chooseCourseListContainer() {
  if (SELECTORS.courseListContainers.length) return SELECTORS.courseListContainers[0];
  // fallback create a simple container
  let c = qs('#courseListFallback');
  if (!c) {
    c = el('div', { id: 'courseListFallback' });
    if (SELECTORS.adminRoot && SELECTORS.adminRoot.appendChild) SELECTORS.adminRoot.appendChild(c);
  }
  return c;
}

async function refreshAndRender() {
  // fetch remote
  const remote = await fetchCoursesRemote();
  if (remote && Array.isArray(remote)) {
    APP.courses = remote;
  } else {
    const local = readLocal();
    APP.courses = local.courses || [];
  }
  renderDashboard();
  renderCoursesList();
}

function renderDashboard() {
  // try to update mainTitle if present
  if (SELECTORS.mainTitle) SELECTORS.mainTitle.textContent = 'Dashboard';
  // optional: show stats into dashCourses container if exists
  const dash = qs('#dashCourses') || qs('#adminDashboard') || null;
  if (!dash) return;
  dash.innerHTML = '';
  dash.appendChild(el('div', { class: 'wa-card' }, el('div', { html: `<strong>${APP.courses.length}</strong> Courses` })));
}

function renderCoursesList() {
  const cont = chooseCourseListContainer();
  cont.innerHTML = '';
  if (!APP.courses || APP.courses.length === 0) {
    cont.appendChild(el('div', { class: 'muted' }, 'Belum ada course.'));
    return;
  }
  APP.courses.forEach(c => cont.appendChild(courseRowElement(c)));
}

function courseRowElement(c) {
  const mCount = Array.isArray(c.materi) ? c.materi.length : 0;
  const qCount = Array.isArray(c.materi) ? c.materi.reduce((s,m)=> s + ((Array.isArray(m.questions)?m.questions.length:0)), 0) : 0;
  const box = el('div', { class: 'course-item', style: 'display:flex;justify-content:space-between;align-items:center;padding:10px;margin-bottom:8px' });
  box.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div style="width:44px;height:44px;border-radius:8px;background:rgba(0,0,0,0.06);display:grid;place-items:center">${escape((c.name||'C')[0])}</div><div><div style="font-weight:700">${escape(c.name)}</div><div class="muted">${mCount} materi • ${qCount} soal</div></div></div>`;
  const actions = el('div', {});
  const viewBtn = el('button', { class: 'btn ghost sm' }, 'View');
  const editBtn = el('button', { class: 'btn sm' }, 'Edit');
  const delBtn = el('button', { class: 'btn danger sm' }, 'Hapus');
  viewBtn.addEventListener('click', () => openCourseViewer(c));
  editBtn.addEventListener('click', () => openCourseEditor(c));
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Hapus course "${c.name}"?`)) return;
    // remote or local
    if (String(c.id).startsWith('local-')) {
      const local = readLocal();
      local.courses = (local.courses||[]).filter(x=> x.id !== c.id);
      writeLocal(local);
      toast('Course lokal dihapus');
      await refreshAndRender();
      return;
    }
    const res = await deleteCourseRemote(c.id);
    if (res.success) { toast('Course dihapus'); await refreshAndRender(); }
    else { toast('Gagal hapus remote, mencoba hapus lokal'); const local = readLocal(); local.courses = (local.courses||[]).filter(x=> x.id !== c.id); writeLocal(local); await refreshAndRender(); }
  });
  actions.appendChild(viewBtn);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  box.appendChild(actions);
  return box;
}

// -------------------- COURSE VIEWER (modal) --------------------
let modalRoot = null;
function openModal(x) {
  if (!modalRoot) { modalRoot = el('div', { id: 'wa_admin_modal' }); document.body.appendChild(modalRoot); }
  modalRoot.innerHTML = '';
  const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:grid;place-items:center;z-index:9999;padding:12px' });
  const card = el('div', { class: 'wa-card', style: 'width:100%;max-width:900px;max-height:90vh;overflow:auto;padding:16px;border-radius:10px' });
  card.appendChild(x);
  overlay.appendChild(card);
  modalRoot.appendChild(overlay);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) modalRoot.innerHTML = ''; });
  return { overlay, card };
}
function closeModal() { if (modalRoot) modalRoot.innerHTML = ''; }

function openCourseViewer(course) {
  const wrap = el('div');
  wrap.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, el('h3', {}, course.name || 'Untitled'), el('div', {}, el('button', { class: 'btn ghost sm', onclick: 'void(0)' }, 'Tutup')) ));
  wrap.appendChild(el('div', { style: 'padding:8px 0', html: `<div class="muted">${escape(course.description||'')}</div>` }));
  const list = el('div', {});
  (Array.isArray(course.materi)?course.materi:[]).forEach((m,i) => {
    const row = el('div',{ class: 'materi-row', style:'display:flex;justify-content:space-between;align-items:center;padding:8px;margin-bottom:8px;background:var(--card)' });
    row.innerHTML = `<div><div style="font-weight:700">${escape(m.title)}</div><div class="muted">${(Array.isArray(m.questions)?m.questions.length:0)} soal</div></div>`;
    const btn = el('button', { class: 'btn ghost sm' }, 'Lihat Soal');
    btn.addEventListener('click', () => {
      const qwrap = el('div');
      qwrap.appendChild(el('h4', {}, m.title));
      (m.questions||[]).forEach((q,ii) => qwrap.appendChild(el('div', { style:'padding:6px 0' , html: `<b>${ii+1}.</b> ${escape(q.question)} <div class="muted">Kunci: ${escape(q.correct||'')}</div>` })));
      const mm = openModal(qwrap);
    });
    row.appendChild(btn);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  const m = openModal(wrap);
  // close button wiring (first button with text 'Tutup')
  m.card.querySelectorAll('button').forEach(b => { if(b.textContent.trim().toLowerCase()==='tutup') b.onclick = () => closeModal(); });
}

// -------------------- COURSE EDITOR (modal) --------------------
function openCourseEditor(course = null) {
  const isEdit = !!course;
  let temp = isEdit ? JSON.parse(JSON.stringify(course)) : { id: makeId('local-'), name: '', description: '', materi: [] };
  if (!Array.isArray(temp.materi)) temp.materi = [];

  const wrap = el('div');
  wrap.appendChild(el('h3', {}, isEdit ? 'Edit Course' : 'Course Baru'));
  wrap.appendChild(el('label', { class: 'muted' }, 'Nama Mata Kuliah'));
  const nameIn = el('input', { value: temp.name || '' });
  wrap.appendChild(nameIn);
  wrap.appendChild(el('label', { class: 'muted' }, 'Deskripsi (opsional)'));
  const descIn = el('input', { value: temp.description || '' });
  wrap.appendChild(descIn);
  wrap.appendChild(el('hr', {}));
  const materiCount = el('div', {}, `Materi: ${ (temp.materi||[]).length }`);
  wrap.appendChild(materiCount);

  const listWrap = el('div', { style:'max-height:320px;overflow:auto;margin-top:8px' });
  wrap.appendChild(listWrap);

  const addMatBtn = el('button', { class: 'btn sm' }, '+ Materi Baru');
  wrap.appendChild(addMatBtn);

  const actions = el('div', { style:'display:flex;justify-content:flex-end;gap:8px;margin-top:12px' });
  const cancelBtn = el('button', { class: 'btn ghost' }, 'Batal');
  const saveBtn = el('button', { class: 'btn' }, 'Simpan Course');
  actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
  wrap.appendChild(actions);

  function renderMatList() {
    listWrap.innerHTML = '';
    (temp.materi||[]).forEach((m, idx) => {
      const item = el('div', { style:'display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;margin-bottom:6px;background:var(--card)' });
      item.innerHTML = `<div><div style="font-weight:700">${escape(m.title||'(Tanpa Judul)')}</div><div class="muted">${escape(m.description||'')} • ${(m.questions||[]).length} soal</div></div>`;
      const btns = el('div', {});
      const openBtn = el('button', { class: 'btn ghost sm' }, 'Buka');
      const editBtn = el('button', { class: 'btn sm' }, 'Edit');
      const delBtn = el('button', { class: 'btn danger sm' }, 'Hapus');
      openBtn.addEventListener('click', () => openMateriEditor(idx));
      editBtn.addEventListener('click', () => openMateriForm(idx));
      delBtn.addEventListener('click', () => {
        if (!confirm('Hapus materi ini?')) return;
        temp.materi.splice(idx,1);
        renderMatList();
        materiCount.textContent = `Materi: ${ (temp.materi||[]).length }`;
      });
      btns.appendChild(openBtn); btns.appendChild(editBtn); btns.appendChild(delBtn);
      item.appendChild(btns);
      listWrap.appendChild(item);
    });
  }

  function openMateriForm(index=null) {
    const isEditMat = index !== null;
    const mat = isEditMat ? JSON.parse(JSON.stringify(temp.materi[index])) : { id: makeId('m-'), title:'', description:'', questions: [] };
    const f = el('div', {});
    f.appendChild(el('h4', {}, isEditMat ? 'Edit Materi' : 'Tambah Materi'));
    f.appendChild(el('label', { class: 'muted' }, 'Judul Materi'));
    const titleIn = el('input', { value: mat.title || '' });
    f.appendChild(titleIn);
    f.appendChild(el('label', { class: 'muted' }, 'Deskripsi (opsional)'));
    const descInp = el('input', { value: mat.description || '' });
    f.appendChild(descInp);
    const btnWrap = el('div', { style:'display:flex;justify-content:flex-end;gap:8px;margin-top:8px' });
    const cancel = el('button', { class: 'btn ghost sm' }, 'Batal');
    const save = el('button', { class: 'btn sm' }, isEditMat ? 'Update' : 'Simpan');
    btnWrap.appendChild(cancel); btnWrap.appendChild(save);
    f.appendChild(btnWrap);
    const mmodal = openModal(f);
    cancel.onclick = () => closeModal();
    save.onclick = () => {
      const title = titleIn.value.trim();
      if (!title) return alert('Judul materi wajib.');
      mat.title = title; mat.description = descInp.value.trim();
      if (isEditMat) temp.materi[index] = mat; else temp.materi.push(mat);
      closeModal();
      renderMatList();
      materiCount.textContent = `Materi: ${ (temp.materi||[]).length }`;
    };
  }

  function openMateriEditor(index) {
    const mat = temp.materi[index];
    if (!mat) return alert('Materi tidak ditemukan');
    const wrapM = el('div', {});
    wrapM.appendChild(el('h3', {}, mat.title || 'Materi'));
    wrapM.appendChild(el('div', { class: 'muted', html: escape(mat.description||'') }));
    const qList = el('div', { style:'max-height:380px;overflow:auto;margin-top:8px' });
    (mat.questions||[]).forEach((q,qi) => {
      const row = el('div', { style:'padding:8px;margin-bottom:6px;border-radius:8px;background:var(--card);display:flex;justify-content:space-between;align-items:center' });
      row.innerHTML = `<div><div style="font-weight:600">${escape(q.question||'')}</div><div class="muted">Key: ${escape(q.correct||'')}</div></div>`;
      const actions = el('div', {});
      const editQ = el('button', { class: 'btn ghost sm' }, 'Edit');
      const delQ = el('button', { class: 'btn danger sm' }, 'Hapus');
      editQ.addEventListener('click', () => openQuestionForm(index, qi));
      delQ.addEventListener('click', () => { if(!confirm('Hapus soal ini?')) return; mat.questions.splice(qi,1); openMateriEditor(index); renderMatList(); });
      actions.appendChild(editQ); actions.appendChild(delQ);
      row.appendChild(actions);
      qList.appendChild(row);
    });
    const addQ = el('button', { class: 'btn sm', style:'margin-top:8px' }, '+ Tambah Soal');
    addQ.addEventListener('click', () => openQuestionForm(index, null));
    wrapM.appendChild(qList); wrapM.appendChild(addQ);
    const mmodal = openModal(wrapM);
  }

  function openQuestionForm(mIndex, qIndex = null) {
    const mat = temp.materi[mIndex];
    if (!mat) return alert('Materi not found');
    const isEditQ = qIndex !== null && mat.questions && mat.questions[qIndex];
    const qData = isEditQ ? JSON.parse(JSON.stringify(mat.questions[qIndex])) : { id: makeId('q-'), question:'', options:{A:'',B:'',C:'',D:''}, correct:'A', explanation:'' };
    const f = el('div', {});
    f.appendChild(el('h4', {}, isEditQ ? 'Edit Soal' : 'Tambah Soal'));
    f.appendChild(el('label', { class: 'muted' }, 'Pertanyaan'));
    const qText = el('textarea', { rows:3 }, qData.question || '');
    f.appendChild(qText);
    const grid = el('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px' });
    const ia = el('input', { placeholder:'Opsi A', value: qData.options?.A || '' });
    const ib = el('input', { placeholder:'Opsi B', value: qData.options?.B || '' });
    const ic = el('input', { placeholder:'Opsi C', value: qData.options?.C || '' });
    const idd = el('input', { placeholder:'Opsi D', value: qData.options?.D || '' });
    grid.appendChild(ia); grid.appendChild(ib); grid.appendChild(ic); grid.appendChild(idd);
    f.appendChild(grid);
    f.appendChild(el('label', { class: 'muted', style:'margin-top:8px' }, 'Jawaban Benar'));
    const sel = el('select', {});
    ['A','B','C','D'].forEach(o => sel.appendChild(el('option', { value:o }, o)));
    sel.value = qData.correct || 'A';
    f.appendChild(sel);
    f.appendChild(el('label', { class: 'muted' }, 'Penjelasan (opsional)'));
    const expl = el('input', { value: qData.explanation || '' });
    f.appendChild(expl);
    const actionsQ = el('div', { style:'display:flex;justify-content:flex-end;gap:8px;margin-top:8px' });
    const cancelQ = el('button', { class: 'btn ghost sm' }, 'Batal');
    const saveQ = el('button', { class: 'btn sm' }, isEditQ ? 'Update Soal' : 'Tambahkan Soal');
    actionsQ.appendChild(cancelQ); actionsQ.appendChild(saveQ);
    f.appendChild(actionsQ);
    const mm = openModal(f);
    cancelQ.onclick = () => closeModal();
    saveQ.onclick = () => {
      const txt = qText.value.trim();
      if (!txt) return alert('Pertanyaan wajib diisi');
      const newQ = {
        id: qData.id,
        question: txt,
        options: { A: ia.value.trim(), B: ib.value.trim(), C: ic.value.trim(), D: idd.value.trim() },
        correct: sel.value,
        explanation: expl.value.trim()
      };
      if (!newQ.options.A || !newQ.options.B) return alert('Minimal opsi A & B harus diisi');
      mat.questions = mat.questions || [];
      if (isEditQ) mat.questions[qIndex] = newQ; else mat.questions.push(newQ);
      closeModal();
      renderMatList();
    };
  }

  addMatBtn.addEventListener('click', () => openMateriForm(null));
  cancelBtn.addEventListener('click', () => closeModal());
  saveBtn.addEventListener('click', async () => {
    const name = nameIn.value.trim();
    if (!name) return alert('Nama course wajib diisi');
    saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
    const payload = { id: temp.id, name, description: descIn.value.trim(), materi: temp.materi || [] };
    // try save remote
    const res = await saveCourseRemote(payload);
    if (!res.success) {
      // fallback local
      const local = readLocal();
      if (!payload.id || String(payload.id).startsWith('local-')) payload.id = makeId('local-');
      const idx = (local.courses||[]).findIndex(x=> x.id === payload.id);
      if (idx >= 0) local.courses[idx] = payload; else local.courses.push(payload);
      writeLocal(local);
      toast('Disimpan ke local (remote error)', 'error');
    } else {
      toast('Berhasil disimpan', 'success');
    }
    closeModal();
    await refreshAndRender();
  });

  renderMatList();
  openModal(wrap);
}

// -------------------- UTIL: sort by name --------------------
function sortCourses(list) {
  return (list||[]).sort((a,b) => (a.name||'').localeCompare(b.name||''));
}

// -------------------- REFRESH & BOOT --------------------
async function refreshAndRender() {
  // fetch remote else local
  const remote = await fetchCoursesRemote();
  if (remote && Array.isArray(remote)) APP.courses = sortCourses(remote);
  else {
    const local = readLocal();
    APP.courses = sortCourses(local.courses || []);
  }
  renderDashboard();
  renderCoursesList();
}

// -------------------- THEME TOGGLE (simple) --------------------
function wireThemeToggle() {
  const t = qs('#themeToggle') || qs('#themeToggleAdmin') || null;
  if (!t) return;
  try {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', saved === 'dark');
    if (t.tagName && t.tagName.toLowerCase()==='input') t.checked = saved === 'dark';
    if (t.tagName && t.tagName.toLowerCase()==='button') t.textContent = saved === 'dark' ? '☀' : '☾';
  } catch(e){}
  t.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
    if (t.tagName && t.tagName.toLowerCase()==='button') t.textContent = isDark ? '☀' : '☾';
  });
}

// -------------------- INITIALIZE UI --------------------
document.addEventListener('DOMContentLoaded', () => {
  // always start with login visible
  showOnlyLogin();
  wireThemeToggle();

  // wire "New Course" buttons if any present on page
  const newBtn = SELECTORS.btnNewCourse || qs('#newCourse') || null;
  if (newBtn) newBtn.addEventListener('click', () => openCourseEditor(null));

  // if login form not present, but user may manually be signed in (onAuthStateChanged handles)
  // try refresh if already logged-in and admin
  // onAuthStateChanged will call refreshAndRender for authorized admin
});
