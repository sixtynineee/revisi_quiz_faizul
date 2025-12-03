// admin-firebase.js (REVISI: auth gating + fallback materi embedded + theme fix)
// Firebase Modular SDK (auth + firestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  getDocs, updateDoc, query, orderBy, where, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/* ---------- CONFIG FIREBASE ---------- */
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
const auth = getAuth(app);

/* ---------- ELEMENT HELPERS (defensive) ---------- */
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const safeText = v => (v === undefined || v === null) ? '' : String(v);
const toast = (msg, type='info') => {
  // simple toast
  let t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.right = '20px';
  t.style.top = '20px';
  t.style.background = (type==='error') ? '#ef4444' : (type==='success' ? '#16a34a' : '#0b74de');
  t.style.color = '#fff';
  t.style.padding = '8px 12px';
  t.style.borderRadius = '8px';
  t.style.zIndex = 99999;
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity = '0', 2400);
  setTimeout(()=> t.remove(), 2800);
};

/* ---------- UI elements expected in admin.html (defensive checks) ---------- */
const coursesView = $('coursesView');
const coursesAdminList = $('coursesAdminList');
const btnAddCourse = $('addCourseBtn');

const materiPanel = $('materiPanel');
const materiList = $('materiList');
const materiCourseTitle = $('materiCourseTitle');
const btnAddMateri = $('addMateriBtn');

const soalPanel = $('soalPanel');
const soalList = $('soalList');
const soalMateriTitle = $('soalMateriTitle');
const btnAddSoal = $('addSoalBtn');

// login controls in sidebar
const loginForm = $('loginForm');
const loginEmail = $('loginEmail');
const loginPass = $('loginPass');
const logoutWrap = $('logoutWrap');
const signedEmail = $('signedEmail');
const btnLogout = $('btnLogout');

// theme controls
const themeBtn = $('themeBtnAdmin');
const themeCheckbox = $('themeToggleAdmin');

let selectedCourseId = null;
let selectedMateriId = null;

// ---------- THEME — restore & wire (robust) ----------
function applyThemeFromStorage() {
  try {
    const saved = localStorage.getItem('theme') || 'light';
    const isDark = saved === 'dark';
    document.body.classList.toggle('dark', isDark);
    if (themeCheckbox && themeCheckbox.tagName === 'INPUT') themeCheckbox.checked = isDark;
    if (themeBtn) themeBtn.textContent = isDark ? '☀' : '☾';
  } catch (e) { /* ignore */ }
}
function wireThemeControls() {
  applyThemeFromStorage();
  if (themeCheckbox && themeCheckbox.tagName === 'INPUT') {
    themeCheckbox.addEventListener('change', () => {
      const isDark = !!themeCheckbox.checked;
      document.body.classList.toggle('dark', isDark);
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
      if (themeBtn) themeBtn.textContent = isDark ? '☀' : '☾';
    });
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
      themeBtn.textContent = isDark ? '☀' : '☾';
    });
  }
}
// ensure contrast small fixes (applied once)
function applyContrastFixes() {
  const sheetId = 'admin-contrast-fixes';
  if (document.getElementById(sheetId)) return;
  const s = document.createElement('style'); s.id = sheetId;
  s.textContent = `
    body.dark .admin-item { background: rgba(255,255,255,0.03); color: var(--text); border-color: rgba(255,255,255,0.04); }
    body.dark .muted { color: var(--muted); }
    body.dark .admin-actions .btn { border-color: rgba(255,255,255,0.06); color: var(--text); }
  `;
  document.head.appendChild(s);
}

/* ---------- AUTH gating + admin-check ---------- */
async function isAdminUser(user) {
  if (!user) return false;
  try {
    // try check admins collection by uid
    const uidDoc = await getDoc(doc(db, "admins", user.uid));
    if (uidDoc.exists()) return true;
    // try check by email as doc id (some setups store email as doc id)
    const emailDoc = await getDoc(doc(db, "admins", user.email || ''));
    if (emailDoc.exists()) return true;
    // no match
    return false;
  } catch (e) {
    console.warn('isAdminUser error', e);
    return false;
  }
}

function showOnlyLoginUI() {
  // hide main admin content areas but keep sidebar login visible
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
  if (loginForm) loginForm.style.display = 'block';
}
function showAdminUIForUser(user) {
  if (coursesView) coursesView.style.display = 'flex';
  if (loginForm) loginForm.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'block';
  if (signedEmail) signedEmail.textContent = user.email || user.uid;
}

