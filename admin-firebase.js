// =============================
// ADMIN FIREBASE JS (FINAL)
// =============================

import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";

import { 
  getFirestore, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

/* ---------- ELEMENT UTILITY ---------- */
const $ = id => document.getElementById(id);

/* ---------------------------------------------------
   LOAD SEMUA MATA KULIAH
----------------------------------------------------*/
async function loadCourses() {
  const root = $("coursesAdminList");
  root.innerHTML = "<div class='muted'>Memuat...</div>";

  const snap = await getDocs(collection(db, "courses"));

  root.innerHTML = "";

  snap.forEach(docSnap => {
    const c = docSnap.data();
    const cid = docSnap.id;

    const materiCount = Array.isArray(c.materi) ? c.materi.length : 0;

    const el = document.createElement("div");
    el.className = "admin-item";
    el.innerHTML = `
      <div>
        <b>${c.name}</b><br>
        <span class="muted">${materiCount} materi</span>
      </div>

      <div class="admin-actions">
        <button class="btn sm" data-edit="${cid}">Edit</button>
        <button class="btn sm" data-materi="${cid}">Materi</button>
        <button class="btn sm red" data-del="${cid}">Hapus</button>
      </div>
    `;

    root.appendChild(el);
  });

  // Wiring tombol
  qsa("[data-edit]").forEach(btn => {
    btn.onclick = () => openEditCourse(btn.dataset.edit);
  });

  qsa("[data-materi]").forEach(btn => {
    btn.onclick = () => openMateri(btn.dataset.materi);
  });

  qsa("[data-del]").forEach(btn => {
    btn.onclick = () => deleteCourse(btn.dataset.del);
  });
}

const qsa = sel => Array.from(document.querySelectorAll(sel));

/* ---------------------------------------------------
   TAMBAH MATA KULIAH
----------------------------------------------------*/
$("addCourseBtn").onclick = async () => {
  const name = prompt("Nama mata kuliah?");
  if (!name) return;

  await addDoc(collection(db, "courses"), {
    name,
    description: "",
    materi: []
  });

  loadCourses();
};

/* ---------------------------------------------------
   EDIT MATA KULIAH
----------------------------------------------------*/
async function openEditCourse(id) {
  const snap = await getDocs(collection(db, "courses"));
  let course = null;

  snap.forEach(s => {
    if (s.id === id) course = { id: s.id, ...s.data() };
  });

  if (!course) return alert("Data tidak ditemukan.");

  const newName = prompt("Edit nama:", course.name);
  if (!newName) return;

  await updateDoc(doc(db, "courses", id), {
    name: newName
  });

  loadCourses();
}

/* ---------------------------------------------------
   HAPUS MATA KULIAH
----------------------------------------------------*/
async function deleteCourse(id) {
  if (!confirm("Yakin hapus mata kuliah ini?")) return;
  await deleteDoc(doc(db, "courses", id));
  loadCourses();
}

/* ---------------------------------------------------
   BUKA DAFTAR MATERI
----------------------------------------------------*/
async function openMateri(courseId) {
  const snap = await getDocs(collection(db, "courses"));
  let course = null;

  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  if (!course) return alert("Tidak ditemukan");

  $("materiPanel").style.display = "block";
  $("materiCourseTitle").textContent = course.name;
  $("materiList").innerHTML = "";

  const list = course.materi || [];

  list.forEach((m, i) => {
    const el = document.createElement("div");
    el.className = "admin-item";
    el.innerHTML = `
      <div>
        <b>${m.title}</b><br>
        <span class="muted">${m.questions.length} soal</span>
      </div>

      <div class="admin-actions">
        <button class="btn sm" data-edit-m="${i}" data-course="${courseId}">Edit</button>
        <button class="btn sm" data-soal-m="${i}" data-course="${courseId}">Soal</button>
        <button class="btn sm red" data-del-m="${i}" data-course="${courseId}">Hapus</button>
      </div>
    `;

    $("materiList").appendChild(el);
  });

  // Wiring
  qsa("[data-edit-m]").forEach(btn => {
    btn.onclick = () => editMateri(courseId, btn.dataset.editM);
  });

  qsa("[data-del-m]").forEach(btn => {
    btn.onclick = () => deleteMateri(courseId, btn.dataset.delM);
  });

  qsa("[data-soal-m]").forEach(btn => {
    btn.onclick = () => openSoal(courseId, btn.dataset.soalM);
  });

  $("addMateriBtn").onclick = () => addMateri(courseId);
}

/* ---------------------------------------------------
   TAMBAH MATERI
----------------------------------------------------*/
async function addMateri(courseId) {
  const title = prompt("Judul materi?");
  if (!title) return;

  const snap = await getDocs(collection(db, "courses"));
  let course = null;

  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  course.materi.push({
    id: "m-" + Math.random().toString(36).slice(2, 8),
    title,
    description: "",
    questions: []
  });

  await updateDoc(doc(db, "courses", courseId), { materi: course.materi });

  openMateri(courseId);
}

/* ---------------------------------------------------
   EDIT MATERI
----------------------------------------------------*/
async function editMateri(courseId, materiIndex) {
  const snap = await getDocs(collection(db, "courses"));
  let course = null;
  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  const m = course.materi[materiIndex];

  const newTitle = prompt("Edit judul:", m.title);
  if (!newTitle) return;

  m.title = newTitle;

  await updateDoc(doc(db, "courses", courseId), { materi: course.materi });

  openMateri(courseId);
}

/* ---------------------------------------------------
   HAPUS MATERI
----------------------------------------------------*/
async function deleteMateri(courseId, materiIndex) {
  if (!confirm("Hapus materi ini?")) return;

  const snap = await getDocs(collection(db, "courses"));
  let course = null;
  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  course.materi.splice(materiIndex, 1);

  await updateDoc(doc(db, "courses", courseId), { materi: course.materi });

  openMateri(courseId);
}

/* ---------------------------------------------------
   BUKA SOAL
----------------------------------------------------*/
async function openSoal(courseId, materiIndex) {
  $("soalPanel").style.display = "block";

  const snap = await getDocs(collection(db, "courses"));
  let course = null;
  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  const materi = course.materi[materiIndex];

  $("soalMateriTitle").textContent = materi.title;

  const root = $("soalList");
  root.innerHTML = "";

  materi.questions.forEach((q, i) => {
    const el = document.createElement("div");
    el.className = "admin-item";
    el.innerHTML = `
      <div><b>${i + 1}.</b> ${q.question}</div>
      <div class="admin-actions">
        <button class="btn sm" data-edit-q="${i}" data-course="${courseId}" data-m="${materiIndex}">Edit</button>
        <button class="btn sm red" data-del-q="${i}" data-course="${courseId}" data-m="${materiIndex}">Hapus</button>
      </div>
    `;

    root.appendChild(el);
  });

  $("addSoalBtn").onclick = () => addSoal(courseId, materiIndex);

  qsa("[data-edit-q]").forEach(btn => {
    btn.onclick = () =>
      editSoal(courseId, btn.dataset.m, btn.dataset.editQ);
  });

  qsa("[data-del-q]").forEach(btn => {
    btn.onclick = () =>
      deleteSoal(courseId, btn.dataset.m, btn.dataset.delQ);
  });
}

/* ---------------------------------------------------
   TAMBAH SOAL
----------------------------------------------------*/
async function addSoal(courseId, materiIndex) {
  const qText = prompt("Isi soal:");
  if (!qText) return;

  const a = prompt("Opsi A:");
  const b = prompt("Opsi B:");
  const c = prompt("Opsi C:");
  const d = prompt("Opsi D:");

  const correct = prompt("Jawaban benar (A/B/C/D):").toUpperCase();
  const explanation = prompt("Penjelasan:");

  const snap = await getDocs(collection(db, "courses"));
  let course = null;
  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  course.materi[materiIndex].questions.push({
    question: qText,
    options: { A: a, B: b, C: c, D: d },
    correct,
    explanation
  });

  await updateDoc(doc(db, "courses", courseId), { materi: course.materi });

  openSoal(courseId, materiIndex);
}

/* ---------------------------------------------------
   EDIT SOAL
----------------------------------------------------*/
async function editSoal(courseId, materiIndex, qIndex) {
  const snap = await getDocs(collection(db, "courses"));
  let course = null;
  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  const q = course.materi[materiIndex].questions[qIndex];

  const newQ = prompt("Soal:", q.question);
  if (!newQ) return;

  q.question = newQ;
  q.options.A = prompt("Opsi A:", q.options.A);
  q.options.B = prompt("Opsi B:", q.options.B);
  q.options.C = prompt("Opsi C:", q.options.C);
  q.options.D = prompt("Opsi D:", q.options.D);

  q.correct = prompt("Jawaban benar:", q.correct).toUpperCase();
  q.explanation = prompt("Penjelasan:", q.explanation);

  await updateDoc(doc(db, "courses", courseId), { materi: course.materi });

  openSoal(courseId, materiIndex);
}

/* ---------------------------------------------------
   HAPUS SOAL
----------------------------------------------------*/
async function deleteSoal(courseId, materiIndex, qIndex) {
  if (!confirm("Hapus soal ini?")) return;

  const snap = await getDocs(collection(db, "courses"));
  let course = null;
  snap.forEach(s => {
    if (s.id === courseId) course = { id: s.id, ...s.data() };
  });

  course.materi[materiIndex].questions.splice(qIndex, 1);

  await updateDoc(doc(db, "courses", courseId), { materi: course.materi });

  openSoal(courseId, materiIndex);
}

/* ---------------------------------------------------
   INIT
----------------------------------------------------*/
document.addEventListener("DOMContentLoaded", loadCourses);
