// admin-firebase.js — FULL FINAL (single-file, copy-paste)
// - Auth (no role check)
// - Auto-detect root courses collection ('courses' or 'mata_kuliah')
// - Supports embedded materi[] OR materi subcollection
// - Soal stored in top-level 'soal' collection (compatible with user.js 'courses' structure)
// - Add/Edit/Delete for course, materi, soal
// - Theme toggle preserved
// Requires: admin.html (ids used in this script) and Firebase config

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, getDoc,
  query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/* ---------- CONFIG (use your project's config) ---------- */
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

/* ---------- DOM helpers ---------- */
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel || ''));
const safe = v => (v === undefined || v === null) ? '' : String(v);

/* ---------- DOM refs expected in admin.html ---------- */
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
let selectedCourseId = null;
let selectedMateriId = null;
let selectedCourseName = '';
let ROOT_COLLECTION = null; // 'courses' or 'mata_kuliah'

/* ---------- UI small helpers ---------- */
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
    setTimeout(()=> t.style.opacity = '0', 2000);
    setTimeout(()=> t.remove(), 2400);
  } catch(e){ console.warn(e); }
}
function hideAllAdminPanels() {
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
}
function showLoginOnly() {
  hideAllAdminPanels();
  if (loginForm) loginForm.style.display = 'block';
}
function showAdminUI(user) {
  if (loginForm) loginForm.style.display = 'none';
  if (coursesView) coursesView.style.display = 'flex';
  if (logoutWrap) logoutWrap.style.display = 'block';
  if (signedEmail) signedEmail.textContent = user.email || user.uid || '';
}

/* ---------- Theme wiring ---------- */
function applyThemeFromStorage() {
  try {
    const saved = localStorage.getItem('theme') || 'light';
    const isDark = saved === 'dark';
    document.body.classList.toggle('dark', isDark);
    if (themeCheckbox && themeCheckbox.tagName === 'INPUT') themeCheckbox.checked = isDark;
    if (themeBtn) themeBtn.textContent = isDark ? '☀' : '☾';
  } catch(e){}
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
      if (themeCheckbox && themeCheckbox.tagName === 'INPUT') themeCheckbox.checked = isDark;
      themeBtn.textContent = isDark ? '☀' : '☾';
    });
  }
}

/* ---------- Detect root collection (courses vs mata_kuliah) ---------- */
async function determineRootCollection() {
  try {
    const cSnap = await getDocs(query(collection(db, 'courses'), orderBy('createdAt','desc')));
    if (!cSnap.empty) { ROOT_COLLECTION = 'courses'; return ROOT_COLLECTION; }
  } catch(e){ /* ignore */ }
  try {
    const mSnap = await getDocs(query(collection(db, 'mata_kuliah'), orderBy('createdAt','desc')));
    if (!mSnap.empty) { ROOT_COLLECTION = 'mata_kuliah'; return ROOT_COLLECTION; }
  } catch(e){ /* ignore */ }
  // default to 'courses' for compatibility with user.js
  ROOT_COLLECTION = 'courses';
  return ROOT_COLLECTION;
}

