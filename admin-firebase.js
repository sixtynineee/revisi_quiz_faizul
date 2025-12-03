// admin-firebase.js — Full revised (matches: mata_kuliah -> materi subcollection; soal collection; auth gated admin)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, getDoc, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/* ---------- CONFIG: ganti dengan milik Anda jika perlu ---------- */
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

/* ---------- DOM helpers (defensive) ---------- */
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel || ''));
const safe = v => (v === undefined || v === null) ? '' : String(v);

/* ---------- Expected DOM ids in admin.html (from your provided template) ---------- */
const coursesView = $('coursesView');
const coursesAdminList = $('coursesAdminList');
const addCourseBtn = $('addCourseBtn');

const materiPanel = $('materiPanel');
const materiList = $('materiList');
const materiCourseTitle = $('materiCourseTitle');
const addMateriBtn = $('addMateriBtn');

const soalPanel = $('soalPanel');
const soalList = $('soalList');
const soalMateriTitle = $('soalMateriTitle');
const addSoalBtn = $('addSoalBtn');

const loginForm = $('loginForm');
const loginEmail = $('loginEmail');
const loginPass = $('loginPass');

const logoutWrap = $('logoutWrap');
const signedEmail = $('signedEmail');
const btnLogout = $('btnLogout');

const themeBtn = $('themeBtnAdmin');
const themeCheckbox = $('themeToggleAdmin');

/* ---------- Local state ---------- */
let selectedCourseId = null;   // mata_kuliah doc id
let selectedMateriId = null;   // materi doc id (when using materi subcollection)
let selectedCourseName = '';   // cache course name for display

/* ---------- Small UI utilities ---------- */
function toast(msg, type='info') {
  try {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.position = 'fixed';
    t.style.right = '20px';
    t.style.top = '20px';
    t.style.padding = '8px 12px';
    t.style.color = '#fff';
    t.style.borderRadius = '8px';
    t.style.zIndex = 99999;
    t.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#16a34a' : '#0b74de');
    document.body.appendChild(t);
    setTimeout(()=> t.style.opacity = '0', 2200);
    setTimeout(()=> t.remove(), 2600);
  } catch(e){ console.warn(e); }
}
function hideAllPanelsInitial() {
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
  if (loginForm) loginForm.style.display = 'block';
}
function showAdminUI(user) {
  if (loginForm) loginForm.style.display = 'none';
  if (coursesView) coursesView.style.display = 'flex';
  if (logoutWrap) logoutWrap.style.display = 'block';
  if (signedEmail) signedEmail.textContent = user.email || user.uid || '';
}
function showLoginUIOnly() {
  if (loginForm) loginForm.style.display = 'block';
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
}

