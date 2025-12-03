/* ============================================================
   ADMIN PANEL – FIREBASE FIXED REVISION
   ============================================================ */

/* ---------- IMPORT FIREBASE ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  getDocs, updateDoc, query, orderBy, where, getDoc
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

/* ---------- SHORTCUT ---------- */
const $ = id => document.getElementById(id);
const safe = v => v ? String(v) : '';

/* ---------- DOM ELEMENTS ---------- */
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

/* ---------- STATE ---------- */
let selectedCourseId = null;
let selectedMateriId = null;

/* ============================================================
   TOAST
   ============================================================ */
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.top = '20px';
  t.style.right = '20px';
  t.style.background = (type === 'error') ? '#dc2626' :
                       (type === 'success') ? '#16a34a' : '#2563eb';
  t.style.color = '#fff';
  t.style.padding = '8px 12px';
  t.style.borderRadius = '8px';
  t.style.zIndex = 99999;
  document.body.appendChild(t);
  setTimeout(() => t.style.opacity = '0', 2200);
  setTimeout(() => t.remove(), 2600);
}

/* ============================================================
   DISPLAY CONTROL FIX
   ============================================================ */
function hideAllAdminPanels() {
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
}

function showOnlyLoginUI() {
  hideAllAdminPanels();
  if (loginForm) loginForm.style.display = 'block';
}

function showAdminDashboard(user) {
  if (loginForm) loginForm.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'block';

  if (signedEmail) signedEmail.textContent = user.email;
  if (coursesView) coursesView.style.display = 'flex';
}

/* ============================================================
   THEME
   ============================================================ */
function applyTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  const isDark = saved === 'dark';
  document.body.classList.toggle('dark', isDark);
  themeCheckbox.checked = isDark;
  themeBtn.textContent = isDark ? '☀' : '☾';
}

function wireTheme() {
  applyTheme();
  themeCheckbox?.addEventListener('change', () => {
    const isDark = themeCheckbox.checked;
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '☀' : '☾';
  });

  themeBtn?.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '☀' : '☾';
  });
}
wireTheme();

/* ============================================================
   ADMIN CHECK FIXED
   ============================================================ */
async function isAdmin(user) {
  if (!user) return false;

  try {
    const byUid = await getDoc(doc(db, "admins", user.uid));
    if (byUid.exists()) return true;

    const byEmail = await getDoc(doc(db, "admins", user.email));
    return byEmail.exists();
  } catch {
    return false;
  }
}

/* ============================================================
   AUTH
   ============================================================ */
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const pass = loginPass.value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    toast("Gagal login: " + err.message, 'error');
  }
});

btnLogout?.addEventListener('click', async () => {
  await signOut(auth);
  toast("Logout sukses", "success");
});

/* ============================================================
   AUTH STATE
   ============================================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showOnlyLoginUI();
    return;
  }

  const admin = await isAdmin(user);
  if (!admin) {
    toast("Akses ditolak", "error");
    await signOut(auth);
    return;
  }

  showAdminDashboard(user);
  loadCourses();
});

/* ============================================================
   LOAD COURSES
   ============================================================ */
