// admin-firebase.js (FINAL) — Materi di-generate dari collection "soal"
// Firebase modular v9.22.0 (compatible with user.js)

// ---------- IMPORTS ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// ---------- FIREBASE CONFIG ----------
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

// ---------- DOM helpers ----------
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel||''));
const safe = v => (v===undefined||v===null)?'':String(v);

// ---------- UI refs ----------
const loginBox = $('loginBox');
const loginForm = $('loginForm');
const loginEmail = $('loginEmail');
const loginPass = $('loginPass');

const adminMain = $('adminMain');
const sidebarBox = $('sidebarBox');
const logoutWrap = $('logoutWrap');
const signedEmail = $('signedEmail');
const btnLogout = $('btnLogout');

const coursesView = $('coursesView');
const coursesAdminList = $('coursesAdminList');
const addCourseBtn = $('addCourseBtn');

const materiPanel = $('materiPanel');
const materiList = $('materiList');
const materiCourseTitle = $('materiCourseTitle');
const addMateriBtn = $('addMateriBtn'); // will be disabled/hidden in this flow

const soalPanel = $('soalPanel');
const soalList = $('soalList');
const soalMateriTitle = $('soalMateriTitle');
const addSoalBtn = $('addSoalBtn');

const btnRefresh = $('btnRefresh');

// ---------- State ----------
let ROOT_COLLECTION = null; // 'courses' or 'mata_kuliah'
let selectedCourseId = null;
let selectedCourseName = '';
let selectedMateriKey = null; // string key used for grouping (materi name)
let lastSoalSnapshotCache = null; // optional cache to avoid reloading too often

// ---------- tiny toast ----------
function toast(msg, type='info') {
  try {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position = 'fixed';
    el.style.right = '18px';
    el.style.top = '18px';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '8px';
    el.style.zIndex = 999999;
    el.style.color = '#fff';
    el.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#16a34a' : '#0b74de');
    document.body.appendChild(el);
    setTimeout(()=> el.style.opacity = '0', 1700);
    setTimeout(()=> el.remove(), 2100);
  } catch(e){ console.warn(e); }
}

// ---------- show/hide helpers ----------
function hideAllAdminPanels() {
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
  if (adminMain) adminMain.style.display = 'none';
  if (sidebarBox) sidebarBox.style.display = 'none';
  if (loginBox) loginBox.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
}

function showLoginOnly() {
  hideAllAdminPanels();
  if (loginBox) loginBox.style.display = 'block';
  if (loginForm) loginForm.style.display = 'block';
}

function showAdminUI(user) {
  hideAllAdminPanels();
  if (adminMain) adminMain.style.display = 'block';
  if (sidebarBox) sidebarBox.style.display = 'block';
  if (coursesView) coursesView.style.display = 'flex';
  if (logoutWrap) logoutWrap.style.display = 'block';
  if (signedEmail) signedEmail.textContent = user?.email || user?.uid || '';
}

// ---------- Determine root collection ----------
async function determineRootCollection() {
  if (ROOT_COLLECTION) return ROOT_COLLECTION;
  try {
    const snap = await getDocs(query(collection(db, 'courses'), orderBy('createdAt','desc')));
    if (!snap.empty) { ROOT_COLLECTION = 'courses'; return ROOT_COLLECTION; }
  } catch(e){ /* ignore */ }
  try {
    const snap2 = await getDocs(query(collection(db, 'mata_kuliah'), orderBy('createdAt','desc')));
    if (!snap2.empty) { ROOT_COLLECTION = 'mata_kuliah'; return ROOT_COLLECTION; }
  } catch(e){ /* ignore */ }
  ROOT_COLLECTION = 'courses';
  return ROOT_COLLECTION;
}

