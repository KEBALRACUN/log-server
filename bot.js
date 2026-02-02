const dgram = require('dgram'); // Penerima Sinyal UDP (MikroTik)
const axios = require('axios'); // Pengirim HTTP (Ke Vercel)

// =========================================================
// ⚠️ GANTI INI DENGAN LINK VERCEL KAMU (TANPA SLASH DI BELAKANG)
const TARGET_URL = 'https://log-server-five.vercel.app'; 
const UDP_PORT = 5140; // Port Standar Syslog
// =========================================================

const server = dgram.createSocket('udp4');

console.log('------------------------------------------------');
console.log('   📡 RADAR MIKROTIK AKTIF   ');
console.log(`   🎯 Target Server: ${TARGET_URL}`);
console.log('------------------------------------------------');

// Saat menerima sinyal log dari MikroTik
server.on('message', (msg, rinfo) => {
    const rawLog = msg.toString();
    console.log(`[TERIMA] ${rinfo.address} >> ${rawLog.substring(0, 40)}...`);

    // Kirim data ke Vercel
    kirimKePusat(rawLog, rinfo.address);
});

async function kirimKePusat(logMentah, ipRouter) {
    // 1. Analisa Level Bahaya
    let level = 'INFO';
    const txt = logMentah.toLowerCase();
    
    if (txt.includes('error') || txt.includes('failure')) level = 'ERROR';
    else if (txt.includes('warn') || txt.includes('firewall')) level = 'WARN';
    else if (txt.includes('login') || txt.includes('user')) level = 'AUTH';

    // 2. Bersihkan pesan (Buang kode <30>)
    const cleanMsg = logMentah.replace(/<[0-9]+>/g, '').trim();

    try {
        await axios.post(`${TARGET_URL}/api/logs`, {
            level: level,
            message: cleanMsg,
            ip: ipRouter
        });
    } catch (error) {
        console.error(`[GAGAL KIRIM] Server Vercel Menolak: ${error.message}`);
    }
}

server.bind(UDP_PORT, () => {
    console.log(`✅ MENUNGGU LOG DI PORT: ${UDP_PORT}`);
    console.log(`⚠️  Setting MikroTik Remote Address ke IP Laptop ini!`);
});