// admin-firebase.js
// Compatible with user.js structure (courses collection, materi as embedded array OR subcollection)
// Uses Firebase modular SDK v9.x (same style as user.js)
// Paste this file as-is into your project and include it in admin.html (type=module)

// ---------- IMPORTS ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// ---------- FIREBASE CONFIG (use your config) ----------
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
const qsa = sel => Array.from(document.querySelectorAll(sel || ''));

const safe = v => (v === undefined || v === null) ? '' : String(v);

// ---------- UI refs (from your admin HTML) ----------
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
const addMateriBtn = $('addMateriBtn');

const soalPanel = $('soalPanel');
const soalList = $('soalList');
const soalMateriTitle = $('soalMateriTitle');
const addSoalBtn = $('addSoalBtn');

const btnRefresh = $('btnRefresh');

// ---------- local state ----------
let ROOT_COLLECTION = null; // 'courses' or 'mata_kuliah'
let selectedCourseId = null;
let selectedCourseData = null; // course doc data (used for embedded)
let selectedMateriId = null; // materi doc id or embedded index (string)
let selectedMateriTitle = '';

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

// ---------- show/hide helpers (FIXED) ----------
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

// ---------- detect root collection ----------
async function determineRootCollection() {
  if (ROOT_COLLECTION) return ROOT_COLLECTION;
  try {
    // try 'courses'
    const snap = await getDocs(query(collection(db, 'courses'), orderBy('createdAt','desc')));
    if (!snap.empty) { ROOT_COLLECTION = 'courses'; return ROOT_COLLECTION; }
  } catch(e){ /* ignore */ }
  try {
    const snap2 = await getDocs(query(collection(db, 'mata_kuliah'), orderBy('createdAt','desc')));
    if (!snap2.empty) { ROOT_COLLECTION = 'mata_kuliah'; return ROOT_COLLECTION; }
  } catch(e){ /* ignore */ }
  // default
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
      const desc = d.description || d.desc || d.deskripsi || '';
      const materiCount = Array.isArray(d.materi) ? d.materi.length : '(subcollection?)';

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

      item.querySelector('[data-open]')?.addEventListener('click', () => {
        openMateri(id, name);
      });

      item.querySelector('[data-edit]')?.addEventListener('click', async () => {
        const newName = prompt('Edit nama mata kuliah:', name);
        if (!newName) return;
        const newDesc = prompt('Edit deskripsi (opsional):', desc || '') || '';
        const updateObj = {};
        // prefer writing 'name' & 'description' for compatibility with user.js
        updateObj.name = newName;
        updateObj.description = newDesc;
        try {
          await updateDoc(doc(db, ROOT_COLLECTION, id), updateObj);
          toast('Mata kuliah diperbarui', 'success');
          loadCourses();
        } catch(e){ console.error(e); toast('Gagal update', 'error'); }
      });

      item.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Hapus mata kuliah ini? Semua materi & soal terkait akan dihapus (jika ada).')) return;
        try {
          // attempt delete materi subcollection docs
          const matCol = collection(db, ROOT_COLLECTION, id, 'materi');
          const matSnap = await getDocs(matCol);
          for (const m of matSnap.docs) {
            // delete soal referencing this materi (top-level 'soal')
            try {
              const soalQ = query(collection(db, 'soal'), where('materiId','==', m.id));
              const soalSnap = await getDocs(soalQ);
              for (const s of soalSnap.docs) await deleteDoc(doc(db, 'soal', s.id));
            } catch(_) {}
            await deleteDoc(doc(db, ROOT_COLLECTION, id, 'materi', m.id));
          }
          // delete the course doc
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
    await addDoc(collection(db, ROOT_COLLECTION), {
      name,
      description: desc,
      createdAt: Date.now()
    });
    toast('Mata kuliah ditambahkan', 'success');
    loadCourses();
  } catch(e){ console.error(e); toast('Gagal tambah mata kuliah', 'error'); }
});

// ---------- MATERI: open / load / add / edit / delete ----------