/* ---------- THEME fixes (preserve dark/light) ---------- */
function applyThemeFromStorage() {
  try {
    const saved = localStorage.getItem('theme') || 'light';
    const isDark = saved === 'dark';
    document.body.classList.toggle('dark', isDark);
    if (themeCheckbox && themeCheckbox.tagName === 'INPUT') themeCheckbox.checked = isDark;
    if (themeBtn) themeBtn.textContent = isDark ? '☀' : '☾';
  } catch(e){/* ignore */ }
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

/* ---------- ADMIN CHECK ----------
   - Prefer users/{uid}.role === 'admin'
   - Fallback: admins/{uid} or admins/{email} doc exists
*/
async function checkIsAdmin(user) {
  if (!user) return false;
  try {
    // 1) users/{uid} with role
    try {
      const uDoc = await getDoc(doc(db, 'users', user.uid));
      if (uDoc.exists()) {
        const data = uDoc.data() || {};
        if (data.role && String(data.role).toLowerCase() === 'admin') return true;
      }
    } catch(_) {}
    // 2) admins/{uid}
    try {
      const a1 = await getDoc(doc(db, 'admins', user.uid));
      if (a1.exists()) return true;
    } catch(_) {}
    // 3) admins/{email}
    if (user.email) {
      try {
        const a2 = await getDoc(doc(db, 'admins', user.email));
        if (a2.exists()) return true;
      } catch(_) {}
    }
    return false;
  } catch(e){
    console.warn('checkIsAdmin error', e);
    return false;
  }
}

/* ---------- AUTH wiring ---------- */
if (loginForm) {
  loginForm.addEventListener('submit', async (ev)=> {
    ev.preventDefault();
    const email = (loginEmail?.value || '').trim();
    const pass = (loginPass?.value || '');
    if (!email || !pass) { toast('Email & password harus diisi','error'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will run next
    } catch (err) {
      console.error('login error', err);
      toast('Gagal login: ' + (err.message || err.code), 'error');
    }
  });
}
if (btnLogout) {
  btnLogout.addEventListener('click', async ()=> {
    try {
      await signOut(auth);
      toast('Logout berhasil','success');
      showLoginUIOnly();
    } catch(e){ console.warn(e); toast('Logout gagal','error'); }
  });
}

/* ---------- LOAD COURSES (collection: mata_kuliah) ---------- */
async function loadCourses() {
  if (!coursesAdminList) return;
  coursesAdminList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    const q = query(collection(db, 'mata_kuliah'), orderBy('createdAt','desc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      coursesAdminList.innerHTML = `<div class="muted">Belum ada mata kuliah.</div>`;
      return;
    }
    coursesAdminList.innerHTML = '';
    snap.forEach(docSnap => {
      const d = docSnap.data() || {};
      const id = docSnap.id;
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(d.nama || d.name || '')}</div>
          <div class="muted" style="font-size:12px">${safe(d.deskripsi || d.description || '')}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${id}">Materi</button>
          <button class="btn ghost sm" data-edit="${id}">✎</button>
          <button class="btn ghost sm" data-del="${id}">🗑</button>
        </div>
      `;
      // handlers
      const openBtn = item.querySelector('[data-open]');
      openBtn?.addEventListener('click', () => openMateri(id, safe(d.nama || d.name || '')));

      const editBtn = item.querySelector('[data-edit]');
      editBtn?.addEventListener('click', async ()=> {
        const newName = prompt('Edit nama mata kuliah:', safe(d.nama || d.name || ''));
        if (!newName) return;
        try {
          await updateDoc(doc(db, 'mata_kuliah', id), { nama: newName, name: newName });
          toast('Tersimpan','success');
          loadCourses();
        } catch(e) { console.error(e); toast('Gagal update','error'); }
      });

      const delBtn = item.querySelector('[data-del]');
      delBtn?.addEventListener('click', async ()=> {
        if (!confirm('Hapus mata kuliah ini? Semua subcollection materi & soal akan dihapus.')) return;
        try {
          // delete materi subcollection documents (and their soal)
          const mq = query(collection(db, 'mata_kuliah', id, 'materi'));
          const msnap = await getDocs(mq);
          for (const mdoc of msnap.docs) {
            // delete soal referencing this materi
            const soalQ = query(collection(db, 'soal'), where('materiId','==', mdoc.id));
            const ssnap = await getDocs(soalQ);
            for (const s of ssnap.docs) {
              await deleteDoc(doc(db, 'soal', s.id));
            }
            await deleteDoc(doc(db, 'mata_kuliah', id, 'materi', mdoc.id));
          }
          // delete course doc
          await deleteDoc(doc(db, 'mata_kuliah', id));
          toast('Mata kuliah dihapus','success');
          loadCourses();
        } catch(e){ console.error(e); toast('Gagal hapus','error'); }
      });

      coursesAdminList.appendChild(item);
    });
  } catch(e){
    console.error('loadCourses', e);
    coursesAdminList.innerHTML = `<div class="muted">Gagal memuat mata kuliah.</div>`;
  }
}

/* ---------- OPEN MATERI (subcollection under mata_kuliah) ---------- */
async function openMateri(courseId, courseName='') {
  selectedCourseId = courseId;
  selectedCourseName = courseName;
  selectedMateriId = null;
  if (materiCourseTitle) materiCourseTitle.textContent = `Materi — ${courseName || ''}`;
  if (materiPanel) materiPanel.style.display = 'block';
  if (soalPanel) soalPanel.style.display = 'none';
  if (!materiList) return;

  materiList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    const mq = query(collection(db, 'mata_kuliah', courseId, 'materi'), orderBy('createdAt','desc'));
    const msnap = await getDocs(mq);
    if (msnap.empty) {
      materiList.innerHTML = `<div class="muted">Belum ada materi.</div>`;
      return;
    }
    materiList.innerHTML = '';
    msnap.forEach(docSnap => {
      const d = docSnap.data() || {};
      const mid = docSnap.id;
      const node = document.createElement('div');
      node.className = 'admin-item';
      node.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(d.judul || d.title || '')}</div>
          <div class="muted" style="font-size:12px">${safe(d.isi || d.description || d.desc || '')}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${mid}">Soal</button>
          <button class="btn ghost sm" data-edit="${mid}">✎</button>
          <button class="btn ghost sm" data-del="${mid}">🗑</button>
        </div>
      `;
      // handlers
      node.querySelector('[data-open]')?.addEventListener('click', () => openSoal(mid, safe(d.judul || d.title || '')));
      node.querySelector('[data-edit]')?.addEventListener('click', async ()=> {
        const newTitle = prompt('Edit judul materi:', safe(d.judul || d.title || ''));
        if (!newTitle) return;
        try {
          await updateDoc(doc(db, 'mata_kuliah', courseId, 'materi', mid), { judul: newTitle, title: newTitle });
          toast('Materi terupdate','success');
          openMateri(courseId, courseName);
        } catch(e){ console.error(e); toast('Gagal update materi','error'); }
      });
      node.querySelector('[data-del]')?.addEventListener('click', async ()=> {
        if (!confirm('Hapus materi ini?')) return;
        try {
          // delete soal referencing this materi
          const soalQ = query(collection(db, 'soal'), where('materiId','==', mid));
          const ssnap = await getDocs(soalQ);
          for (const s of ssnap.docs) {
            await deleteDoc(doc(db, 'soal', s.id));
          }
          await deleteDoc(doc(db, 'mata_kuliah', courseId, 'materi', mid));
          toast('Materi dihapus','success');
          openMateri(courseId, courseName);
        } catch(e){ console.error(e); toast('Gagal hapus materi','error'); }
      });

      materiList.appendChild(node);
    });
  } catch(e){
    console.error('openMateri', e);
    materiList.innerHTML = `<div class="muted">Gagal memuat materi.</div>`;
  }
}

/* ---------- OPEN SOAL (top-level collection 'soal') ---------- */
async function openSoal(materiId, materiTitle='') {
  selectedMateriId = materiId;
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${materiTitle || ''}`;
  if (soalPanel) soalPanel.style.display = 'block';
  if (!soalList) return;

  soalList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    const q = query(collection(db, 'soal'), where('materiId','==', materiId), orderBy('createdAt','desc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      soalList.innerHTML = `<div class="muted">Belum ada soal.</div>`;
      return;
    }
    soalList.innerHTML = '';
    snap.forEach(docSnap => {
      const d = docSnap.data() || {};
      const sid = docSnap.id;
      const node = document.createElement('div');
      node.className = 'admin-item';
      node.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(d.question || d.pertanyaan || d.text || '')}</div>
          <div class="muted" style="font-size:12px">Kunci: ${safe(d.correct || d.kunci || '')}</div>
        </div>
        <div class="admin-actions">
          <button class="btn ghost sm" data-edit="${sid}">✎</button>
          <button class="btn ghost sm" data-del="${sid}">🗑</button>
        </div>
      `;
      node.querySelector('[data-edit]')?.addEventListener('click', async ()=> {
        const newQ = prompt('Edit soal:', safe(d.question || d.pertanyaan || ''));
        if (!newQ) return;
        const newCorrect = prompt('Jawaban benar (A/B/C/D atau teks):', safe(d.correct || d.kunci || ''));
        if (newCorrect === null) return;
        try {
          await updateDoc(doc(db, 'soal', sid), { question: newQ, correct: newCorrect });
          toast('Soal terupdate','success');
          openSoal(materiId, materiTitle);
        } catch(e){ console.error(e); toast('Gagal update soal','error'); }
      });
      node.querySelector('[data-del]')?.addEventListener('click', async ()=> {
        if (!confirm('Hapus soal ini?')) return;
        try {
          await deleteDoc(doc(db, 'soal', sid));
          toast('Soal dihapus','success');
          openSoal(materiId, materiTitle);
        } catch(e){ console.error(e); toast('Gagal hapus soal','error'); }
      });

      soalList.appendChild(node);
    });
  } catch(e){
    console.error('openSoal', e);
    soalList.innerHTML = `<div class="muted">Gagal memuat soal.</div>`;
  }
}

