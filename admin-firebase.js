// admin-firebase.js (FINAL: Dropdown + "create new material")
// Firebase modular v9.22.0 — compatible with your user.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

/* ---------- FIREBASE CONFIG (use your config) ---------- */
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
const qsa = sel => Array.from(document.querySelectorAll(sel||''));
const safe = v => (v===undefined||v===null)?'':String(v);

/* ---------- UI refs (must match admin.html) ---------- */
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
// hide addMateriBtn if present because materials generated from soal
const addMateriBtn = $('addMateriBtn');

const soalPanel = $('soalPanel');
const soalList = $('soalList');
const soalMateriTitle = $('soalMateriTitle');
const addSoalBtn = $('addSoalBtn');

const btnRefresh = $('btnRefresh');

/* ---------- App State ---------- */
let ROOT_COLLECTION = null; // 'courses' or 'mata_kuliah'
let selectedCourseId = null;
let selectedCourseName = '';
let selectedMaterialKey = null; // string name of the material group

/* ---------- Toast ---------- */
function toast(msg, type='info'){
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
    el.style.background = type === 'error' ? '#ef4444' : (type==='success'?'#16a34a':'#0b74de');
    document.body.appendChild(el);
    setTimeout(()=> el.style.opacity = '0', 1700);
    setTimeout(()=> el.remove(), 2100);
  } catch(e){ console.warn(e); }
}

/* ---------- Show/hide helpers ---------- */
function hideAllAdminPanels(){
  if (coursesView) coursesView.style.display = 'none';
  if (materiPanel) materiPanel.style.display = 'none';
  if (soalPanel) soalPanel.style.display = 'none';
  if (logoutWrap) logoutWrap.style.display = 'none';
  if (adminMain) adminMain.style.display = 'none';
  if (sidebarBox) sidebarBox.style.display = 'none';
  if (loginBox) loginBox.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
}

function showLoginOnly(){
  hideAllAdminPanels();
  if (loginBox) loginBox.style.display = 'block';
  if (loginForm) loginForm.style.display = 'block';
}

function showAdminUI(user){
  hideAllAdminPanels();
  if (adminMain) adminMain.style.display = 'block';
  if (sidebarBox) sidebarBox.style.display = 'block';
  if (coursesView) coursesView.style.display = 'flex';
  if (logoutWrap) logoutWrap.style.display = 'block';
  if (signedEmail) signedEmail.textContent = user?.email || user?.uid || '';
}

/* ---------- Determine root collection ---------- */
async function determineRootCollection(){
  if (ROOT_COLLECTION) return ROOT_COLLECTION;
  try {
    const s = await getDocs(query(collection(db,'courses'), orderBy('createdAt','desc')));
    if (!s.empty) { ROOT_COLLECTION = 'courses'; return ROOT_COLLECTION; }
  } catch(e){}
  try {
    const s2 = await getDocs(query(collection(db,'mata_kuliah'), orderBy('createdAt','desc')));
    if (!s2.empty) { ROOT_COLLECTION = 'mata_kuliah'; return ROOT_COLLECTION; }
  } catch(e){}
  ROOT_COLLECTION = 'courses';
  return ROOT_COLLECTION;
}