async function openMateri(courseId, courseName='') {
  selectedCourseId = courseId;
  selectedCourseData = null;
  selectedMateriId = null;
  selectedMateriTitle = '';

  if (materiCourseTitle) materiCourseTitle.textContent = `Materi — ${courseName}`;
  if (materiPanel) { materiPanel.style.display = 'block'; }
  if (soalPanel) { soalPanel.style.display = 'none'; }

  // load materi (prefer subcollection)
  if (!materiList) return;
  materiList.innerHTML = `<div class="muted">Memuat...</div>`;

  try {
    // check subcollection
    const matColRef = collection(db, ROOT_COLLECTION, courseId, 'materi');
    const matSnap = await getDocs(query(matColRef, orderBy('createdAt','desc')));
    if (!matSnap.empty) {
      // show subcollection materi
      materiList.innerHTML = '';
      matSnap.forEach(mSnap => {
        const m = mSnap.data() || {};
        const mid = mSnap.id;
        const judul = m.judul || m.title || 'Untitled';
        const isi = m.isi || m.description || m.desc || '';

        const node = document.createElement('div');
        node.className = 'admin-item';
        node.innerHTML = `
          <div>
            <div style="font-weight:600">${safe(judul)}</div>
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
          selectedMateriTitle = judul;
          openSoal(mid, judul);
        });
        node.querySelector('[data-edit]')?.addEventListener('click', async () => {
          const newJudul = prompt('Edit judul materi:', judul);
          if (!newJudul) return;
          const newIsi = prompt('Edit isi materi (opsional):', isi || '') || '';
          try {
            const updateObj = { judul: newJudul, isi: newIsi, title: newJudul, description: newIsi };
            await updateDoc(doc(db, ROOT_COLLECTION, courseId, 'materi', mid), updateObj);
            toast('Materi subcollection diperbarui', 'success');
            openMateri(courseId, courseName);
          } catch(e){ console.error(e); toast('Gagal update materi', 'error'); }
        });
        node.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!confirm('Hapus materi ini? Soal terkait dihapus juga.')) return;
          try {
            // delete soal referencing this materi
            const soalQ = query(collection(db, 'soal'), where('materiId','==', mid));
            const ssnap = await getDocs(soalQ);
            for (const s of ssnap.docs) await deleteDoc(doc(db, 'soal', s.id));
            await deleteDoc(doc(db, ROOT_COLLECTION, courseId, 'materi', mid));
            toast('Materi dihapus', 'success');
            openMateri(courseId, courseName);
          } catch(e){ console.error(e); toast('Gagal hapus materi', 'error'); }
        });

        materiList.appendChild(node);
      });
      return;
    }

    // fallback: load embedded materi array from course doc
    const courseRef = doc(db, ROOT_COLLECTION, courseId);
    const cSnap = await getDoc(courseRef);
    if (!cSnap.exists()) {
      materiList.innerHTML = `<div class="muted">Course tidak ditemukan.</div>`;
      return;
    }
    const cData = cSnap.data() || {};
    selectedCourseData = cData; // store for embedded operations
    const embedded = Array.isArray(cData.materi) ? cData.materi : [];

    if (embedded.length === 0) {
      materiList.innerHTML = `<div class="muted">Belum ada materi.</div>`;
      return;
    }

    materiList.innerHTML = '';
    embedded.forEach((m, idx) => {
      const title = m.title || m.judul || 'Untitled';
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
        selectedMateriId = String(idx); // index as string
        selectedMateriTitle = title;
        openSoalEmbedded(courseId, idx, title, cData);
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
          openMateri(courseId, courseName);
        } catch(e){ console.error(e); toast('Gagal update embedded', 'error'); }
      });
      node.querySelector('[data-del-emb]')?.addEventListener('click', async () => {
        if (!confirm('Hapus materi embedded ini?')) return;
        try {
          embedded.splice(idx, 1);
          await updateDoc(courseRef, { materi: embedded });
          toast('Materi embedded dihapus', 'success');
          openMateri(courseId, courseName);
        } catch(e){ console.error(e); toast('Gagal hapus embedded', 'error'); }
      });

      materiList.appendChild(node);
    });

  } catch(e) {
    console.error(e);
    materiList.innerHTML = `<div class="muted">Gagal memuat materi.</div>`;
  }
}

// add materi (will try subcollection first -- if none, update embedded array)
addMateriBtn?.addEventListener('click', async () => {
  try {
    if (!selectedCourseId) return toast('Pilih mata kuliah terlebih dahulu', 'error');
    const judul = prompt('Judul materi:');
    if (!judul) return;
    const isi = prompt('Isi materi (opsional):') || '';

    // try to write to subcollection
    try {
      const mColRef = collection(db, ROOT_COLLECTION, selectedCourseId, 'materi');
      // check if subcollection exists by attempting getDocs
      const msnap = await getDocs(mColRef);
      // If accessible (no rules blocking), add to subcollection
      await addDoc(mColRef, {
        judul,
        isi,
        title: judul,
        description: isi,
        createdAt: Date.now()
      });
      toast('Materi ditambahkan (subcollection)', 'success');
      openMateri(selectedCourseId, selectedCourseData?.name || '');
      return;
    } catch(_) {
      // fallback to embedded
    }

    // fallback: embedded array
    const courseRef = doc(db, ROOT_COLLECTION, selectedCourseId);
    const cSnap = await getDoc(courseRef);
    const cData = cSnap.exists() ? cSnap.data() : {};
    const embedded = Array.isArray(cData.materi) ? cData.materi : [];
    embedded.unshift({
      id: 'm-' + Date.now(),
      title: judul,
      description: isi,
      questions: []
    });
    await updateDoc(courseRef, { materi: embedded });
    toast('Materi embedded ditambahkan', 'success');
    openMateri(selectedCourseId, selectedCourseData?.name || '');
  } catch(e){ console.error(e); toast('Gagal tambah materi', 'error'); }
});

// ---------- SOAL ----------
// open soal for materi (top-level soal collection)
async function openSoal(materiId, materiTitle='') {
  selectedMateriId = materiId;
  selectedMateriTitle = materiTitle || '';
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${selectedMateriTitle}`;

  if (soalPanel) { soalPanel.style.display = 'block'; }
  if (!soalList) return;

  soalList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    const q = query(collection(db, 'soal'), where('materiId','==', materiId));
    const snap = await getDocs(q);
    if (snap.empty) {
      soalList.innerHTML = `<div class="muted">Belum ada soal.</div>`;
      return;
    }
    soalList.innerHTML = '';
    snap.forEach(s => {
      const d = s.data() || {};
      const sid = s.id;
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
        const newCorrect = prompt('Edit kunci jawaban (A/B/C/D atau teks):', correct || '') || '';
        try {
          await updateDoc(doc(db, 'soal', sid), { question: newQ, correct: newCorrect });
          toast('Soal diperbarui', 'success');
          openSoal(materiId, selectedMateriTitle);
        } catch(e){ console.error(e); toast('Gagal update soal', 'error'); }
      });
      node.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Hapus soal ini?')) return;
        try {
          await deleteDoc(doc(db, 'soal', sid));
          toast('Soal dihapus', 'success');
          openSoal(materiId, selectedMateriTitle);
        } catch(e){ console.error(e); toast('Gagal hapus soal', 'error'); }
      });

      soalList.appendChild(node);
    });
  } catch(e){ console.error(e); soalList.innerHTML = `<div class="muted">Gagal memuat soal.</div>`; }
}

