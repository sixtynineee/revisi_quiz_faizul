/* edit.js
   Halaman edit soal: memuat data dari LocalStorage dan mengisi form.
   Terpisah untuk menjaga script.js tetap ringkas.
*/
const STORAGE_KEY = 'quizData_v1';

function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return null;
  try{ return JSON.parse(raw); } catch(e){ return null; }
}

function saveData(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function getParam(name){
  return new URLSearchParams(location.search).get(name);
}

function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]) }

document.addEventListener('DOMContentLoaded', ()=>{
  const courseId = getParam('course');
  const qid = getParam('qid');
  const data = loadData();
  if(!data){
    alert('Data tidak ditemukan. Pastikan Anda sudah membuka admin dan menyimpan minimal 1 mata kuliah.');
    return;
  }
  const course = data.courses.find(c=>c.id === courseId);
  if(!course){
    alert('Mata kuliah tidak ditemukan.');
    return;
  }
  document.getElementById('editingCourseName').innerText = 'Mata Kuliah: ' + course.name;

  // if qid present -> edit specific question
  if(!qid){
    // redirect to admin (we expect qid when editing a specific soal)
    // but allow opening page to edit general course (not used)
    // simply show message and redirect
    // location.href = 'admin.html';
    // return;
  }

  const question = course.questions.find(q=>q.id === qid);
  if(!question){
    alert('Soal tidak ditemukan. Anda bisa membuka halaman admin untuk menambah soal baru.');
    return;
  }

  // populate form
  document.getElementById('edit_q_text').value = question.text;
  document.getElementById('edit_q_a').value = question.choices.A;
  document.getElementById('edit_q_b').value = question.choices.B;
  document.getElementById('edit_q_c').value = question.choices.C;
  document.getElementById('edit_q_d').value = question.choices.D;
  document.getElementById('edit_q_answer').value = question.answer;
  document.getElementById('edit_q_explain').value = question.explain || '';

  // submit handler
  document.getElementById('editQuestionForm').addEventListener('submit', (ev)=>{
    ev.preventDefault();
    question.text = document.getElementById('edit_q_text').value.trim();
    question.choices = {
      A: document.getElementById('edit_q_a').value.trim(),
      B: document.getElementById('edit_q_b').value.trim(),
      C: document.getElementById('edit_q_c').value.trim(),
      D: document.getElementById('edit_q_d').value.trim(),
    };
    question.answer = document.getElementById('edit_q_answer').value;
    question.explain = document.getElementById('edit_q_explain').value.trim();
    saveData(data);
    alert('Perubahan disimpan.');
    location.href = `admin.html?select=${encodeURIComponent(courseId)}`;
  });

  document.getElementById('cancelEdit').addEventListener('click', ()=>{
    location.href = `admin.html?select=${encodeURIComponent(courseId)}`;
  });
});
