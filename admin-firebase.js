// admin-firebase.js (FINAL VERSION)
// ------------------------------------------------------------
// Firebase
// ------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------
// UTIL
// ------------------------------------------------------------
const $ = id => document.getElementById(id);

// Switch admin page
function showPage(pg){
  ["loginPage","adminPage"].forEach(x=>{
    $(x).style.display = "none";
  });
  $(pg).style.display = "block";
}

// Escape HTML
const esc = s => String(s||"").replace(/[&<>"]/g,m=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
}[m]));

// ------------------------------------------------------------
// LOGIN ADMIN
// ------------------------------------------------------------
$("adminLoginBtn").onclick = async () => {
  const email = $("adminEmail").value;
  const pass  = $("adminPass").value;

  try {
    await signInWithEmailAndPassword(auth,email,pass);
  } catch(e){
    alert("Login gagal: " + e.message);
  }
};

// ------------------------------------------------------------
// AUTH STATE CHECK
// ------------------------------------------------------------
onAuthStateChanged(auth, user => {
  if(user){
    loadCourses();
    showPage("adminPage");
  } else {
    showPage("loginPage");
  }
});

// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------
$("logoutBtn").onclick = ()=> signOut(auth);

// ------------------------------------------------------------
// FIRESTORE: LOAD COURSES
// ------------------------------------------------------------
async function loadCourses(){
  const root = $("adminCourses");
  root.innerHTML = "<div class='muted'>Loading...</div>";

  const snap = await getDocs(collection(db,"courses"));
  const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));

  root.innerHTML = "";

  list.forEach(c=>{
    const el = document.createElement("div");
    el.className = "admin-course-item";

    const materiCount = Array.isArray(c.materi) ? c.materi.length : 0;

    el.innerHTML = `
      <div>
        <b>${esc(c.name)}</b><br>
        <span class="muted">${materiCount} materi</span>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn sm" data-edit="${c.id}">Edit</button>
        <button class="btn danger sm" data-del="${c.id}">Hapus</button>
      </div>
    `;
    root.appendChild(el);
  });

  // Edit course
  document.querySelectorAll("[data-edit]").forEach(b=>{
    b.onclick = ()=> editCourse(b.dataset.edit);
  });

  // Delete course
  document.querySelectorAll("[data-del]").forEach(b=>{
    b.onclick = ()=> deleteCourse(b.dataset.del);
  });
}

// ------------------------------------------------------------
// ADD COURSE
// ------------------------------------------------------------
$("addCourseBtn").onclick = async ()=>{
  const name = prompt("Nama mata kuliah ?");
  if(!name) return;

  await addDoc(collection(db,"courses"),{
    name:name,
    materi:[]
  });

  loadCourses();
};

// ------------------------------------------------------------
// DELETE COURSE
// ------------------------------------------------------------
async function deleteCourse(id){
  if(!confirm("Hapus mata kuliah ini?")) return;
  await deleteDoc(doc(db,"courses",id));
  loadCourses();
}

// ------------------------------------------------------------
// EDIT COURSE + MATERI + SOAL
// ------------------------------------------------------------
let EDIT_ID = null;

async function editCourse(id){
  EDIT_ID = id;
  const snap = await getDocs(collection(db,"courses"));
  const data = snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>x.id===id);

  $("editTitle").textContent = "Edit — " + data.name;

  renderMateriEditor(data);

  $("editModal").style.display = "block";
}

$("closeModal").onclick = ()=> $("editModal").style.display="none";

// ------------------------------------------------------------
// RENDER MATERI EDITOR
// ------------------------------------------------------------
function renderMateriEditor(course){
  const box = $("materiEditor");
  box.innerHTML = "";

  course.materi.forEach((m,idx)=>{
    const item = document.createElement("div");
    item.className = "materi-item";
    item.innerHTML = `
      <div><b>${esc(m.title)}</b><br><span class="muted">${esc(m.description)}</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn sm" data-editm="${idx}">Materi</button>
        <button class="btn sm" data-soal="${idx}">Soal</button>
        <button class="btn danger sm" data-delm="${idx}">Hapus</button>
      </div>
    `;
    box.appendChild(item);
  });

  // add materi
  $("addMateriBtn").onclick = ()=> addMateri(course);

  // events
  box.querySelectorAll("[data-editm]").forEach(b=>{
    b.onclick = ()=> editMateri(course, parseInt(b.dataset.editm));
  });

  box.querySelectorAll("[data-soal]").forEach(b=>{
    b.onclick = ()=> editSoal(course, parseInt(b.dataset.soal));
  });

  box.querySelectorAll("[data-delm]").forEach(b=>{
    b.onclick = ()=> deleteMateri(course, parseInt(b.dataset.delm));
  });
}

// ------------------------------------------------------------
// ADD MATERI
// ------------------------------------------------------------
async function addMateri(course){
  const title = prompt("Judul materi?");
  if(!title) return;

  course.materi.push({
    id: "m-" + Math.random().toString(36).slice(2,8),
    title,
    description:"",
    questions:[]
  });

  await updateDoc(doc(db,"courses",course.id),{
    materi:course.materi
  });

  editCourse(course.id);
}

// ------------------------------------------------------------
// EDIT MATERI (TITLE / DESCRIPTION)
// ------------------------------------------------------------
function editMateri(course,index){
  const m = course.materi[index];

  const title = prompt("Judul baru:", m.title) || m.title;
  const desc  = prompt("Deskripsi:", m.description) || m.description;

  m.title = title;
  m.description = desc;

  updateDoc(doc(db,"courses",course.id),{
    materi: course.materi
  }).then(()=> editCourse(course.id));
}

// ------------------------------------------------------------
// DELETE MATERI
// ------------------------------------------------------------
async function deleteMateri(course,index){
  if(!confirm("Hapus materi ini?")) return;
  course.materi.splice(index,1);

  await updateDoc(doc(db,"courses",course.id),{
    materi: course.materi
  });

  editCourse(course.id);
}

// ------------------------------------------------------------
// EDIT SOAL
// ------------------------------------------------------------
function editSoal(course, idx){
  const m = course.materi[idx];
  const out = [];

  m.questions.forEach((q,i)=>{
    out.push(
      `${i+1}. ${q.question}\nA. ${q.options.A}\nB. ${q.options.B}\nC. ${q.options.C}\nD. ${q.options.D}\nCorrect: ${q.correct}`
    );
  });

  const newText = prompt(
    "Edit semua soal. Format:\nPertanyaan?\nA: ...\nB: ...\nC: ...\nD: ...\nANSWER: A/B/C/D",
    out.join("\n\n")
  );

  if(!newText) return;

  // tidak parsing ribet — user bebas format
  // hanya disimpan sebagai raw satu block
  alert("Untuk versi ini, soal harus diinput lewat UI 'Add Soal' khusus (belum dibuat).");
}

// ------------------------------------------------------------
