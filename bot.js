const axios = require('axios');

// GANTI DENGAN LINK VERCEL KAMU YANG BENAR
const TARGET_URL = 'https://log-server-five.vercel.app'; 

const endpoints = [
    { method: 'get', path: '/' },
    { method: 'get', path: '/admin' }, // Ini akan bikin log WARN
    { method: 'post', path: '/upload' }, // Ini akan bikin log ERROR
    { method: 'get', path: '/login' },
    { method: 'get', path: '/api/logs' }
];

async function attack() {
    // Pilih target acak
    const target = endpoints[Math.floor(Math.random() * endpoints.length)];
    const fullUrl = `${TARGET_URL}${target.path}`;

    try {
        console.log(`🚀 Mengirim paket ke: ${fullUrl}`);
        if (target.method === 'get') {
            await axios.get(fullUrl);
        } else {
            await axios.post(fullUrl, { data: 'sampah' });
        }
        console.log("✅ Sukses terkirim!");
    } catch (error) {
        // Error itu bagus, berarti server mencatatnya sebagai serangan
        console.log(`💥 Server merespon: ${error.response ? error.response.status : 'Error Koneksi'}`);
    }
}

console.log("🔥 BOT DIAKTIFKAN: Mode Stabil (1 Detik/Tembakan)");

// --- PENTING: JEDA WAKTU ---
// Jalankan attack() setiap 1000ms (1 detik)
setInterval(attack, 1000);