// ---------- COURSES: load ----------
async function loadCourses() {
  if (!coursesAdminList) return;
  coursesAdminList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    await determineRootCollection();
    const colRef = collection(db, ROOT_COLLECTION);
    const snaps = await getDocs(query(colRef, orderBy('createdAt','desc')));

    if (snaps.empty) {
      coursesAdminList.innerHTML = `<div class="muted">Belum ada mata kuliah.</div>`;
      return;
    }

    coursesAdminList.innerHTML = '';
    snaps.forEach(snap => {
      const d = snap.data() || {};
      const id = snap.id;
      const name = d.name || d.nama || 'Untitled';
      const desc = d.description || d.deskripsi || d.desc || '';
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(name)}</div>
          <div class="muted" style="font-size:12px">${safe(desc)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${id}">Materi</button>
          <button class="btn ghost sm" data-edit="${id}">✎</button>
          <button class="btn ghost sm" data-del="${id}">🗑</button>
        </div>
      `;
      item.querySelector('[data-open]')?.addEventListener('click', () => openCourseMaterials(id, name));
      item.querySelector('[data-edit]')?.addEventListener('click', async () => {
        const newName = prompt('Edit nama mata kuliah:', name);
        if (!newName) return;
        const newDesc = prompt('Edit deskripsi (opsional):', desc || '') || '';
        try {
          await updateDoc(doc(db, ROOT_COLLECTION, id), { name: newName, description: newDesc });
          toast('Mata kuliah diperbarui', 'success');
          loadCourses();
        } catch(e){ console.error(e); toast('Gagal update', 'error'); }
      });
      item.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Hapus mata kuliah ini? Semua soal terkait akan dihapus.')) return;
        try {
          // delete soal that reference this course
          const soalQ = query(collection(db, 'soal'), where('courseId','==', id));
          const soalSnap = await getDocs(soalQ);
          for (const s of soalSnap.docs) await deleteDoc(doc(db, 'soal', s.id));
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

// add course
addCourseBtn?.addEventListener('click', async () => {
  try {
    const name = prompt('Nama mata kuliah:');
    if (!name) return;
    const desc = prompt('Deskripsi (opsional):') || '';
    if (!ROOT_COLLECTION) await determineRootCollection();
    await addDoc(collection(db, ROOT_COLLECTION), { name, description: desc, createdAt: Date.now() });
    toast('Mata kuliah ditambahkan', 'success');
    loadCourses();
  } catch(e){ console.error(e); toast('Gagal tambah mata kuliah', 'error'); }
});

// ---------- CORE: open course → list materi (generated from 'soal') ----------
async function openCourseMaterials(courseId, courseName='') {
  selectedCourseId = courseId;
  selectedCourseName = courseName || '';
  if (materiCourseTitle) materiCourseTitle.textContent = `Materi — ${selectedCourseName}`;

  // Show materi panel, hide soal panel
  if (materiPanel) materiPanel.style.display = 'block';
  if (soalPanel) soalPanel.style.display = 'none';

  // We generate materials by grouping soal documents where courseId == selectedCourseId
  if (!materiList) return;
  materiList.innerHTML = `<div class="muted">Memuat materi dari soal...</div>`;
  try {
    const soalQ = query(collection(db, 'soal'), where('courseId','==', selectedCourseId), orderBy('createdAt','desc'));
    const snap = await getDocs(soalQ);
    // cache if needed
    lastSoalSnapshotCache = snap;

    if (snap.empty) {
      materiList.innerHTML = `<div class="muted">Belum ada soal untuk mata kuliah ini.</div>`;
      return;
    }

    // group by 'materi' field (normalize by trimming)
    const groups = {}; // key -> { title, count, latestCreatedAt }
    snap.forEach(s => {
      const d = s.data() || {};
      let m = (d.materi || d.materiName || d.material || '').toString().trim();
      if (!m) m = 'Umum'; // default group
      const key = m; // case-sensitive grouping; if prefer case-insensitive use m.toLowerCase()
      if (!groups[key]) groups[key] = { title: m, count: 0, latest: 0 };
      groups[key].count++;
      const ts = d.createdAt || 0;
      if (ts > groups[key].latest) groups[key].latest = ts;
    });

    // convert to array sorted by latest desc then title
    const arr = Object.keys(groups).map(k => ({ key: k, ...groups[k] }))
      .sort((a,b) => (b.latest - a.latest) || a.title.localeCompare(b.title));

    // render
    materiList.innerHTML = '';
    arr.forEach(g => {
      const node = document.createElement('div');
      node.className = 'admin-item';
      node.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(g.title)}</div>
          <div class="muted" style="font-size:12px">${g.count} soal</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${g.key}">Lihat Soal</button>
          <button class="btn ghost sm" data-rename="${g.key}">✎</button>
        </div>
      `;
      node.querySelector('[data-open]')?.addEventListener('click', () => {
        selectedMateriKey = g.key;
        openSoalForMaterial(g.key);
      });
      node.querySelector('[data-rename]')?.addEventListener('click', async () => {
        // Rename material: update semua soal.docs with that materi field
        const newTitle = prompt('Ubah nama materi:', g.title);
        if (!newTitle || newTitle.trim() === '') return;
        if (!confirm(`Ganti nama materi "${g.title}" menjadi "${newTitle}" pada semua soal?`)) return;
        try {
          const soalQ2 = query(collection(db, 'soal'), where('courseId','==', selectedCourseId));
          const snap2 = await getDocs(soalQ2);
          const batchUpdates = [];
          for (const s of snap2.docs) {
            const data = s.data() || {};
            const mval = (data.materi||'').toString().trim();
            if (!mval && g.title === 'Umum') {
              // matches default group
              await updateDoc(doc(db, 'soal', s.id), { materi: newTitle });
            } else if (mval === g.title) {
              await updateDoc(doc(db, 'soal', s.id), { materi: newTitle });
            }
          }
          toast('Nama materi diperbarui untuk semua soal terkait', 'success');
          openCourseMaterials(selectedCourseId, selectedCourseName);
        } catch(e){ console.error(e); toast('Gagal ganti nama materi', 'error'); }
      });

      materiList.appendChild(node);
    });

  } catch(e){
    console.error(e);
    materiList.innerHTML = `<div class="muted">Gagal memuat materi.</div>`;
  }
}

