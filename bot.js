const dgram = require('dgram');
const axios = require('axios');

// =========================================================
// ⚠️ KONFIGURASI
// =========================================================
const TARGET_URL = 'https://log-server-five.vercel.app'; 
const UDP_PORT = 5140; 

// Buat server UDP
const server = dgram.createSocket('udp4');

// Variabel Anti-Spam
let lastLogHash = "";
let lastLogTime = 0;

console.log('------------------------------------------------');
console.log('   📡 RADAR MIKROTIK V4 (DIAGNOSTIC MODE)   ');
console.log(`   🎯 Target Web: ${TARGET_URL}`);
console.log('------------------------------------------------');

// ============================================================
// 1. EVENT SAAT SERVER SIAP (BINDING)
// ============================================================
server.on('listening', () => {
    const address = server.address();
    console.log(`✅ SERVER AKTIF! Mendengarkan di: ${address.address}:${address.port}`);
    console.log(`⚠️  PENTING: Pastikan di WinBox > System > Logging > Action > Remote`);
    console.log(`    Remote Address = IP Laptop ini (Cek ipconfig, biasanya 192.168.56.1)`);
    console.log(`    Remote Port    = ${UDP_PORT}`);
});

// ============================================================
// 2. EVENT SAAT ADA LOG MASUK (DEBUGGING)
// ============================================================
server.on('message', (msg, rinfo) => {
    // Tampilkan mentah-mentah dulu buat bukti masuk
    const rawLog = msg.toString();
    console.log(`[RAW DARI ${rinfo.address}] ${rawLog.substring(0, 30)}...`); 

    // Bersihkan Log
    let cleanLog = rawLog.replace(/^<[0-9]+>.*?\sMikroTik\s/, '').trim();
    if (cleanLog === rawLog) cleanLog = rawLog.replace(/<[0-9]+>/g, '').trim();

    // Anti-Spam Sederhana
    const now = Date.now();
    if (cleanLog === lastLogHash && (now - lastLogTime) < 1000) {
        // console.log("   (Duplikat dibuang)"); 
        return; 
    }
    lastLogHash = cleanLog;
    lastLogTime = now;

    // Kirim ke Web
    kirimKePusat(cleanLog, rinfo.address);
});

// ============================================================
// 3. EVENT ERROR
// ============================================================
server.on('error', (err) => {
    console.log(`❌ SERVER ERROR: ${err.stack}`);
    server.close();
});

// ============================================================
// LOGIC PENGIRIM & PARSING
// ============================================================
async function kirimKePusat(logMentah, ipRouter) {
    let level = 'INFO';
    const txt = logMentah.toLowerCase();

    // -- LOGIC LEVEL SEDERHANA NAMUN KUAT --
    if (txt.includes('error') || txt.includes('failure') || txt.includes('critical')) level = 'CRITICAL';
    else if (txt.includes('logged in')) level = 'LOGIN_SUCCESS';
    else if (txt.includes('login failure') || txt.includes('invalid')) level = 'LOGIN_FAIL';
    else if (txt.includes('logged out')) level = 'LOGOUT';
    else if (txt.includes('interface') || txt.includes('link')) level = 'SYSTEM';
    else if (txt.includes('dhcp') || txt.includes('assigned')) level = 'NETWORK';
    else if (txt.includes('firewall') || txt.includes('ping') || txt.includes('icmp')) level = 'TRAFFIC';
    else if (txt.includes('added') || txt.includes('removed') || txt.includes('changed')) level = 'CONFIG';

    try {
        await axios.post(`${TARGET_URL}/api/logs`, {
            level: level,
            message: logMentah,
            ip: ipRouter
        });
        console.log(`   └─ [TERKIRIM KE WEB] ${level}`);
    } catch (error) {
        console.error(`   └─ [GAGAL KE WEB] ${error.message}`);
    }
}

// BIND KE '0.0.0.0' AGAR MENDENGAR DARI SEMUA JALUR (WIFI, LAN, VIRTUALBOX)
server.bind(UDP_PORT, '0.0.0.0');