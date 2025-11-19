/* pocketbase-api.js
   PBAPI - wrapper helper untuk operasi PocketBase
   Mengasumsikan window.pb sudah diinisialisasi.
*/

const PBAPI = {
  // fetch all soal (list). Mengembalikan array soal dalam format app.
  async fetchAllSoal() {
    if(!window.pb) throw new Error('PocketBase client not initialized');
    // gunakan pagination ringan jika banyak data (getFullList untuk demo kecil)
    try {
      const records = await window.pb.collection('soal').getFullList({
        sort: '-created'
      });
      return records.map(r => ({
        id: r.id,
        text: r.pertanyaan,
        choices: { A: r.opsi_a, B: r.opsi_b, C: r.opsi_c, D: r.opsi_d },
        answer: (r.jawaban_benar || '').toUpperCase(),
        explain: r.explain || '',
        raw: r
      }));
    } catch(err){
      console.error('PBAPI.fetchAllSoal error', err);
      throw err;
    }
  },

  async addSoal(payload){
    if(!window.pb) throw new Error('PocketBase client not initialized');
    // require login
    if(!window.pb.authStore.isValid) throw new Error('Admin not logged in. Login via admin.html terlebih dahulu.');
    const rec = await window.pb.collection('soal').create(payload);
    return rec;
  },

  async updateSoal(id, payload){
    if(!window.pb) throw new Error('PocketBase client not initialized');
    if(!window.pb.authStore.isValid) throw new Error('Admin not logged in.');
    const rec = await window.pb.collection('soal').update(id, payload);
    return rec;
  },

  async deleteSoal(id){
    if(!window.pb) throw new Error('PocketBase client not initialized');
    if(!window.pb.authStore.isValid) throw new Error('Admin not logged in.');
    const rec = await window.pb.collection('soal').delete(id);
    return rec;
  },

  // admin login using dashboard admin credentials (superuser)
  // Note: pb.admins.authWithPassword exists in PocketBase SDK
  async adminLogin(email, password){
    if(!window.pb) throw new Error('PocketBase client not initialized');
    const auth = await window.pb.admins.authWithPassword(email, password);
    return auth;
  },

  adminLogout(){
    if(!window.pb) return;
    window.pb.authStore.clear();
  }
};