/* ---------- COURSES: load, add, edit, delete ---------- */
async function loadCourses() {
  if (!coursesAdminList) return;
  coursesAdminList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    if (!ROOT_COLLECTION) await determineRootCollection();
    const q = query(collection(db, ROOT_COLLECTION), orderBy('createdAt','desc'));
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
      // name fields might be 'name' or 'nama', description 'desc'/'description'/'deskripsi'
      const nameVal = d.name || d.nama || '';
      const descVal = d.description || d.desc || d.deskripsi || '';
      item.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(nameVal)}</div>
          <div class="muted" style="font-size:12px">${safe(descVal)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${id}">Materi</button>
          <button class="btn ghost sm" data-edit="${id}">✎</button>
          <button class="btn ghost sm" data-del="${id}">🗑</button>
        </div>
      `;

      const openBtn = item.querySelector('[data-open]');
      openBtn?.addEventListener('click', () => openMateri(id, nameVal));

      const editBtn = item.querySelector('[data-edit]');
      editBtn?.addEventListener('click', async () => {
        const newName = prompt('Edit nama mata kuliah:', nameVal);
        if (!newName) return;
        const newDesc = prompt('Edit deskripsi (opsional):', descVal || '') || '';
        const updateObj = {};
        // write fields matching existing shape if possible
        if (d.name !== undefined || ROOT_COLLECTION === 'courses') {
          updateObj.name = newName;
          updateObj.description = newDesc;
        } else {
          updateObj.nama = newName;
          updateObj.deskripsi = newDesc;
        }
        try {
          await updateDoc(doc(db, ROOT_COLLECTION, id), updateObj);
          toast('Mata kuliah diperbarui', 'success');
          loadCourses();
        } catch(e){ console.error(e); toast('Gagal update', 'error'); }
      });

      const delBtn = item.querySelector('[data-del]');
      delBtn?.addEventListener('click', async () => {
        if (!confirm('Hapus mata kuliah ini? Semua materi & soal akan dihapus.')) return;
        try {
          // delete materi subcollection if exists
          const materiRef = collection(db, ROOT_COLLECTION, id, 'materi');
          const matSnap = await getDocs(materiRef);
          for (const m of matSnap.docs) {
            // delete soal that points to this materi id
            const soalQ = query(collection(db, 'soal'), where('materiId','==', m.id));
            const soalSnap = await getDocs(soalQ);
            for (const s of soalSnap.docs) {
              await deleteDoc(doc(db, 'soal', s.id));
            }
            // delete materi doc
            await deleteDoc(doc(db, ROOT_COLLECTION, id, 'materi', m.id));
          }
          // Also attempt to delete embedded materi array if present (no direct easy delete; skip)
          // delete course doc
          await deleteDoc(doc(db, ROOT_COLLECTION, id));
          toast('Mata kuliah dihapus', 'success');
          loadCourses();
        } catch(e){ console.error(e); toast('Gagal hapus', 'error'); }
      });

      coursesAdminList.appendChild(item);
    });

  } catch(e){
    console.error(e);
    coursesAdminList.innerHTML = `<div class="muted">Gagal memuat mata kuliah.</div>`;
  }
}

addCourseBtn?.addEventListener('click', async () => {
  try {
    const name = prompt('Nama mata kuliah:');
    if (!name) return;
    const desc = prompt('Deskripsi (opsional):') || '';
    if (!ROOT_COLLECTION) await determineRootCollection();
    await addDoc(collection(db, ROOT_COLLECTION), {
      name,
      description: desc,
      createdAt: Date.now()
    });
    toast('Mata kuliah ditambahkan', 'success');
    loadCourses();
  } catch(e){ console.error(e); toast('Gagal tambah', 'error'); }
});

/* ---------- MATERI: open, add, edit, delete
   Supports:
   - subcollection: ROOT_COLLECTION/{courseId}/materi/{materiId}
   - fallback embedded array: courseDoc.materi (not created/edited here except when explicit)
*/ 
async function openMateri(courseId, courseName='') {
  selectedCourseId = courseId;
  selectedCourseName = courseName || '';
  selectedMateriId = null;
  if (materiCourseTitle) materiCourseTitle.textContent = `Materi — ${selectedCourseName || ''}`;
  if (materiPanel) materiPanel.style.display = 'block';
  if (soalPanel) soalPanel.style.display = 'none';
  if (!materiList) return;

  materiList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    // Try subcollection first
    const mq = query(collection(db, ROOT_COLLECTION, courseId, 'materi'), orderBy('createdAt','desc'));
    const msnap = await getDocs(mq);
    if (!msnap.empty) {
      materiList.innerHTML = '';
      msnap.forEach(docSnap => {
        const d = docSnap.data() || {};
        const mid = docSnap.id;
        const node = document.createElement('div');
        node.className = 'admin-item';
        const title = d.judul || d.title || '';
        const isi = d.isi || d.description || d.desc || '';
        node.innerHTML = `
          <div>
            <div style="font-weight:600">${safe(title)}</div>
            <div class="muted" style="font-size:12px">${safe(isi)}</div>
          </div>
          <div class="admin-actions">
            <button class="btn sm" data-open="${mid}">Soal</button>
            <button class="btn ghost sm" data-edit="${mid}">✎</button>
            <button class="btn ghost sm" data-del="${mid}">🗑</button>
          </div>
        `;
        node.querySelector('[data-open]')?.addEventListener('click', () => {
          selectedMateriId = mid;
          openSoal(mid, title);
        });
        node.querySelector('[data-edit]')?.addEventListener('click', async () => {
          const newTitle = prompt('Edit judul materi:', title || '');
          if (!newTitle) return;
          const newIsi = prompt('Edit isi materi (opsional):', isi || '') || '';
          try {
            // write fields as used
            const updateObj = {};
            updateObj.judul = newTitle;
            updateObj.isi = newIsi;
            // also set title/description to be safe for other consumers
            updateObj.title = newTitle;
            updateObj.description = newIsi;
            await updateDoc(doc(db, ROOT_COLLECTION, courseId, 'materi', mid), updateObj);
            toast('Materi diperbarui', 'success');
            openMateri(courseId, selectedCourseName);
          } catch(e){ console.error(e); toast('Gagal update materi', 'error'); }
        });
        node.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!confirm('Hapus materi ini? Daftar soal akan dihapus juga.')) return;
          try {
            // delete soal referencing this materi
            const soalQ = query(collection(db, 'soal'), where('materiId','==', mid));
            const ssnap = await getDocs(soalQ);
            for (const s of ssnap.docs) await deleteDoc(doc(db, 'soal', s.id));
            // delete materi doc
            await deleteDoc(doc(db, ROOT_COLLECTION, courseId, 'materi', mid));
            toast('Materi dihapus', 'success');
            openMateri(courseId, selectedCourseName);
          } catch(e){ console.error(e); toast('Gagal hapus materi', 'error'); }
        });

        materiList.appendChild(node);
      });
      return;
    }

    // Fallback: check embedded materi array inside course doc
    const courseRef = doc(db, ROOT_COLLECTION, courseId);
    const cSnap = await getDoc(courseRef);
    if (!cSnap.exists()) {
      materiList.innerHTML = `<div class="muted">Course tidak ditemukan.</div>`;
      return;
    }
    const courseData = cSnap.data() || {};
    const embedded = Array.isArray(courseData.materi) ? courseData.materi : [];
    if (embedded.length === 0) {
      materiList.innerHTML = `<div class="muted">Belum ada materi.</div>`;
      return;
    }
    materiList.innerHTML = '';
    embedded.forEach((m, idx) => {
      const title = m.title || m.judul || '';
      const isi = m.description || m.isi || m.desc || '';
      const node = document.createElement('div');
      node.className = 'admin-item';
      node.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(title)}</div>
          <div class="muted" style="font-size:12px">${safe(isi)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open-emb="${idx}">Soal</button>
          <button class="btn ghost sm" data-edit-emb="${idx}">✎</button>
          <button class="btn ghost sm" data-del-emb="${idx}">🗑</button>
        </div>
      `;
      node.querySelector('[data-open-emb]')?.addEventListener('click', () => {
        selectedMateriId = String(idx); // index-based reference
        // pass courseData so openSoalEmbedded can use it
        openSoalEmbedded(courseId, idx, title, courseData);
      });
      node.querySelector('[data-edit-emb]')?.addEventListener('click', async () => {
        const newTitle = prompt('Edit judul materi (embedded):', title || '');
        if (!newTitle) return;
        const newIsi = prompt('Edit isi materi (embedded):', isi || '') || '';
        try {
          embedded[idx].title = newTitle;
          embedded[idx].description = newIsi;
          await updateDoc(courseRef, { materi: embedded });
          toast('Materi embedded diperbarui', 'success');
          openMateri(courseId, selectedCourseName);
        } catch(e){ console.error(e); toast('Gagal update embedded', 'error'); }
      });
      node.querySelector('[data-del-emb]')?.addEventListener('click', async () => {
        if (!confirm('Hapus materi embedded ini?')) return;
        try {
          embedded.splice(idx, 1);
          await updateDoc(courseRef, { materi: embedded });
          toast('Materi embedded dihapus', 'success');
          openMateri(courseId, selectedCourseName);
        } catch(e){ console.error(e); toast('Gagal hapus embedded', 'error'); }
      });

      materiList.appendChild(node);
    });

  } catch(e){ console.error(e); materiList.innerHTML = `<div class="muted">Gagal memuat materi.</div>`; }
}