async function loadCourses() {
  coursesAdminList.innerHTML = `<p class="muted">Memuat...</p>`;

  try {
    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    coursesAdminList.innerHTML = '';

    if (snap.empty) {
      coursesAdminList.innerHTML = `<p class="muted">Belum ada mata kuliah.</p>`;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const item = document.createElement('div');
      item.className = 'admin-item';

      item.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(d.name)}</div>
          <div class="muted" style="font-size:12px">${safe(d.desc)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${docSnap.id}">Materi</button>
          <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
          <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
        </div>
      `;

      item.querySelector('[data-open]').addEventListener('click', () => {
        openMateri(docSnap.id, d.name);
      });

      item.querySelector('[data-edit]').addEventListener('click', async () => {
        const newName = prompt("Nama Mata Kuliah:", safe(d.name));
        if (!newName) return;
        await updateDoc(doc(db, "courses", docSnap.id), { name: newName });
        toast("Terupdate", "success");
        loadCourses();
      });

      item.querySelector('[data-del]').addEventListener('click', async () => {
        if (!confirm('Yakin hapus course ini?')) return;

        // hapus materi + soal
        const mq = query(collection(db, "materi"), where('courseId', '==', docSnap.id));
        const msnap = await getDocs(mq);

        for (const m of msnap.docs) {
          const sq = query(collection(db, "soal"), where('materiId', '==', m.id));
          const ssnap = await getDocs(sq);
          for (const s of ssnap.docs) {
            await deleteDoc(doc(db, "soal", s.id));
          }
          await deleteDoc(doc(db, "materi", m.id));
        }

        await deleteDoc(doc(db, "courses", docSnap.id));
        toast("Course dihapus", "success");
        loadCourses();
      });

      coursesAdminList.appendChild(item);
    });

  } catch (err) {
    toast("Gagal memuat course", "error");
  }
}

/* ============================================================
   MATERI
   ============================================================ */
async function openMateri(courseId, courseName) {
  selectedCourseId = courseId;
  selectedMateriId = null;

  materiPanel.style.display = 'block';
  soalPanel.style.display = 'none';

  materiCourseTitle.textContent = "Materi — " + courseName;
  materiList.innerHTML = `<p class="muted">Memuat...</p>`;

  try {
    const mq = query(collection(db, "materi"), where("courseId", "==", courseId), orderBy("createdAt", "desc"));
    const snap = await getDocs(mq);

    materiList.innerHTML = '';

    if (snap.empty) {
      materiList.innerHTML = `<p class="muted">Belum ada materi.</p>`;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const item = document.createElement('div');
      item.className = "admin-item";

      item.innerHTML = `
        <div>
          <div style="font-weight:600">${safe(d.title)}</div>
          <div class="muted" style="font-size:12px">${safe(d.desc)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn sm" data-open="${docSnap.id}">Soal</button>
          <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
          <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
        </div>
      `;

      item.querySelector('[data-open]').addEventListener('click', () => {
        openSoal(docSnap.id, d.title);
      });

      item.querySelector('[data-edit]').addEventListener('click', async () => {
        const newTitle = prompt("Judul Materi:", safe(d.title));
        if (!newTitle) return;
        await updateDoc(doc(db, "materi", docSnap.id), { title: newTitle });
        toast("Materi terupdate", "success");
        openMateri(courseId, courseName);
      });

      item.querySelector('[data-del]').addEventListener('click', async () => {
        if (!confirm('Hapus materi ini?')) return;

        const sq = query(collection(db, "soal"), where('materiId', '==', docSnap.id));
        const ssnap = await getDocs(sq);

        for (const s of ssnap.docs) {
          await deleteDoc(doc(db, "soal", s.id));
        }

        await deleteDoc(doc(db, "materi", docSnap.id));
        toast("Materi dihapus", "success");
        openMateri(courseId, courseName);
      });

      materiList.appendChild(item);
    });

  } catch (err) {
    toast("Gagal memuat materi", "error");
  }
}

/* ============================================================
   SOAL
   ============================================================ */
async function openSoal(materiId, materiTitle) {
  selectedMateriId = materiId;

  soalPanel.style.display = 'block';
  materiPanel.style.display = 'block';

  soalMateriTitle.textContent = "Soal — " + materiTitle;
  soalList.innerHTML = `<p class="muted">Memuat...</p>`;

  try {
    const q = query(collection(db, "soal"), where("materiId", "==", materiId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    soalList.innerHTML = '';

    if (snap.empty) {
      soalList.innerHTML = `<p class="muted">Belum ada soal.</p>`;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();

      const item = document.createElement('div');
      item.className = 'admin-item';

      item.innerHTML = `
        <div>
          <div>${safe(d.pertanyaan)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
          <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
        </div>
      `;

      item.querySelector('[data-edit]').addEventListener('click', async () => {
        const newQ = prompt("Edit soal:", safe(d.pertanyaan));
        if (!newQ) return;
        await updateDoc(doc(db, "soal", docSnap.id), { pertanyaan: newQ });
        toast("Soal terupdate", "success");
        openSoal(materiId, materiTitle);
      });

      item.querySelector('[data-del]').addEventListener('click', async () => {
        if (!confirm("Hapus soal ini?")) return;
        await deleteDoc(doc(db, "soal", docSnap.id));
        toast("Soal dihapus", "success");
        openSoal(materiId, materiTitle);
      });

      soalList.appendChild(item);
    });

  } catch (err) {
    toast("Gagal memuat soal", "error");
  }
}

/* ============================================================
   BUTTON — ADD
   ============================================================ */
addCourseBtn?.addEventListener('click', async () => {
  const name = prompt("Nama Mata Kuliah:");
  if (!name) return;

  await addDoc(collection(db, "courses"), {
    name,
    createdAt: Date.now()
  });

  toast("Course ditambahkan", "success");
  loadCourses();
});

addMateriBtn?.addEventListener('click', async () => {
  if (!selectedCourseId) return toast("Pilih course terlebih dahulu", "error");

  const title = prompt("Judul Materi:");
  if (!title) return;

  await addDoc(collection(db, "materi"), {
    courseId: selectedCourseId,
    title,
    createdAt: Date.now()
  });

  toast("Materi ditambahkan", "success");
  openMateri(selectedCourseId, materiCourseTitle.textContent.replace('Materi — ', ''));
});

addSoalBtn?.addEventListener('click', async () => {
  if (!selectedMateriId) return toast("Pilih materi dulu", "error");

  const q = prompt("Tuliskan soal:");
  if (!q) return;

  await addDoc(collection(db, "soal"), {
    materiId: selectedMateriId,
    pertanyaan: q,
    createdAt: Date.now()
  });

  toast("Soal ditambahkan", "success");
  openSoal(selectedMateriId, soalMateriTitle.textContent.replace('Soal — ', ''));
});
