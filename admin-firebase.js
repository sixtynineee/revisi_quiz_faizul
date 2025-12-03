// admin-firebase.js — Version WITHOUT ADMIN ROLE CHECK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, getDoc,
  query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

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
const auth = getAuth(app);

/* ---------- DOM helpers ---------- */
const $ = id => document.getElementById(id);
const safe = v => (v === undefined || v === null) ? '' : String(v);

/* ---------- DOM refs ---------- */
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

/* ---------- LOCAL STATE ---------- */
let selectedCourseId = null;
let selectedMateriId = null;
let selectedCourseName = '';

/* ---------- UI ---------- */
function toast(msg, type='info') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.right = '20px';
  t.style.top = '20px';
  t.style.padding = '8px 12px';
  t.style.color = '#fff';
  t.style.borderRadius = '8px';
  t.style.zIndex = 99999;
  t.style.background = type === 'error' ? '#ef4444' :
                       type === 'success' ? '#16a34a' : '#0b74de';
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity = '0', 2000);
  setTimeout(()=> t.remove(), 2400);
}

function showAdminUI(user) {
  loginForm.style.display = 'none';
  coursesView.style.display = 'flex';
  logoutWrap.style.display = 'block';
  signedEmail.textContent = user.email;
}

function showLoginUIOnly() {
  loginForm.style.display = 'block';
  coursesView.style.display = 'none';
  materiPanel.style.display = 'none';
  soalPanel.style.display = 'none';
  logoutWrap.style.display = 'none';
}

/* ---------- THEME ---------- */
function applyThemeFromStorage() {
  const saved = localStorage.getItem('theme') || 'light';
  const isDark = saved === 'dark';
  document.body.classList.toggle('dark', isDark);
  themeCheckbox.checked = isDark;
  themeBtn.textContent = isDark ? '☀' : '☾';
}
function wireThemeControls() {
  applyThemeFromStorage();
  themeCheckbox.addEventListener('change', () => {
    const isDark = themeCheckbox.checked;
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '☀' : '☾';
  });
  themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeCheckbox.checked = isDark;
    themeBtn.textContent = isDark ? '☀' : '☾';
  });
}

/* ---------- AUTH (NO ROLE CHECK) ---------- */
if (loginForm) {
  loginForm.addEventListener('submit', async (ev)=> {
    ev.preventDefault();
    const email = loginEmail.value.trim();
    const pass = loginPass.value;
    if (!email || !pass) return toast('Email & password wajib', 'error');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch(err) {
      toast('Gagal login: ' + err.code, 'error');
    }
  });
}

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  toast('Logout berhasil', 'success');
  showLoginUIOnly();
});

onAuthStateChanged(auth, user => {
  if (user) {
    showAdminUI(user);
    loadCourses();
  } else {
    showLoginUIOnly();
  }
});