/* ---------- AUTH actions wiring (login/logout) ---------- */
if (loginForm) {
  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = (loginEmail?.value || '').trim();
    const pass = (loginPass?.value || '');
    if (!email || !pass) { toast('Email & password wajib diisi','error'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle UI and admin-check
    } catch (err) {
      console.error('login error', err);
      toast('Gagal login: ' + (err.message || err.code), 'error');
    }
  });
}
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    try {
      await signOut(auth);
      toast('Logout sukses','success');
    } catch (e) {
      console.warn(e);
    }
  });
}

/* ---------- Firestore read helpers with fallback ---------- */

// loadCourses: list course docs (order by createdAt desc if available)
async function loadCourses() {
  if (!coursesAdminList) return;
  coursesAdminList.innerHTML = `<p class="muted">Memuat...</p>`;
  try {
    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) {
      coursesAdminList.innerHTML = `<p class="muted">Belum ada mata kuliah.</p>`;
      return;
    }
    coursesAdminList.innerHTML = '';
    snap.forEach(docSnap => {
      const d = docSnap.data() || {};
      const root = document.createElement('div');
      root.className = 'admin-item';
      root.innerHTML = `
        <div>
          <div style="font-weight:600">${safeText(d.name)}</div>
          <div class="muted" style="font-size:12px">${safeText(d.description || d.desc || '')}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${docSnap.id}">Materi</button>
          <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
          <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
        </div>
      `;
      // event bindings (defensive)
      const openBtn = root.querySelector('[data-open]');
      if (openBtn) openBtn.addEventListener('click', () => openMateri(docSnap.id, safeText(d.name)));
      const editBtn = root.querySelector('[data-edit]');
      if (editBtn) editBtn.addEventListener('click', async () => {
        const newName = prompt('Nama Mata Kuliah:', safeText(d.name));
        if (!newName) return;
        try { await updateDoc(doc(db, 'courses', docSnap.id), { name: newName }); toast('Terupdate','success'); loadCourses(); }
        catch(e){ toast('Gagal update','error'); console.error(e); }
      });
      const delBtn = root.querySelector('[data-del]');
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm('Hapus mata kuliah ini? Semua materi & soal akan dihapus.')) return;
        try {
          // delete materi docs referencing this course (if exist)
          const materiQ = query(collection(db, 'materi'), where('courseId', '==', docSnap.id));
          const materiSnap = await getDocs(materiQ);
          for (const m of materiSnap.docs) {
            // delete soal per materi
            const soalQ = query(collection(db, 'soal'), where('materiId', '==', m.id));
            const soalSnap = await getDocs(soalQ);
            for (const s of soalSnap.docs) { await deleteDoc(doc(db, 'soal', s.id)); }
            await deleteDoc(doc(db, 'materi', m.id));
          }
          // lastly delete course doc
          await deleteDoc(doc(db, 'courses', docSnap.id));
          toast('Course dihapus','success');
          loadCourses();
        } catch(e) { console.error(e); toast('Gagal hapus','error'); }
      });

      coursesAdminList.appendChild(root);
    });
  } catch (e) {
    console.error('loadCourses error', e);
    coursesAdminList.innerHTML = `<p class="muted">Gagal memuat mata kuliah.</p>`;
  }
}