/* ---------- ADD handlers (defensive) ---------- */
if (addCourseBtn) {
  addCourseBtn.addEventListener('click', async ()=> {
    const nama = prompt('Nama mata kuliah:');
    if (!nama) return;
    try {
      await addDoc(collection(db, 'mata_kuliah'), { nama, description: '', createdAt: Date.now() });
      toast('Mata kuliah ditambahkan','success');
      loadCourses();
    } catch(e){ console.error(e); toast('Gagal tambah mata kuliah','error'); }
  });
}
if (addMateriBtn) {
  addMateriBtn.addEventListener('click', async ()=> {
    if (!selectedCourseId) { toast('Pilih mata kuliah dahulu','error'); return; }
    const judul = prompt('Judul materi:');
    if (!judul) return;
    const isi = prompt('Deskripsi / isi singkat (opsional):') || '';
    try {
      await addDoc(collection(db, 'mata_kuliah', selectedCourseId, 'materi'), {
        judul, isi, createdAt: Date.now()
      });
      toast('Materi ditambahkan','success');
      openMateri(selectedCourseId, selectedCourseName);
    } catch(e){ console.error(e); toast('Gagal tambah materi','error'); }
  });
}
if (addSoalBtn) {
  addSoalBtn.addEventListener('click', async ()=> {
    if (!selectedMateriId) { toast('Pilih materi dahulu','error'); return; }
    const teks = prompt('Teks soal:');
    if (!teks) return;
    const correct = prompt('Jawaban benar (A/B/C/D atau teks):') || '';
    // optional: ask for options A-D
    let options = null;
    const wantOpts = confirm('Apakah soal memiliki pilihan (A/B/C/D)? Tekan OK jika ya.');
    if (wantOpts) {
      const A = prompt('Opsi A:') || '';
      const B = prompt('Opsi B:') || '';
      const C = prompt('Opsi C:') || '';
      const D = prompt('Opsi D:') || '';
      options = { A, B, C, D };
    }
    try {
      await addDoc(collection(db, 'soal'), {
        materiId: selectedMateriId,
        question: teks,
        options: options || {},
        correct,
        createdAt: Date.now()
      });
      toast('Soal ditambahkan','success');
      openSoal(selectedMateriId, soalMateriTitle?.textContent.replace('Soal — ', '') || '');
    } catch(e){ console.error(e); toast('Gagal tambah soal','error'); }
  });
}

/* ---------- AUTH STATE WATCHER (gating) ---------- */
onAuthStateChanged(auth, async (user)=> {
  // ensure theme & initial hides
  applyThemeFromStorage();
  wireThemeControls();
  if (!user) {
    showLoginUIOnly();
    return;
  }
  // check admin permission
  const ok = await checkIsAdmin(user);
  if (!ok) {
    toast('Akun tidak memiliki akses admin','error');
    try { await signOut(auth); } catch(_) {}
    showLoginUIOnly();
    return;
  }
  // ok -> show admin UI and initialize
  showAdminUI(user);
  // hide panels until user navigates
  if (coursesView) coursesView.style.display = 'flex';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  // load courses
  loadCourses();
});

/* ---------- Boot: hide admin UI initially ---------- */
document.addEventListener('DOMContentLoaded', ()=> {
  hideAllPanelsInitial();
  applyThemeFromStorage();
  wireThemeControls();
});