// ---------- open soal for a given material (group key) ----------
async function openSoalForMaterial(materiKey) {
  selectedMateriKey = materiKey;
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${selectedMateriKey}`;
  if (soalPanel) soalPanel.style.display = 'block';
  if (!soalList) return;
  soalList.innerHTML = `<div class="muted">Memuat soal...</div>`;

  try {
    // fetch all soal for selected course and filter by materiKey
    const soalQ = query(collection(db, 'soal'), where('courseId','==', selectedCourseId), orderBy('createdAt','desc'));
    const snap = await getDocs(soalQ);
    const items = [];
    snap.forEach(s => {
      const d = s.data() || {};
      let m = (d.materi || d.materiName || '').toString().trim();
      if (!m) m = 'Umum';
      if (m === materiKey) {
        items.push({ id: s.id, data: d });
      }
    });

    if (items.length === 0) {
      soalList.innerHTML = `<div class="muted">Belum ada soal di materi ini.</div>`;
      return;
    }

    soalList.innerHTML = '';
    items.forEach(it => {
      const d = it.data || {};
      const sid = it.id;
      const qtext = d.question || d.pertanyaan || d.text || '';
      const correct = d.correct || d.kunci || '';
      const node = document.createElement('div');
      node.className = 'admin-item';
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
        const newMateri = prompt('Materi (nama group):', materiKey) || materiKey;
        const newCorrect = prompt('Kunci jawaban (A/B/C/D atau teks):', correct || '') || '';
        try {
          await updateDoc(doc(db, 'soal', sid), { question: newQ, materi: newMateri, correct: newCorrect });
          toast('Soal diperbarui', 'success');
          openCourseMaterials(selectedCourseId, selectedCourseName); // refresh groups
          openSoalForMaterial(newMateri); // open the (possibly new) material
        } catch(e){ console.error(e); toast('Gagal update soal', 'error'); }
      });
      node.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Hapus soal ini?')) return;
        try {
          await deleteDoc(doc(db, 'soal', sid));
          toast('Soal dihapus', 'success');
          // after deletion, refresh groups
          openCourseMaterials(selectedCourseId, selectedCourseName);
        } catch(e){ console.error(e); toast('Gagal hapus soal', 'error'); }
      });

      soalList.appendChild(node);
    });

  } catch(e){
    console.error(e);
    soalList.innerHTML = `<div class="muted">Gagal memuat soal.</div>`;
  }
}

// ---------- add soal (admin) ----------
addSoalBtn?.addEventListener('click', async () => {
  try {
    if (!selectedCourseId) return toast('Pilih mata kuliah terlebih dahulu', 'error');
    const teks = prompt('Teks soal:');
    if (!teks) return;
    const materiInput = prompt('Masukkan nama materi (misal: Bab 1). Kosong = "Umum":') || '';
    const materiValue = materiInput.trim() || 'Umum';
    const correct = prompt('Jawaban benar (A/B/C/D atau teks):') || '';
    // optional choices
    const wantOptions = confirm('Apakah soal memiliki pilihan (A/B/C/D)? Tekan OK jika ya.');
    let options = null;
    if (wantOptions) {
      const A = prompt('Opsi A:') || '';
      const B = prompt('Opsi B:') || '';
      const C = prompt('Opsi C:') || '';
      const D = prompt('Opsi D:') || '';
      options = { A,B,C,D };
    }

    await addDoc(collection(db, 'soal'), {
      courseId: selectedCourseId,
      materi: materiValue,
      question: teks,
      options: options || {},
      correct,
      createdAt: Date.now()
    });
    toast('Soal ditambahkan', 'success');
    // refresh groups and open the material where we added
    openCourseMaterials(selectedCourseId, selectedCourseName);
    openSoalForMaterial(materiValue);
  } catch(e){ console.error(e); toast('Gagal tambah soal', 'error'); }
});

// ---------- AUTH ----------
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

// ---------- Auth watcher ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLoginOnly();
    return;
  }
  showAdminUI(user);
  await determineRootCollection();
  await loadCourses();
});

// ---------- boot ----------
document.addEventListener('DOMContentLoaded', () => {
  hideAllAdminPanels();
  if (loginBox) loginBox.style.display = 'block';
  if (loginForm) loginForm.style.display = 'block';
});

// ---------- refresh btn ----------
btnRefresh?.addEventListener('click', async () => {
  if (!selectedCourseId) {
    await loadCourses();
  } else {
    await openCourseMaterials(selectedCourseId, selectedCourseName);
  }
});
