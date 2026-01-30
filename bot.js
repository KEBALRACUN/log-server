const dgram = require('dgram'); // Modul UDP (Bawaan Node.js)
const axios = require('axios'); // Pengirim HTTP

// ==========================================
// ⚠️ KONFIGURASI TARGET ⚠️
// Ganti dengan URL Vercel Komandan yang sudah dideploy
const TARGET_URL = 'https://nama-project-kamu.vercel.app/api/logs'; 
const LISTENING_PORT = 5140;
// ==========================================

const server = dgram.createSocket('udp4');

console.log('------------------------------------------------');
console.log('   MIKROTIK TO VERCEL BRIDGE   ');
console.log('   Mode: REALTIME MONITORING   ');
console.log('------------------------------------------------');

server.on('error', (err) => {
  console.log(`[ERROR] Server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  const rawLog = msg.toString();
  
  // Tampilkan di terminal laptop (biar kelihatan ada aktivitas)
  console.log(`[RADAR] ${rinfo.address} >> ${rawLog.substring(0, 50)}...`);

  // Kirim ke Database (Vercel/MongoDB)
  kirimKePusat(rawLog, rinfo.address);
});

server.on('listening', () => {
  const address = server.address();
  console.log(`📡 RADAR AKTIF! Menunggu data di UDP Port ${address.port}`);
  console.log(`💻 IP Laptop ini untuk di-setting di MikroTik: (Lihat ipconfig)`);
});

server.bind(LISTENING_PORT);

async function kirimKePusat(logMentah, ipRouter) {
    // 1. Analisa Level Log (Warna)
    let level = 'INFO';
    const txt = logMentah.toLowerCase();
    
    if (txt.includes('error') || txt.includes('failure') || txt.includes('critical')) level = 'ERROR';
    else if (txt.includes('warn') || txt.includes('firewall')) level = 'WARN';
    else if (txt.includes('login') || txt.includes('user') || txt.includes('account')) level = 'AUTH';

    // 2. Bersihkan Pesan (Hapus header syslog <30> dst)
    // Biasanya format: "<30> system,info,account ..." -> Kita ambil isinya saja
    let cleanMsg = logMentah.replace(/<[0-9]+>/g, '').trim();

    try {
        // Tembak ke API Vercel
        await axios.post(TARGET_URL, {
            level: level,
            message: cleanMsg,
            ip: ipRouter
        });
    } catch (error) {
        console.error(`[GAGAL KIRIM] ${error.message}`);
    }
}