// open soal for embedded materi (index)
function openSoalEmbedded(courseId, materiIndex, title, courseData) {
  selectedMateriId = String(materiIndex);
  selectedMateriTitle = title || '';
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${selectedMateriTitle}`;
  soalPanel.style.display = 'block';
  soalList.innerHTML = '';

  const questions = (courseData && Array.isArray(courseData.materi) && courseData.materi[materiIndex] && Array.isArray(courseData.materi[materiIndex].questions))
    ? courseData.materi[materiIndex].questions
    : [];

  if (!questions || questions.length === 0) {
    soalList.innerHTML = `<div class="muted">Belum ada soal (embedded).</div>`;
    return;
  }

  questions.forEach((q, idx) => {
    const node = document.createElement('div');
    node.className = 'admin-item';
    const qtext = q.question || q.pertanyaan || q.text || '';
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
        const courseRef = doc(db, ROOT_COLLECTION, courseId);
        const cSnap = await getDoc(courseRef);
        if (!cSnap.exists()) { toast('Course not found', 'error'); return; }
        const cData = cSnap.data() || {};
        const arr = Array.isArray(cData.materi) ? cData.materi : [];
        arr[materiIndex].questions[idx].question = newQ;
        arr[materiIndex].questions[idx].correct = newCorrect;
        await updateDoc(courseRef, { materi: arr });
        toast('Soal embedded diperbarui', 'success');
        openMateri(courseId, selectedCourseData?.name || '');
        openSoalEmbedded(courseId, materiIndex, title, cData);
      } catch(e){ console.error(e); toast('Gagal update soal embedded', 'error'); }
    });
    node.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!confirm('Hapus soal embedded ini?')) return;
      try {
        const courseRef = doc(db, ROOT_COLLECTION, courseId);
        const cSnap = await getDoc(courseRef);
        if (!cSnap.exists()) { toast('Course not found', 'error'); return; }
        const cData = cSnap.data() || {};
        const arr = Array.isArray(cData.materi) ? cData.materi : [];
        arr[materiIndex].questions.splice(idx, 1);
        await updateDoc(courseRef, { materi: arr });
        toast('Soal embedded dihapus', 'success');
        openMateri(courseId, selectedCourseData?.name || '');
        openSoalEmbedded(courseId, materiIndex, title, cData);
      } catch(e){ console.error(e); toast('Gagal hapus soal embedded', 'error'); }
    });

    soalList.appendChild(node);
  });
}

// add soal (will try add top-level soal referencing materi id, or fallback to embedded)
addSoalBtn?.addEventListener('click', async () => {
  try {
    if (!selectedMateriId) return toast('Pilih materi terlebih dahulu', 'error');
    const teks = prompt('Teks soal:');
    if (!teks) return;
    const correct = prompt('Jawaban benar (A/B/C/D atau teks):') || '';

    // attempt to find materia doc under subcollection
    try {
      const mDocRef = doc(db, ROOT_COLLECTION, selectedCourseId, 'materi', String(selectedMateriId));
      const mSnap = await getDoc(mDocRef);
      if (mSnap.exists()) {
        // create top-level soal referencing materi doc id
        await addDoc(collection(db, 'soal'), {
          materiId: String(selectedMateriId),
          question: teks,
          correct,
          createdAt: Date.now()
        });
        toast('Soal ditambahkan (top-level)', 'success');
        openSoal(String(selectedMateriId), selectedMateriTitle);
        return;
      }
    } catch(_) { /* ignore */ }

    // fallback: embedded -> find course and update array
    try {
      const courseRef = doc(db, ROOT_COLLECTION, selectedCourseId);
      const cSnap = await getDoc(courseRef);
      if (cSnap.exists()) {
        const cData = cSnap.data() || {};
        const arr = Array.isArray(cData.materi) ? cData.materi : [];
        const idx = Number(selectedMateriId);
        if (!Number.isNaN(idx) && arr[idx]) {
          arr[idx].questions = arr[idx].questions || [];
          arr[idx].questions.push({ question: teks, correct, options: {}, id: 'q-'+Date.now() });
          await updateDoc(courseRef, { materi: arr });
          toast('Soal embedded ditambahkan', 'success');
          openMateri(selectedCourseId, selectedCourseData?.name || '');
          return;
        }
      }
    } catch(e){ console.error(e); }

    // final fallback: create top-level soal referencing selectedMateriId anyway
    await addDoc(collection(db, 'soal'), {
      materiId: String(selectedMateriId),
      question: teks,
      correct,
      createdAt: Date.now()
    });
    toast('Soal ditambahkan (referensi dibuat)', 'success');
    openSoal(String(selectedMateriId), selectedMateriTitle);

  } catch(e){ console.error(e); toast('Gagal tambah soal', 'error'); }
});

// ---------- AUTH (login/logout) ----------
if (loginForm) {
  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = (loginEmail?.value || '').trim();
    const pass = (loginPass?.value || '');
    if (!email || !pass) { toast('Email & password wajib diisi', 'error'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle showing admin UI
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

// ---------- initial boot ----------
document.addEventListener('DOMContentLoaded', () => {
  // initial UI: show login box by default (until auth state resolved)
  hideAllAdminPanels();
  if (loginBox) loginBox.style.display = 'block';
  if (loginForm) loginForm.style.display = 'block';
});

// ---------- Optional: refresh button ----------
btnRefresh?.addEventListener('click', async () => {
  await determineRootCollection();
  await loadCourses();
});