/* ---------- LOAD COURSES (mata_kuliah) ---------- */
async function loadCourses() {
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
      const d = docSnap.data();
      const id = docSnap.id;

      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(d.nama || d.name)}</div>
          <div class="muted" style="font-size:12px">${safe(d.deskripsi || '')}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${id}">Materi</button>
          <button class="btn ghost sm" data-edit="${id}">✎</button>
          <button class="btn ghost sm" data-del="${id}">🗑</button>
        </div>
      `;

      item.querySelector('[data-open]')
        .addEventListener('click', () => openMateri(id, d.nama));

      item.querySelector('[data-edit]')
        .addEventListener('click', async () => {
          const newName = prompt('Edit nama:', d.nama);
          if (!newName) return;
          await updateDoc(doc(db, 'mata_kuliah', id), { nama: newName });
          toast('Updated', 'success');
          loadCourses();
        });

      item.querySelector('[data-del]')
        .addEventListener('click', async () => {
          if (!confirm('Hapus mata kuliah ini?')) return;

          // hapus materi + soal
          const ms = await getDocs(collection(db, 'mata_kuliah', id, 'materi'));
          for (const mdoc of ms.docs) {
            const soalQ = query(collection(db, 'soal'), where('materiId','==', mdoc.id));
            const ss = await getDocs(soalQ);
            for (const s of ss.docs) {
              await deleteDoc(doc(db, 'soal', s.id));
            }
            await deleteDoc(doc(db, 'mata_kuliah', id, 'materi', mdoc.id));
          }

          await deleteDoc(doc(db, 'mata_kuliah', id));
          toast('Dihapus', 'success');
          loadCourses();
        });

      coursesAdminList.appendChild(item);
    });
  } catch(e) {
    console.error(e);
    coursesAdminList.innerHTML = `<div class="muted">Gagal memuat.</div>`;
  }
}

/* ---------- MATERI ---------- */
async function openMateri(courseId, courseName) {
  selectedCourseId = courseId;
  selectedCourseName = courseName;
  materiCourseTitle.textContent = `Materi — ${courseName}`;
  materiPanel.style.display = 'block';
  soalPanel.style.display = 'none';

  materiList.innerHTML = `<div class="muted">Memuat...</div>`;
  const q = query(collection(db, 'mata_kuliah', courseId, 'materi'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    materiList.innerHTML = `<div class="muted">Belum ada materi.</div>`;
    return;
  }

  materiList.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const mid = docSnap.id;

    const node = document.createElement('div');
    node.className = 'admin-item';
    node.innerHTML = `
      <div>
        <div style="font-weight:600">${safe(d.judul)}</div>
        <div class="muted" style="font-size:12px">${safe(d.isi || '')}</div>
      </div>
      <div class="admin-actions">
        <button class="btn sm" data-open="${mid}">Soal</button>
        <button class="btn ghost sm" data-edit="${mid}">✎</button>
        <button class="btn ghost sm" data-del="${mid}">🗑</button>
      </div>
    `;

    node.querySelector('[data-open]')
      .addEventListener('click', () => openSoal(mid, d.judul));

    node.querySelector('[data-edit]')
      .addEventListener('click', async () => {
        const newTitle = prompt('Edit judul:', d.judul);
        if (!newTitle) return;
        await updateDoc(doc(db, 'mata_kuliah', courseId, 'materi', mid), { judul: newTitle });
        toast('Updated', 'success');
        openMateri(courseId, courseName);
      });

    node.querySelector('[data-del]')
      .addEventListener('click', async () => {
        if (!confirm('Hapus materi ini?')) return;

        const soalQ = query(collection(db, 'soal'), where('materiId','==', mid));
        const ss = await getDocs(soalQ);
        for (const s of ss.docs) {
          await deleteDoc(doc(db, 'soal', s.id));
        }

        await deleteDoc(doc(db, 'mata_kuliah', courseId, 'materi', mid));
        toast('Materi dihapus', 'success');
        openMateri(courseId, courseName);
      });

    materiList.appendChild(node);
  });
}

/* ---------- SOAL ---------- */
async function openSoal(materiId, materiTitle) {
  selectedMateriId = materiId;
  soalMateriTitle.textContent = `Soal — ${materiTitle}`;
  soalPanel.style.display = 'block';

  soalList.innerHTML = `<div class="muted">Memuat...</div>`;

  const q = query(collection(db, 'soal'), where('materiId','==', materiId), orderBy('createdAt','desc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    soalList.innerHTML = `<div class="muted">Belum ada soal.</div>`;
    return;
  }

  soalList.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const sid = docSnap.id;

    const node = document.createElement('div');
    node.className = 'admin-item';
    node.innerHTML = `
      <div>
        <div style="font-weight:600">${safe(d.question)}</div>
        <div class="muted" style="font-size:12px">Kunci: ${safe(d.correct)}</div>
      </div>
      <div class="admin-actions">
        <button class="btn ghost sm" data-edit="${sid}">✎</button>
        <button class="btn ghost sm" data-del="${sid}">🗑</button>
      </div>
    `;

    node.querySelector('[data-edit]')
      .addEventListener('click', async () => {
        const qBaru = prompt('Edit soal:', d.question);
        if (!qBaru) return;
        await updateDoc(doc(db, 'soal', sid), { question: qBaru });
        toast('Updated', 'success');
        openSoal(materiId, materiTitle);
      });

    node.querySelector('[data-del]')
      .addEventListener('click', async () => {
        if (!confirm('Hapus soal?')) return;
        await deleteDoc(doc(db, 'soal', sid));
        toast('Dihapus', 'success');
        openSoal(materiId, materiTitle);
      });

    soalList.appendChild(node);
  });
}

/* ---------- ADD BUTTONS ---------- */
addCourseBtn?.addEventListener('click', async () => {
  const nama = prompt('Nama mata kuliah:');
  if (!nama) return;
  await addDoc(collection(db, 'mata_kuliah'), {
    nama,
    createdAt: Date.now()
  });
  toast('Mata kuliah ditambah', 'success');
  loadCourses();
});

addMateriBtn?.addEventListener('click', async () => {
  if (!selectedCourseId) return toast('Pilih mata kuliah dulu', 'error');
  const judul = prompt('Judul materi:');
  if (!judul) return;
  await addDoc(collection(db, 'mata_kuliah', selectedCourseId, 'materi'), {
    judul,
    createdAt: Date.now()
  });
  toast('Materi ditambah', 'success');
  openMateri(selectedCourseId, selectedCourseName);
});

addSoalBtn?.addEventListener('click', async () => {
  if (!selectedMateriId) return toast('Pilih materi dulu', 'error');
  const t = prompt('Isi soal:');
  if (!t) return;
  const k = prompt('Kunci jawaban:');
  if (!k) return;

  await addDoc(collection(db, 'soal'), {
    materiId: selectedMateriId,
    question: t,
    correct: k,
    createdAt: Date.now()
  });
  toast('Soal ditambah', 'success');
  openSoal(selectedMateriId, soalMateriTitle.textContent.replace('Soal — ', ''));
});

/* ---------- INIT ---------- */
wireThemeControls();
