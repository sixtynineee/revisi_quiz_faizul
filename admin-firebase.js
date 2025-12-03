// admin-firebase.js
// Single-file admin panel script (Revisi v2). Requires style.css present.
// Provides: Firebase Auth, Full Firestore CRUD (Courses + Questions Management), Local fallback.

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
const qsa = s => document.querySelectorAll(s);
const escapeHTML = str => str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));

// ----------------------- Local storage helpers -----------------------
function readLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  try { return JSON.parse(raw); } catch (e) { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA)); return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}
function writeLocalData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
const makeId = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

// ----------------------- Firestore wrappers -----------------------
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
    // Clean undefined/null values
    const payload = { 
        name: course.name, 
        description: course.description || '', 
        questions: course.questions || [], 
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

// ----------------------- UI Injection -----------------------
function injectStylesIfMissing() {
  if (document.getElementById('admin-inline-styles')) return;
  const s = document.createElement('style');
  s.id = 'admin-inline-styles';
  s.textContent = `
    body { margin:0; font-family: Inter, system-ui, -apple-system, sans-serif; background:var(--bg, #f0f2f5); color:var(--text, #111b21); }
    .wa-root { display:flex; min-height:100vh; gap:18px; padding:18px; }
    .wa-sidebar{ width:280px; background: #fff; border-radius:12px; padding:16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); height:fit-content; }
    .wa-main{ flex:1; display:flex; flex-direction:column; gap:18px; }
    .wa-card{ background:#fff; border-radius:12px; padding:20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.03); }
    .muted{ color:#667781; font-size:13px; }
    .menu button{ display:block; width:100%; text-align:left; margin-bottom:4px; padding:10px 12px; border-radius:8px; border:0; background:transparent; cursor:pointer; font-weight:500; color:#41525d; transition:0.2s; }
    .menu button:hover{ background:#f5f6f6; }
    .menu button.active{ background:#e9edef; color:#111b21; }
    .course-item{ display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:8px; background:#f0f2f5; margin-bottom:8px; border:1px solid transparent; }
    .course-item:hover{ border-color:#d1d7db; }
    input,textarea,select{ width:100%; padding:10px; border-radius:8px; border:1px solid #d1d7db; margin-bottom:8px; box-sizing:border-box; font-family:inherit; }
    input:focus,textarea:focus{ outline:none; border-color:#00a884; }
    .btn { padding:8px 16px; border-radius:24px; cursor:pointer; background:#008069; color:white; border:0; font-weight:600; font-size:14px; transition:0.2s; }
    .btn:hover { background:#006d59; }
    .btn.ghost { background:transparent; color:#008069; border:1px solid #d1d7db; }
    .btn.ghost:hover { background:#f0f2f5; }
    .btn.danger { background:#ef4444; color:white; }
    .btn.sm { padding: 4px 10px; font-size:12px; }
    .badge { width:40px; height:40px; border-radius:50%; background:#e9edef; display:grid; place-items:center; font-weight:700; color:#008069; flex-shrink:0; }
    
    /* Q List in Editor */
    .q-row { background:#fff; padding:10px; border:1px solid #e9edef; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:flex-start; }
    
    @media (max-width:900px){ .wa-root{ flex-direction:column; padding:10px } .wa-sidebar{ width:100%; box-sizing:border-box; } }
  `;
  document.head.appendChild(s);
}

function buildShell() {
  injectStylesIfMissing();
  document.body.innerHTML = '';
  const root = el('div', { class: 'wa-root' });
  const sidebar = el('aside', { class: 'wa-sidebar' });
  const main = el('main', { class: 'wa-main' });

  sidebar.append(
    el('div', { class: 'brand', style:'margin-bottom:20px;display:flex;align-items:center;gap:12px', html: `<div class="badge" style="background:#008069;color:white">A</div><div><div style="font-weight:700;font-size:16px">Admin Panel</div><div class="muted">Quiz Manager</div></div>` }),
    el('div', { id:"authBox", html: `<div id="adminInfo" style="font-weight:600;margin-bottom:8px">Checking...</div><form id="loginForm"><input id="loginEmail" placeholder="Email" type="email"/><input id="loginPass" placeholder="Password" type="password"/><button class="btn" style="width:100%" type="submit">Login</button></form><button id="btnLogout" class="btn ghost" style="width:100%;display:none">Logout</button>` }),
    el('hr', { style:'border:0;border-top:1px solid #e9edef;margin:16px 0' }),
    el('div', { class: 'menu', id: 'leftMenu', html: `<button data-view="dashboard" class="active">📊 Dashboard</button><button data-view="courses">📚 Mata Kuliah</button><button data-view="peserta">👥 Peserta</button><button data-view="skor">🏆 Skor</button>` })
  );

  main.append(
    el('div', { class:'wa-topbar wa-card', style:'padding:14px;display:flex;justify-content:space-between;align-items:center', html: `<div><h2 id="mainTitle" style="margin:0;font-size:18px">Dashboard</h2></div><div><button id="btnRefresh" class="btn ghost sm">↻ Refresh</button> <button id="btnNewCourse" class="btn sm">+ Course Baru</button></div>` }),
    el('section', { id:'mainContent', class:'wa-card', style:'flex:1', html: `<div id="contentInner">Memuat data...</div>` })
  );

  root.append(sidebar, main);
  document.body.appendChild(root);

  // Events
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

// ----------------------- App State -----------------------
let APP = { user:null, courses:[], participants:[], scores:[] };

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

// ----------------------- Render Functions -----------------------
function renderDashboard(container) {
  const ccount = APP.courses.length;
  const qcount = APP.courses.reduce((t,c)=> t + (Array.isArray(c.questions)?c.questions.length:0),0);
  const pcount = APP.participants.length;
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px">
        <div style="background:#e7f5f2;padding:16px;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:700;color:#008069">${ccount}</div><div class="muted">Courses</div></div>
        <div style="background:#e7f5f2;padding:16px;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:700;color:#008069">${qcount}</div><div class="muted">Total Soal</div></div>
        <div style="background:#e7f5f2;padding:16px;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:700;color:#008069">${pcount}</div><div class="muted">Peserta</div></div>
    </div>
    <h4>Course Terbaru</h4>
    <div id="dashCourses"></div>
  `;
  const list = qs('#dashCourses');
  APP.courses.slice(0,5).forEach(c => list.appendChild(createCourseRow(c)));
}

function renderCourses(container) {
  container.innerHTML = `<div id="allCourses"></div>`;
  const list = qs('#allCourses');
  if(APP.courses.length === 0) { list.innerHTML = '<div class="muted">Belum ada course.</div>'; return; }
  APP.courses.forEach(c => list.appendChild(createCourseRow(c)));
}

function createCourseRow(c) {
  const div = el('div', { class: 'course-item' });
  const qLen = (c.questions||[]).length;
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
        <div class="badge">${(c.name||'C')[0].toUpperCase()}</div>
        <div><div style="font-weight:600">${escapeHTML(c.name)}</div><div class="muted">${qLen} soal • ${c.description?escapeHTML(c.description):'-'}</div></div>
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

// ----------------------- MODAL EDITOR (REVISED) -----------------------
let modalRoot = null;
function openModal(contentEl) {
  if (!modalRoot) { modalRoot = el('div', { id:'wa_modal_root' }); document.body.appendChild(modalRoot); }
  modalRoot.innerHTML = ''; 
  const overlay = el('div', { style:'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9990;display:grid;place-items:center;padding:20px;backdrop-filter:blur(2px)' });
  const box = el('div', { class:'wa-card', style:'width:100%;max-width:700px;max-height:90vh;overflow-y:auto;position:relative' });
  box.appendChild(contentEl);
  overlay.appendChild(box);
  modalRoot.appendChild(overlay);
  
  // Close on click outside
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
    <div style="background:#f0f2f5;padding:12px;border-radius:8px;margin-bottom:12px">${escapeHTML(course.description||'No desc')}</div>
    <div id="v_q_list"></div>
  `;
  const list = wrap.querySelector('#v_q_list');
  (course.questions||[]).forEach((q, i) => {
    list.innerHTML += `<div class="q-row"><div><b>${i+1}. ${escapeHTML(q.question)}</b><br/><span class="muted">Ans: ${q.correct}</span></div></div>`;
  });
  wrap.querySelector('#v_close').onclick = closeModal;
  openModal(wrap);
}

// *** KEY REVISION: BETTER EDITOR LOGIC ***
function openCourseEditor(course=null) {
  const isEdit = !!course;
  // Deep copy questions to avoid mutating state directly before save
  let tempQuestions = isEdit && course.questions ? JSON.parse(JSON.stringify(course.questions)) : [];

  const wrap = el('div');
  wrap.innerHTML = `
    <h3 style="margin-top:0">${isEdit ? 'Edit Course' : 'Course Baru'}</h3>
    <label class="muted">Nama Mata Kuliah</label>
    <input id="ce_name" value="${isEdit?escapeHTML(course.name):''}" />
    <label class="muted">Deskripsi</label>
    <input id="ce_desc" value="${isEdit?escapeHTML(course.description||''):''}" />
    
    <hr style="border:0;border-top:1px solid #ddd;margin:16px 0"/>
    
    <div style="display:flex;justify-content:space-between;align-items:center">
        <h4 style="margin:0">Daftar Soal (<span id="q_count">0</span>)</h4>
        <button id="btn_clear_form" class="btn ghost sm" style="display:none">Batal Edit Soal</button>
    </div>

    <div style="background:#f7f9fa;padding:12px;border-radius:8px;margin-top:10px;border:1px solid #e9edef">
        <label class="muted">Pertanyaan</label>
        <textarea id="q_text" rows="2" placeholder="Tulis pertanyaan..."></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input id="q_a" placeholder="Opsi A" /> <input id="q_b" placeholder="Opsi B" />
            <input id="q_c" placeholder="Opsi C" /> <input id="q_d" placeholder="Opsi D" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:4px">
            <div><label class="muted">Jawaban Benar</label><select id="q_correct"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
            <div><label class="muted">Penjelasan (Opsional)</label><input id="q_explain" placeholder="Kenapa jawabannya itu?" /></div>
        </div>
        <div style="text-align:right;margin-top:8px">
            <button id="btn_add_q" class="btn sm">Tambahkan Soal</button>
        </div>
    </div>

    <div id="ce_q_list" style="margin-top:16px;max-height:300px;overflow-y:auto"></div>

    <div style="margin-top:20px;text-align:right;display:flex;gap:10px;justify-content:flex-end">
        <button id="ce_cancel" class="btn ghost">Batal</button>
        <button id="ce_save" class="btn">Simpan Course</button>
    </div>
  `;

  // Elements Refs
  const qListEl = wrap.querySelector('#ce_q_list');
  const countEl = wrap.querySelector('#q_count');
  const inputs = {
      text: wrap.querySelector('#q_text'),
      a: wrap.querySelector('#q_a'), b: wrap.querySelector('#q_b'),
      c: wrap.querySelector('#q_c'), d: wrap.querySelector('#q_d'),
      correct: wrap.querySelector('#q_correct'), explain: wrap.querySelector('#q_explain')
  };
  
  // Render List Logic
  const renderList = () => {
      qListEl.innerHTML = '';
      countEl.textContent = tempQuestions.length;
      tempQuestions.forEach((q, idx) => {
          const row = el('div', { class:'q-row' });
          row.innerHTML = `
            <div style="flex:1">
                <div style="font-weight:600;font-size:14px">${idx+1}. ${escapeHTML(q.question)}</div>
                <div class="muted" style="font-size:12px">Key: ${q.correct} | Opts: ${Object.values(q.options).join(', ')}</div>
            </div>
            <div style="display:flex;gap:4px;margin-left:8px">
                <button class="btn ghost sm" data-act="edit_q">Edit</button>
                <button class="btn danger sm" style="padding:4px 8px" data-act="del_q">✕</button>
            </div>
          `;
          // Edit Question Click
          row.querySelector('[data-act="edit_q"]').onclick = () => {
             // Populate form
             inputs.text.value = q.question;
             inputs.a.value = q.options.A; inputs.b.value = q.options.B;
             inputs.c.value = q.options.C; inputs.d.value = q.options.D;
             inputs.correct.value = q.correct;
             inputs.explain.value = q.explanation || '';
             // Remove from temp list so user can re-add update
             tempQuestions.splice(idx, 1);
             renderList();
             wrap.querySelector('#btn_add_q').textContent = "Update Soal";
             wrap.querySelector('#btn_clear_form').style.display = 'block';
             inputs.text.focus();
          };
          // Delete Question Click
          row.querySelector('[data-act="del_q"]').onclick = () => {
              if(confirm('Hapus soal ini?')) {
                  tempQuestions.splice(idx, 1);
                  renderList();
              }
          };
          qListEl.appendChild(row);
      });
  };

  // Add Question Logic
  wrap.querySelector('#btn_add_q').onclick = () => {
      const qVal = inputs.text.value.trim();
      if(!qVal) return alert('Pertanyaan wajib diisi');
      
      const newQ = {
          id: makeId('q-'),
          question: qVal,
          options: { 
             A: inputs.a.value.trim(), B: inputs.b.value.trim(), 
             C: inputs.c.value.trim(), D: inputs.d.value.trim() 
          },
          correct: inputs.correct.value,
          explanation: inputs.explain.value.trim()
      };
      
      // Basic validation: ensure at least 2 options
      if(!newQ.options.A || !newQ.options.B) return alert('Minimal Opsi A dan B harus diisi');

      tempQuestions.push(newQ);
      renderList();
      
      // Reset form
      Object.values(inputs).forEach(i => i.value = (i.tagName==='SELECT'?'A':''));
      wrap.querySelector('#btn_add_q').textContent = "Tambahkan Soal";
      wrap.querySelector('#btn_clear_form').style.display = 'none';
  };

  wrap.querySelector('#btn_clear_form').onclick = () => {
      Object.values(inputs).forEach(i => i.value = (i.tagName==='SELECT'?'A':''));
      wrap.querySelector('#btn_add_q').textContent = "Tambahkan Soal";
      wrap.querySelector('#btn_clear_form').style.display = 'none';
  };

  // Save Whole Course Logic
  wrap.querySelector('#ce_save').onclick = async () => {
      const name = wrap.querySelector('#ce_name').value.trim();
      if(!name) return alert('Nama course harus diisi');
      
      wrap.querySelector('#ce_save').textContent = 'Menyimpan...';
      wrap.querySelector('#ce_save').disabled = true;

      const payload = {
          id: isEdit ? course.id : undefined,
          name: name,
          description: wrap.querySelector('#ce_desc').value.trim(),
          questions: tempQuestions
      };

      // Try Remote Save
      let res = await saveCourseRemote(payload);
      
      if(!res.success) {
          // Fallback Local
          const local = readLocalData();
          if(isEdit && String(course.id).startsWith('local-')) {
             const idx = local.courses.findIndex(x=>x.id === course.id);
             if(idx >= 0) local.courses[idx] = { ...local.courses[idx], ...payload };
          } else if (!isEdit) {
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

  renderList();
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
  } catch(e) {}
  
  try {
      const sSnap = await getDocs(collection(db, 'scores'));
      APP.scores = []; sSnap.forEach(d=> APP.scores.push(d.data()));
  } catch(e) {}

  const active = qs('.menu button.active')?.dataset.view || 'dashboard';
  await renderView(active);
}

// ----------------------- Auth Logic -----------------------
async function handleLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const ok = await isAdminUid(cred.user.uid);
    if (!ok) { await signOut(auth); toast('Bukan akun Admin!', 'error'); return; }
    toast('Login Berhasil', 'success');
  } catch (err) {
    console.error(err); toast('Gagal Login', 'error');
  }
}
async function handleLogout() { await signOut(auth); location.reload(); }

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const ok = await isAdminUid(user.uid);
    if(ok) {
        APP.user = user;
        qs('#authBox').innerHTML = `<div style="margin-bottom:8px">Hi, <b>${user.email}</b></div>`;
        qs('#btnLogout').style.display = 'block';
        refreshAndRender();
    } else {
        await signOut(auth);
    }
  } else {
    APP.user = null;
    qs('#authBox').innerHTML = `<div id="adminInfo" style="font-weight:600;margin-bottom:8px">Admin Login</div><form id="loginForm"><input id="loginEmail" placeholder="Email" type="email"/><input id="loginPass" placeholder="Password" type="password"/><button class="btn" style="width:100%" type="submit">Login</button></form>`;
    qs('#loginForm').addEventListener('submit', async (ev) => { ev.preventDefault(); await handleLogin(qs('#loginEmail').value.trim(), qs('#loginPass').value); });
  }
});

// ----------------------- Boot -----------------------
document.addEventListener('DOMContentLoaded', () => {
    buildShell();
    refreshAndRender();
});