addMateriBtn?.addEventListener('click', async () => {
  try {
    if (!selectedCourseId) return toast('Pilih mata kuliah terlebih dahulu', 'error');
    const judul = prompt('Judul materi:');
    if (!judul) return;
    const isi = prompt('Isi materi (opsional):') || '';
    // Prefer subcollection
    // create materi doc under ROOT_COLLECTION/{courseId}/materi
    await addDoc(collection(db, ROOT_COLLECTION, selectedCourseId, 'materi'), {
      judul,
      isi,
      title: judul,
      description: isi,
      createdAt: Date.now()
    });
    toast('Materi ditambahkan', 'success');
    openMateri(selectedCourseId, selectedCourseName);
  } catch(e){ console.error(e); toast('Gagal tambah materi', 'error'); }
});

/* ---------- SOAL: open, add, edit, delete ----------
   Soal is top-level collection with field materiId referencing materi doc id or embedded index.
*/
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
      const qtext = d.question || d.pertanyaan || d.text || '';
      const correct = d.correct || d.kunci || '';
      node.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(qtext)}</div>
          <div class="muted" style="font-size:12px">Kunci: ${safe(correct)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn ghost sm" data-edit="${sid}">✎</button>
          <button class="btn ghost sm" data-del="${sid}">🗑</button>
        </div>
      `;
      node.querySelector('[data-edit]')?.addEventListener('click', async () => {
        const newQ = prompt('Edit teks soal:', qtext);
        if (newQ === null) return;
        const newCorrect = prompt('Edit kunci jawaban (A/B/C/D atau teks):', correct || '') || '';
        try {
          await updateDoc(doc(db, 'soal', sid), { question: newQ, correct: newCorrect });
          toast('Soal diperbarui', 'success');
          openSoal(materiId, materiTitle);
        } catch(e){ console.error(e); toast('Gagal update soal', 'error'); }
      });
      node.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Hapus soal ini?')) return;
        try {
          await deleteDoc(doc(db, 'soal', sid));
          toast('Soal dihapus', 'success');
          openSoal(materiId, materiTitle);
        } catch(e){ console.error(e); toast('Gagal hapus soal', 'error'); }
      });

      soalList.appendChild(node);
    });
  } catch(e){ console.error(e); soalList.innerHTML = `<div class="muted">Gagal memuat soal.</div>`; }
}

/* Helper for embedded materi (index-based) */
function openSoalEmbedded(courseId, materiIndex, title, courseData) {
  // courseData: full course doc data containing materi array
  selectedMateriId = String(materiIndex); // treat as index
  const questions = (courseData && Array.isArray(courseData.materi) && courseData.materi[materiIndex] && Array.isArray(courseData.materi[materiIndex].questions))
    ? courseData.materi[materiIndex].questions
    : [];
  // render embedded questions (read-only edit will update course doc)
  soalList.innerHTML = '';
  if (!questions || questions.length === 0) {
    soalList.innerHTML = `<div class="muted">Belum ada soal (embedded).</div>`;
    soalPanel.style.display = 'block';
    return;
  }
  questions.forEach((q, idx) => {
    const node = document.createElement('div');
    node.className = 'admin-item';
    const qtext = q.question || q.pertanyaan || '';
    const correct = q.correct || q.kunci || '';
    node.innerHTML = `
      <div>
        <div style="font-weight:600">${safe(qtext)}</div>
        <div class="muted" style="font-size:12px">Kunci: ${safe(correct)}</div>
      </div>
      <div class="admin-actions">
        <button class="btn ghost sm" data-edit="${idx}">✎</button>
        <button class="btn ghost sm" data-del="${idx}">🗑</button>
      </div>
    `;
    node.querySelector('[data-edit]')?.addEventListener('click', async () => {
      const newQ = prompt('Edit soal (embedded):', qtext);
      if (newQ === null) return;
      const newCorrect = prompt('Edit kunci (embedded):', correct || '') || '';
      try {
        courseData.materi[materiIndex].questions[idx].question = newQ;
        courseData.materi[materiIndex].questions[idx].correct = newCorrect;
        await updateDoc(doc(db, ROOT_COLLECTION, courseId), { materi: courseData.materi });
        toast('Soal embedded diperbarui', 'success');
        openMateri(courseId, selectedCourseName);
        openSoalEmbedded(courseId, materiIndex, title, courseData);
      } catch(e){ console.error(e); toast('Gagal update soal embedded', 'error'); }
    });
    node.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!confirm('Hapus soal embedded ini?')) return;
      try {
        courseData.materi[materiIndex].questions.splice(idx, 1);
        await updateDoc(doc(db, ROOT_COLLECTION, courseId), { materi: courseData.materi });
        toast('Soal embedded dihapus', 'success');
        openMateri(courseId, selectedCourseName);
        openSoalEmbedded(courseId, materiIndex, title, courseData);
      } catch(e){ console.error(e); toast('Gagal hapus soal embedded', 'error'); }
    });

    soalList.appendChild(node);
  });
}

/* Add soal (will try to add to top-level soal collection referencing materiId) */
addSoalBtn?.addEventListener('click', async () => {
  try {
    if (!selectedMateriId) return toast('Pilih materi terlebih dahulu', 'error');
    const teks = prompt('Teks soal:');
    if (!teks) return;
    const correct = prompt('Jawaban benar (A/B/C/D atau teks):') || '';
    const wantOptions = confirm('Apakah soal memiliki pilihan (A/B/C/D)? Tekan OK jika ya.');
    let options = null;
    if (wantOptions) {
      const A = prompt('Opsi A:') || '';
      const B = prompt('Opsi B:') || '';
      const C = prompt('Opsi C:') || '';
      const D = prompt('Opsi D:') || '';
      options = { A, B, C, D };
    }
    // If selectedMateriId is numeric string -> this might be embedded index; try to find course containing it
    // Attempt to find materi doc first
    let created = false;
    try {
      const mDocRef = doc(db, ROOT_COLLECTION, selectedCourseId, 'materi', String(selectedMateriId));
      const mDocSnap = await getDoc(mDocRef);
      if (mDocSnap.exists()) {
        // create top-level soal referencing materi doc id
        await addDoc(collection(db, 'soal'), {
          materiId: String(selectedMateriId),
          question: teks,
          options: options || {},
          correct,
          createdAt: Date.now()
        });
        created = true;
        toast('Soal ditambahkan', 'success');
        openSoal(String(selectedMateriId), soalMateriTitle?.textContent.replace('Soal — ', '') || '');
        return;
      }
    } catch(_) { /* ignore */ }

    // Fallback: selectedMateriId may be embedded index -> find course doc and update embedded array
    try {
      const courseRef = doc(db, ROOT_COLLECTION, selectedCourseId);
      const cSnap = await getDoc(courseRef);
      if (cSnap.exists()) {
        const cData = cSnap.data() || {};
        const arr = Array.isArray(cData.materi) ? cData.materi : [];
        const idx = Number(selectedMateriId);
        if (!Number.isNaN(idx) && arr[idx]) {
          arr[idx].questions = arr[idx].questions || [];
          arr[idx].questions.push({ question: teks, options: options || {}, correct, explanation: '', id: 'q-' + Date.now() });
          await updateDoc(courseRef, { materi: arr });
          created = true;
          toast('Soal embedded ditambahkan', 'success');
          openMateri(selectedCourseId, selectedCourseName);
          return;
        }
      }
    } catch(e){ console.error(e); }

    if (!created) {
      // If we couldn't find materi doc, still create soal referencing selectedMateriId (best-effort)
      await addDoc(collection(db, 'soal'), {
        materiId: String(selectedMateriId),
        question: teks,
        options: options || {},
        correct,
        createdAt: Date.now()
      });
      toast('Soal ditambahkan (referensi dibuat)', 'success');
      openSoal(String(selectedMateriId), soalMateriTitle?.textContent.replace('Soal — ', '') || '');
    }
  } catch(e){ console.error(e); toast('Gagal tambah soal', 'error'); }
});

/* ---------- AUTH (no role check) ---------- */
if (loginForm) {
  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = (loginEmail?.value || '').trim();
    const pass = (loginPass?.value || '');
    if (!email || !pass) { toast('Email & password wajib diisi', 'error'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle UI
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
      toast('Logout berhasil', 'success');
      showLoginOnly();
    } catch(e){ console.warn(e); toast('Logout gagal', 'error'); }
  });
}

/* ---------- Auth state watcher (no role check) ---------- */
onAuthStateChanged(auth, async (user) => {
  wireThemeControls();
  applyThemeFromStorage();
  if (!user) {
    showLoginOnly();
    return;
  }
  // logged in -> show admin UI
  showAdminUI(user);
  // determine root collection then load
  await determineRootCollection();
  loadCourses();
});

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // initial UI state
  hideAllAdminPanels();
  if (loginForm) loginForm.style.display = 'block';
  wireThemeControls();
  applyThemeFromStorage();
});
