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
    //logika sortir
    if (txt.includes('error') || txt.includes('failure') || txt.includes('critical')) {
        level = 'CRITICAL'; // Merah Tua (Bahaya)
    } 
    else if (txt.includes('logged in')) {
        level = 'LOGIN_SUCCESS'; // Hijau Neon (Ada yang masuk)
    }
    else if (txt.includes('login failure') || txt.includes('invalid user')) {
        level = 'LOGIN_FAIL'; // Merah (Ada yang coba bobol)
    }
    else if (txt.includes('logged out')) {
        level = 'LOGOUT'; // Kuning (Target pergi)
    }
    else if (txt.includes('icmp') || txt.includes('ping') || txt.includes('firewall')) {
        level = 'TRAFFIC'; // Biru (Lalulintas data)
    }
    else if (txt.includes('dhcp') || txt.includes('assigned')) {
        level = 'NETWORK'; // Ungu (Perangkat connect)
    }
    else if (txt.includes('interface') || txt.includes('link up') || txt.includes('link down')) {
        level = 'SYSTEM'; // Putih (Status Kabel)
    }

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