// openMateri: try collection 'materi' first; fallback to embedded materi[]
async function openMateri(courseId, courseName) {
  selectedCourseId = courseId;
  selectedMateriId = null;
  if (materiCourseTitle) materiCourseTitle.textContent = `Materi — ${courseName || ''}`;
  if (materiPanel) materiPanel.style.display = 'block';
  if (soalPanel) soalPanel.style.display = 'none';
  if (!materiList) return;

  materiList.innerHTML = `<p class="muted">Memuat...</p>`;
  try {
    // try separate materi collection
    const mq = query(collection(db, 'materi'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'));
    const msnap = await getDocs(mq);
    if (!msnap.empty) {
      renderMateriFromDocs(msnap.docs);
      return;
    }
    // fallback: read course doc and use embedded materi array
    const courseDocRef = doc(db, 'courses', courseId);
    const cSnap = await getDoc(courseDocRef);
    if (!cSnap.exists()) { materiList.innerHTML = `<p class="muted">Course tidak ditemukan.</p>`; return; }
    const courseData = cSnap.data() || {};
    const arr = Array.isArray(courseData.materi) ? courseData.materi : [];
    if (arr.length === 0) { materiList.innerHTML = `<p class="muted">Belum ada materi.</p>`; return; }
    // render embedded materi
    materiList.innerHTML = '';
    arr.forEach((m, idx) => {
      const root = document.createElement('div'); root.className = 'admin-item';
      root.innerHTML = `
        <div>
          <div style="font-weight:600">${safeText(m.title)}</div>
          <div class="muted" style="font-size:12px">${safeText(m.description || '')}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open-emb="${idx}">Soal</button>
          <button class="btn ghost sm" data-edit-emb="${idx}">✎</button>
          <button class="btn ghost sm" data-del-emb="${idx}">🗑</button>
        </div>
      `;
      // open embedded soal: use courseData.materi[idx].questions
      root.querySelector('[data-open-emb]').addEventListener('click', () => {
        // when using embedded structure we pass identifiers (courseId + index)
        openSoalEmbedded(courseId, idx, m.title, courseData);
      });
      root.querySelector('[data-edit-emb]').addEventListener('click', async () => {
        const newTitle = prompt('Judul Materi:', safeText(m.title));
        if (!newTitle) return;
        m.title = newTitle;
        // update course doc with modified materi array
        try { await updateDoc(courseDocRef, { materi: courseData.materi }); toast('Materi terupdate','success'); openMateri(courseId, courseName); }
        catch(e){ console.error(e); toast('Gagal update materi','error'); }
      });
      root.querySelector('[data-del-emb]').addEventListener('click', async () => {
        if (!confirm('Hapus materi ini?')) return;
        courseData.materi.splice(idx,1);
        try { await updateDoc(courseDocRef, { materi: courseData.materi }); toast('Materi dihapus','success'); openMateri(courseId, courseName); }
        catch(e){ console.error(e); toast('Gagal hapus materi','error'); }
      });

      materiList.appendChild(root);
    });
  } catch (e) {
    console.error('openMateri error', e);
    materiList.innerHTML = `<p class="muted">Gagal memuat materi.</p>`;
  }
}

function renderMateriFromDocs(docArray) {
  materiList.innerHTML = '';
  docArray.forEach(docSnap => {
    const d = docSnap.data() || {};
    const root = document.createElement('div'); root.className = 'admin-item';
    root.innerHTML = `
      <div>
        <div style="font-weight:600">${safeText(d.title)}</div>
        <div class="muted" style="font-size:12px">${safeText(d.desc || '')}</div>
      </div>
      <div class="admin-actions">
        <button class="btn sm" data-open="${docSnap.id}">Soal</button>
        <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
        <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
      </div>
    `;
    const openBtn = root.querySelector('[data-open]');
    if (openBtn) openBtn.addEventListener('click', () => openSoal(docSnap.id, safeText(d.title)));
    const editBtn = root.querySelector('[data-edit]');
    if (editBtn) editBtn.addEventListener('click', async () => {
      const newTitle = prompt('Judul Materi:', safeText(d.title));
      if (!newTitle) return;
      try { await updateDoc(doc(db, 'materi', docSnap.id), { title: newTitle }); toast('Materi terupdate','success'); loadMateri(selectedCourseId); }
      catch(e){ console.error(e); toast('Gagal update materi','error'); }
    });
    const delBtn = root.querySelector('[data-del]');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm('Hapus materi ini?')) return;
      try {
        // delete soal documents for this materi (if any)
        const soalQ = query(collection(db, 'soal'), where('materiId','==', docSnap.id));
        const soalSnap = await getDocs(soalQ);
        for (const s of soalSnap.docs) { await deleteDoc(doc(db,'soal', s.id)); }
        await deleteDoc(doc(db, 'materi', docSnap.id));
        toast('Materi dihapus','success');
        loadMateri(selectedCourseId);
      } catch(e){ console.error(e); toast('Gagal hapus materi','error'); }
    });

    materiList.appendChild(root);
  });
}