/* ---------- COURSES: load ---------- */
async function loadCourses(){
  if (!coursesAdminList) return;
  coursesAdminList.innerHTML = `<div class="muted">Memuat...</div>`;
  try {
    await determineRootCollection();
    const snaps = await getDocs(query(collection(db, ROOT_COLLECTION), orderBy('createdAt','desc')));
    if (snaps.empty) {
      coursesAdminList.innerHTML = `<div class="muted">Belum ada mata kuliah.</div>`;
      return;
    }
    coursesAdminList.innerHTML = '';
    snaps.forEach(s => {
      const d = s.data() || {};
      const id = s.id;
      const name = d.name || d.nama || 'Untitled';
      const desc = d.description || d.desc || '';
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
      item.querySelector('[data-open]')?.addEventListener('click', ()=> openCourseMaterials(id, name));
      item.querySelector('[data-edit]')?.addEventListener('click', async ()=>{
        const newName = prompt('Edit nama mata kuliah:', name);
        if (!newName) return;
        const newDesc = prompt('Edit deskripsi (opsional):', desc||'') || '';
        try {
          await updateDoc(doc(db, ROOT_COLLECTION, id), { name: newName, description: newDesc });
          toast('Mata kuliah diperbarui', 'success');
          loadCourses();
        } catch(e){ console.error(e); toast('Gagal update', 'error'); }
      });
      item.querySelector('[data-del]')?.addEventListener('click', async ()=>{
        if (!confirm('Hapus mata kuliah ini? Semua soal terkait juga akan dihapus.')) return;
        try {
          const soalQ = query(collection(db,'soal'), where('courseId','==', id));
          const sSnap = await getDocs(soalQ);
          for (const sd of sSnap.docs) await deleteDoc(doc(db,'soal', sd.id));
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

/* ---------- add course ---------- */
addCourseBtn?.addEventListener('click', async ()=>{
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

/* ---------- CORE: open course & generate materials from `soal` ---------- */
async function openCourseMaterials(courseId, courseName=''){
  selectedCourseId = courseId;
  selectedCourseName = courseName || '';
  if (materiCourseTitle) materiCourseTitle.textContent = `Materi — ${selectedCourseName}`;

  if (materiPanel) materiPanel.style.display = 'block';
  if (soalPanel) soalPanel.style.display = 'none';

  if (!materiList) return;
  materiList.innerHTML = `<div class="muted">Memuat materi dari soal...</div>`;

  try {
    const soalQ = query(collection(db,'soal'), where('courseId','==', selectedCourseId), orderBy('createdAt','desc'));
    const sSnap = await getDocs(soalQ);

    if (sSnap.empty) {
      materiList.innerHTML = `<div class="muted">Belum ada soal untuk mata kuliah ini.</div>`;
      return;
    }

    // group by materi field (normalize trim)
    const groups = {};
    sSnap.forEach(s => {
      const d = s.data() || {};
      let m = (d.materi || d.materiName || '').toString().trim();
      if (!m) m = 'Umum';
      const key = m; // case-sensitive; change to toLowerCase() if prefer insensitive
      if (!groups[key]) groups[key] = { title: m, count: 0, latest: 0 };
      groups[key].count++;
      const ts = d.createdAt || 0;
      if (ts > groups[key].latest) groups[key].latest = ts;
    });

    const arr = Object.keys(groups).map(k => ({ key: k, ...groups[k] }))
      .sort((a,b) => (b.latest - a.latest) || a.title.localeCompare(b.title));

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
      node.querySelector('[data-open]')?.addEventListener('click', ()=> {
        selectedMaterialKey = g.key;
        openSoalForMaterial(g.key);
      });
      node.querySelector('[data-rename]')?.addEventListener('click', async ()=>{
        const newName = prompt('Ganti nama materi:', g.title);
        if (!newName || newName.trim()==='') return;
        if (!confirm(`Ganti nama materi "${g.title}" menjadi "${newName}" pada semua soal?`)) return;
        try {
          // update all soal for this course where materi matches g.title
          const soalQ2 = query(collection(db,'soal'), where('courseId','==', selectedCourseId));
          const sSnap2 = await getDocs(soalQ2);
          for (const sd of sSnap2.docs){
            const data = sd.data() || {};
            let m = (data.materi || '').toString().trim();
            if (!m) m = 'Umum';
            if (m === g.title) {
              await updateDoc(doc(db,'soal', sd.id), { materi: newName });
            }
          }
          toast('Nama materi diperbarui', 'success');
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

/* ---------- open soal for selected material ---------- */
async function openSoalForMaterial(materiKey){
  selectedMaterialKey = materiKey;
  if (soalMateriTitle) soalMateriTitle.textContent = `Soal — ${selectedMaterialKey}`;
  if (soalPanel) soalPanel.style.display = 'block';
  if (!soalList) return;
  soalList.innerHTML = `<div class="muted">Memuat soal...</div>`;

  try {
    const soalQ = query(collection(db,'soal'), where('courseId','==', selectedCourseId), orderBy('createdAt','desc'));
    const sSnap = await getDocs(soalQ);
    const items = [];
    sSnap.forEach(s => {
      const d = s.data() || {};
      let m = (d.materi || d.materiName || '').toString().trim();
      if (!m) m = 'Umum';
      if (m === materiKey) items.push({ id: s.id, data: d });
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
      node.querySelector('[data-edit]')?.addEventListener('click', ()=> showSoalDialog({ id: sid, data: d }, true));
      node.querySelector('[data-del]')?.addEventListener('click', async ()=>{
        if (!confirm('Hapus soal ini?')) return;
        try {
          await deleteDoc(doc(db,'soal', sid));
          toast('Soal dihapus', 'success');
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

/* ---------- Utility: fetch distinct materials for a course (sorted) ---------- */
async function getMaterialsForCourse(courseId){
  const res = new Set();
  try {
    const q = query(collection(db,'soal'), where('courseId','==', courseId), orderBy('createdAt','desc'));
    const sSnap = await getDocs(q);
    sSnap.forEach(s => {
      const d = s.data() || {};
      let m = (d.materi || d.materiName || '').toString().trim();
      if (!m) m = 'Umum';
      res.add(m);
    });
  } catch(e){ console.warn(e); }
  // put 'Umum' last so new materials more visible, sort alphabetically
  const arr = Array.from(res).sort((a,b)=>{
    if (a==='Umum') return 1;
    if (b==='Umum') return -1;
    return a.localeCompare(b);
  });
  return arr;
}

/* ---------- UI Dialog: Add/Edit Soal with dropdown + create-new ---------- */
function showSoalDialog(existing=null, isEdit=false){
  // existing: {id, data} when editing
  // build modal
  const overlay = document.createElement('div');
  overlay.style = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:99999";

  const box = document.createElement('div');
  box.style = "background:var(--card);padding:16px;border-radius:10px;min-width:320px;max-width:720px";
  box.innerHTML = `
    <h3 style="margin-top:0">${isEdit ? 'Edit Soal' : 'Tambah Soal'}</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <label>Soal:<br><textarea id="dlgQuestion" rows="3" style="width:100%"></textarea></label>
      <div style="display:flex;gap:8px">
        <label style="flex:1">A:<br><input id="dlgA" style="width:100%"/></label>
        <label style="flex:1">B:<br><input id="dlgB" style="width:100%"/></label>
      </div>
      <div style="display:flex;gap:8px">
        <label style="flex:1">C:<br><input id="dlgC" style="width:100%"/></label>
        <label style="flex:1">D:<br><input id="dlgD" style="width:100%"/></label>
      </div>
      <label>Jawaban benar (A/B/C/D atau teks):<br><input id="dlgCorrect" style="width:120px"/></label>
      <label>Materi:<br>
        <select id="dlgMaterial" style="width:100%;padding:6px"></select>
      </label>
      <input id="dlgNewMaterial" placeholder="Nama materi baru (jika pilih 'Tambah materi baru...')" style="display:none;width:100%;padding:6px"/>
      <div style="text-align:right;display:flex;gap:8px;justify-content:flex-end">
        <button id="dlgCancel" class="btn ghost">Batal</button>
        <button id="dlgSave" class="btn primary">${isEdit ? 'Simpan' : 'Tambah'}</button>
      </div>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const sel = box.querySelector('#dlgMaterial');
  const newMatInput = box.querySelector('#dlgNewMaterial');
  const qta = box.querySelector('#dlgQuestion');
  const aInp = box.querySelector('#dlgA');
  const bInp = box.querySelector('#dlgB');
  const cInp = box.querySelector('#dlgC');
  const dInp = box.querySelector('#dlgD');
  const corr = box.querySelector('#dlgCorrect');
  const cancelBtn = box.querySelector('#dlgCancel');
  const saveBtn = box.querySelector('#dlgSave');

  // populate materials into dropdown
  (async ()=>{
    sel.innerHTML = '';
    const mats = await getMaterialsForCourse(selectedCourseId);
    // Add a default prompt
    const chooseOpt = document.createElement('option');
    chooseOpt.value = '__choose__';
    chooseOpt.textContent = '-- pilih materi --';
    sel.appendChild(chooseOpt);
    mats.forEach(m=>{
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      sel.appendChild(o);
    });
    // option to create new
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = 'Tambah materi baru...';
    sel.appendChild(newOpt);

    // If editing, prefill with existing data
    if (isEdit && existing && existing.data) {
      qta.value = existing.data.question || existing.data.pertanyaan || existing.data.text || '';
      aInp.value = (existing.data.options && existing.data.options.A) || '';
      bInp.value = (existing.data.options && existing.data.options.B) || '';
      cInp.value = (existing.data.options && existing.data.options.C) || '';
      dInp.value = (existing.data.options && existing.data.options.D) || '';
      corr.value = existing.data.correct || existing.data.kunci || '';
      const curMat = (existing.data.materi || existing.data.materiName || '').toString().trim() || 'Umum';
      // try select curMat; if not present create a temporary option
      let found = false;
      for (const o of sel.options) {
        if (o.value === curMat) { o.selected = true; found = true; break; }
      }
      if (!found) {
        const tmp = document.createElement('option');
        tmp.value = curMat;
        tmp.textContent = curMat;
        sel.insertBefore(tmp, chooseOpt.nextSibling);
        tmp.selected = true;
      }
    }
  })();

  sel.addEventListener('change', ()=>{
    if (sel.value === '__new__') {
      newMatInput.style.display = 'block';
      newMatInput.focus();
    } else {
      newMatInput.style.display = 'none';
    }
  });

  cancelBtn.onclick = ()=> overlay.remove();

  saveBtn.onclick = async ()=>{
    const question = qta.value.trim();
    if (!question) { alert('Soal wajib diisi'); return; }
    const options = { A: aInp.value||'', B: bInp.value||'', C: cInp.value||'', D: dInp.value||'' };
    const correct = corr.value.trim();
    let material = '';
    if (sel.value === '__new__') {
      const nm = newMatInput.value.trim();
      if (!nm) { alert('Nama materi baru wajib diisi'); return; }
      material = nm;
    } else if (sel.value === '__choose__') {
      // default to Umum
      material = 'Umum';
    } else {
      material = sel.value;
    }

    try {
      if (isEdit && existing && existing.id) {
        // update existing soal
        await updateDoc(doc(db,'soal', existing.id), {
          question,
          options,
          correct,
          materi: material
        });
        toast('Soal diperbarui', 'success');
      } else {
        // create new soal
        await addDoc(collection(db,'soal'), {
          courseId: selectedCourseId,
          materi: material,
          question,
          options,
          correct,
          createdAt: Date.now()
        });
        toast('Soal ditambahkan', 'success');
      }
      overlay.remove();
      // refresh groups and open the material where we added/edited
      openCourseMaterials(selectedCourseId, selectedCourseName);
      openSoalForMaterial(material);
    } catch(e){
      console.error(e);
      toast('Gagal simpan soal', 'error');
    }
  };
}

/* ---------- addSoalBtn wired to dialog ---------- */
addSoalBtn?.addEventListener('click', ()=>{
  if (!selectedCourseId) return toast('Pilih mata kuliah terlebih dahulu', 'error');
  showSoalDialog(null, false);
});

/* ---------- AUTH ---------- */
if (loginForm){
  loginForm.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const email = (loginEmail?.value||'').trim();
    const pass = (loginPass?.value||'');
    if (!email||!pass){ toast('Email & password wajib diisi','error'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch(err){ console.error(err); toast('Gagal login: '+(err.message||err.code),'error'); }
  });
}
if (btnLogout){
  btnLogout.addEventListener('click', async ()=>{
    try {
      await signOut(auth);
      toast('Logout berhasil', 'success');
      showLoginOnly();
    } catch(e){ console.warn(e); toast('Logout gagal','error'); }
  });
}

/* ---------- Auth watcher ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { showLoginOnly(); return; }
  showAdminUI(user);
  await determineRootCollection();
  await loadCourses();
});

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  hideAllAdminPanels();
  if (loginBox) loginBox.style.display = 'block';
  if (loginForm) loginForm.style.display = 'block';
});

/* ---------- refresh ---------- */
btnRefresh?.addEventListener('click', async ()=>{
  if (!selectedCourseId) await loadCourses();
  else await openCourseMaterials(selectedCourseId, selectedCourseName);
});