// ---------- SOAL: support both collection-based and embedded ----------
async function openSoal(materiId, title) {
  selectedMateriId = materiId;
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${title || ''}`;
  if (soalPanel) soalPanel.style.display = 'block';
  if (!soalList) return;
  soalList.innerHTML = `<p class="muted">Memuat...</p>`;
  try {
    // try collection 'soal'
    const q = query(collection(db, 'soal'), where('materiId','==', materiId), orderBy('createdAt','desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      soalList.innerHTML = '';
      snap.forEach(docSnap => {
        const d = docSnap.data() || {};
        const root = document.createElement('div'); root.className = 'admin-item';
        root.innerHTML = `
          <div>
            <div style="font-weight:600">${safeText(d.question)}</div>
            <div class="muted" style="font-size:12px">Jawaban benar: ${safeText(d.correct)}</div>
          </div>
          <div class="admin-actions">
            <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
            <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
          </div>
        `;
        const editBtn = root.querySelector('[data-edit]');
        if (editBtn) editBtn.addEventListener('click', async () => {
          const newQ = prompt('Soal:', safeText(d.question));
          if (!newQ) return;
          const newCorrect = prompt('Jawaban benar:', safeText(d.correct));
          if (!newCorrect) return;
          try { await updateDoc(doc(db,'soal', docSnap.id), { question:newQ, correct:newCorrect }); toast('Soal terupdate','success'); loadSoal(materiId); }
          catch(e){ console.error(e); toast('Gagal update soal','error'); }
        });
        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.addEventListener('click', async () => {
          if (!confirm('Hapus soal?')) return;
          try { await deleteDoc(doc(db,'soal', docSnap.id)); toast('Soal dihapus','success'); loadSoal(materiId); }
          catch(e){ console.error(e); toast('Gagal hapus soal','error'); }
        });
        soalList.appendChild(root);
      });
      return;
    }

    // fallback: find materi inside courses collection (embedded)
    // attempt to find course doc that has this materi id as index or as id field
    // scan courses for embedded materi containing id equal materiId OR index-based (caller may pass index)
    const coursesQ = query(collection(db, 'courses'), orderBy('createdAt','desc'));
    const courseSnap = await getDocs(coursesQ);
    let found = false;
    courseSnap.forEach(cDoc => {
      if (found) return;
      const cData = cDoc.data() || {};
      const arr = Array.isArray(cData.materi) ? cData.materi : [];
      // try find by materiId matching an 'id' field in embedded objek
      arr.forEach((m, idx) => {
        if (found) return;
        // match by id or by numeric index passed as string
        if ((m.id && String(m.id) === String(materiId)) || String(idx) === String(materiId)) {
          found = true;
          const questions = Array.isArray(m.questions) ? m.questions : [];
          renderEmbeddedSoal(questions, cDoc.ref, arr, idx);
        }
      });
    });
    if (!found) {
      soalList.innerHTML = `<p class="muted">Belum ada soal.</p>`;
    }
  } catch (e) {
    console.error('openSoal error', e);
    soalList.innerHTML = `<p class="muted">Gagal memuat soal.</p>`;
  }
}

function renderEmbeddedSoal(questions, courseDocRef, materiasArray, matiIndex) {
  soalList.innerHTML = '';
  if (questions.length === 0) {
    soalList.innerHTML = `<p class="muted">Belum ada soal (embedded).</p>`;
    return;
  }
  questions.forEach((q, idx) => {
    const root = document.createElement('div'); root.className = 'admin-item';
    root.innerHTML = `
      <div>
        <div style="font-weight:600">${safeText(q.question)}</div>
        <div class="muted" style="font-size:12px">Jawaban benar: ${safeText(q.correct)}</div>
      </div>
      <div class="admin-actions">
        <button class="btn ghost sm" data-edit="${idx}">✎</button>
        <button class="btn ghost sm" data-del="${idx}">🗑</button>
      </div>
    `;
    const editBtn = root.querySelector('[data-edit]');
    editBtn.addEventListener('click', async () => {
      const newQ = prompt('Soal:', safeText(q.question));
      if (!newQ) return;
      const newCorrect = prompt('Jawaban benar:', safeText(q.correct));
      if (!newCorrect) return;
      // update embedded array and write back full materi array to course doc
      materiasArray[matiIndex].questions[idx].question = newQ;
      materiasArray[matiIndex].questions[idx].correct = newCorrect;
      try { await updateDoc(courseDocRef, { materi: materiasArray }); toast('Soal terupdate','success'); openMateri(selectedCourseId, (materiCourseTitle?.textContent||'')); }
      catch(e){ console.error(e); toast('Gagal update soal embedded','error'); }
    });
    const delBtn = root.querySelector('[data-del]');
    delBtn.addEventListener('click', async () => {
      if (!confirm('Hapus soal?')) return;
      materiasArray[matiIndex].questions.splice(idx,1);
      try { await updateDoc(courseDocRef, { materi: materiasArray }); toast('Soal dihapus','success'); openMateri(selectedCourseId, (materiCourseTitle?.textContent||'')); }
      catch(e){ console.error(e); toast('Gagal hapus soal embedded','error'); }
    });
    soalList.appendChild(root);
  });
}

// helper when opening embedded soal from openMateri (index-based)
function openSoalEmbedded(courseId, materiIndex, title, courseData) {
  selectedMateriId = materiIndex; // store index (string/number)
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${title || ''}`;
  if (soalPanel) soalPanel.style.display = 'block';
  // courseData contains full materi array and questions
  const questions = (courseData && Array.isArray(courseData.materi) && courseData.materi[materiIndex]) ? (courseData.materi[materiIndex].questions || []) : [];
  renderEmbeddedSoal(questions, doc(db,'courses', courseId), courseData.materi || [], materiIndex);
}

/* ---------- add handlers for add buttons (defensive) ---------- */
if (btnAddCourse) {
  btnAddCourse.addEventListener('click', async () => {
    const name = prompt('Nama Mata Kuliah:');
    if (!name) return;
    try {
      await addDoc(collection(db,'courses'), { name, createdAt: Date.now() });
      toast('Course ditambahkan','success');
      loadCourses();
    } catch(e){ console.error(e); toast('Gagal tambah course','error'); }
  });
}
if (btnAddMateri) {
  btnAddMateri.addEventListener('click', async () => {
    const title = prompt('Judul Materi:');
    if (!title) return;
    try {
      // prefer separate collection materi; but if no selectedCourseId fallback to embed into course doc
      if (selectedCourseId) {
        await addDoc(collection(db,'materi'), { courseId: selectedCourseId, title, createdAt: Date.now() });
        toast('Materi ditambahkan','success');
        loadMateri(selectedCourseId);
      } else toast('Pilih course terlebih dahulu','error');
    } catch(e){ console.error(e); toast('Gagal tambah materi','error'); }
  });
}
if (btnAddSoal) {
  btnAddSoal.addEventListener('click', async () => {
    const question = prompt('Teks soal:');
    if (!question) return;
    const correct = prompt('Jawaban benar:');
    if (!correct) return;
    try {
      // if selectedMateriId references a materi doc id (string not numeric) -> use collection
      if (selectedMateriId !== null && selectedMateriId !== undefined) {
        // determine if selectedMateriId is numeric index (embedded) or doc id by trying to fetch materi doc
        try {
          const mDoc = await getDoc(doc(db, 'materi', String(selectedMateriId)));
          if (mDoc.exists()) {
            // normalized collection-based
            await addDoc(collection(db,'soal'), { materiId: String(selectedMateriId), question, correct, createdAt: Date.now() });
            toast('Soal ditambahkan','success');
            loadSoal(String(selectedMateriId));
            return;
          }
        } catch(_) {/* ignore */}
        // fallback: treat selectedMateriId as embedded index -> fetch course doc and push into array
        // find course doc which contains that embedded materi index
        const coursesQ = query(collection(db, 'courses'));
        const snap = await getDocs(coursesQ);
        let written = false;
        for (const c of snap.docs) {
          const cd = c.data() || {};
          if (!Array.isArray(cd.materi)) continue;
          const idx = Number(selectedMateriId);
          if (!Number.isNaN(idx) && cd.materi[idx]) {
            cd.materi[idx].questions = cd.materi[idx].questions || [];
            cd.materi[idx].questions.push({ question, options: {}, correct, explanation: '', id: 'q-'+Date.now() });
            await updateDoc(doc(db,'courses', c.id), { materi: cd.materi });
            toast('Soal ditambahkan (embedded)','success');
            openMateri(c.id, cd.name || '');
            written = true;
            break;
          }
        }
        if (!written) toast('Gagal menambah soal (materi tidak ditemukan)','error');
      } else {
        toast('Pilih materi terlebih dahulu','error');
      }
    } catch(e){ console.error(e); toast('Gagal tambah soal','error'); }
  });
}

/* ---------- AUTH state watcher (gating) ---------- */
onAuthStateChanged(auth, async (user) => {
  applyThemeFromStorage();
  applyContrastFixes();
  if (!user) {
    // not logged in -> show login area only
    showOnlyLoginUI();
    return;
  }
  // check admin permission
  const ok = await isAdminUser(user);
  if (!ok) {
    // not admin -> sign out and show login again
    try { await signOut(auth); } catch(e){ console.warn(e); }
    toast('Akun bukan administrator', 'error');
    showOnlyLoginUI();
    return;
  }
  // is admin -> show UI
  showAdminUIForUser(user);
  // init admin content
  try { loadCourses(); } catch(e){ console.warn(e); }
});

/* ---------- boot on DOM ready ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // theme wiring
  wireThemeControls();
  applyContrastFixes();
  // ensure panels hidden initially (safety)
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  // if auth already logged in, onAuthStateChanged will trigger
});
