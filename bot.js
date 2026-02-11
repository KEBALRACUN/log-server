const dgram = require('dgram');
const axios = require('axios');
const os = require('os');

// =========================================================
// ⚙️ KONFIGURASI
// =========================================================
const TARGET_URL = 'https://log-server-five.vercel.app'; 
const UDP_PORT = 5140; 

// Buat server UDP
const server = dgram.createSocket('udp4');

// Variabel Anti-Spam
let lastLogHash = "";
let lastLogTime = 0;
let logCounter = 0;
let successCount = 0;
let failCount = 0;

// ============================================================
// FUNGSI HELPER: TAMPILKAN IP ADDRESS LAPTOP
// ============================================================
function getLocalIPAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (let interfaceName in interfaces) {
        for (let iface of interfaces[interfaceName]) {
            // Skip internal (loopback) dan IPv6
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({
                    interface: interfaceName,
                    ip: iface.address
                });
            }
        }
    }
    return addresses;
}

// ============================================================
// STARTUP BANNER
// ============================================================
console.clear();
console.log('═══════════════════════════════════════════════════════════════');
console.log('   🚀 MIKROTIK LOG RECEIVER V5 - DIAGNOSTIC MODE');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`   🌐 Target Server: ${TARGET_URL}`);
console.log(`   🔌 Listening Port: ${UDP_PORT} (UDP)`);
console.log('───────────────────────────────────────────────────────────────');

// Tampilkan IP Address yang bisa digunakan
console.log('   📍 ALAMAT IP LAPTOP INI:');
const localIPs = getLocalIPAddresses();
if (localIPs.length === 0) {
    console.log('   ⚠️  TIDAK ADA IP DITEMUKAN! Cek koneksi jaringan!');
} else {
    localIPs.forEach(item => {
        console.log(`      - ${item.interface.padEnd(20)} : ${item.ip}`);
    });
    console.log('');
    console.log('   💡 GUNAKAN SALAH SATU IP DI ATAS UNTUK:');
    console.log('      WinBox > System > Logging > Actions > Remote Address');
}
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// ============================================================
// 1. EVENT SAAT SERVER SIAP (BINDING)
// ============================================================
server.on('listening', () => {
    const address = server.address();
    console.log('✅ UDP SERVER AKTIF!');
    console.log(`   Listening on: ${address.address}:${address.port}`);
    console.log('');
    console.log('📋 CHECKLIST KONFIGURASI MIKROTIK:');
    console.log('   1. ✓ System > Logging > Actions > Buat action "kirimkelaptop"');
    console.log(`   2. ✓ Remote Address = (salah satu IP di atas)`);
    console.log(`   3. ✓ Remote Port = ${UDP_PORT}`);
    console.log('   4. ✓ Type = remote');
    console.log('   5. ✓ System > Logging > RULES > Tambahkan minimal 4 rules!');
    console.log('      - Topics: info → Action: kirimkelaptop');
    console.log('      - Topics: error → Action: kirimkelaptop');
    console.log('      - Topics: warning → Action: kirimkelaptop');
    console.log('      - Topics: critical → Action: kirimkelaptop');
    console.log('');
    console.log('⏳ MENUNGGU LOG DARI MIKROTIK...');
    console.log('   (Jika tidak ada log masuk dalam 30 detik, cek konfigurasi!)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Timer reminder jika tidak ada log
    setTimeout(() => {
        if (logCounter === 0) {
            console.log('');
            console.log('⚠️  PERINGATAN: Tidak ada log diterima dalam 30 detik!');
            console.log('');
            console.log('🔍 TROUBLESHOOTING:');
            console.log('   1. Pastikan Logging RULES sudah dibuat (bukan cuma Actions!)');
            console.log('   2. Cek IP Address di MikroTik Action sama dengan IP di atas');
            console.log('   3. Cek Port = 5140');
            console.log('   4. Test: di WinBox, disable/enable salah satu interface');
            console.log('   5. Cek Windows Firewall (allow port 5140 UDP)');
            console.log('');
        }
    }, 30000);
});

// ============================================================
// 2. EVENT SAAT ADA LOG MASUK (ENHANCED DEBUGGING)
// ============================================================
server.on('message', (msg, rinfo) => {
    logCounter++;
    
    // Tampilkan mentah-mentah untuk debugging
    const rawLog = msg.toString();
    const timestamp = new Date().toLocaleTimeString('id-ID');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📨 LOG #${logCounter} [${timestamp}] dari ${rinfo.address}:${rinfo.port}`);
    console.log(`📝 RAW: ${rawLog.substring(0, 100)}${rawLog.length > 100 ? '...' : ''}`);

    // Bersihkan Log
    let cleanLog = rawLog.replace(/^<[0-9]+>.*?\sMikroTik\s/, '').trim();
    if (cleanLog === rawLog) {
        cleanLog = rawLog.replace(/<[0-9]+>/g, '').trim();
    }

    // Anti-Spam
    const now = Date.now();
    if (cleanLog === lastLogHash && (now - lastLogTime) < 1000) {
        console.log('   ⏭️  [DUPLIKAT - DIBUANG]');
        console.log('');
        return; 
    }
    lastLogHash = cleanLog;
    lastLogTime = now;

    console.log(`🧹 CLEAN: ${cleanLog.substring(0, 100)}${cleanLog.length > 100 ? '...' : ''}`);

    // Kirim ke Web
    kirimKePusat(cleanLog, rinfo.address);
});

// ============================================================
// 3. EVENT ERROR
// ============================================================
server.on('error', (err) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('❌ SERVER ERROR!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(err.stack);
    console.log('');
    
    if (err.code === 'EADDRINUSE') {
        console.log('⚠️  Port 5140 sudah digunakan oleh program lain!');
        console.log('');
        console.log('SOLUSI:');
        console.log('   1. Tutup program yang menggunakan port 5140');
        console.log('   2. Atau ganti UDP_PORT di script ini');
        console.log('   3. Windows: netstat -ano | findstr 5140');
        console.log('');
    }
    
    server.close();
});

// ============================================================
// LOGIC PENGIRIM & PARSING (ENHANCED)
// ============================================================
async function kirimKePusat(logMentah, ipRouter) {
    let level = 'INFO';
    const txt = logMentah.toLowerCase();

    // Level Detection Logic
    if (txt.includes('error') || txt.includes('failure') || txt.includes('critical')) {
        level = 'CRITICAL';
    } else if (txt.includes('logged in')) {
        level = 'LOGIN_SUCCESS';
    } else if (txt.includes('login failure') || txt.includes('invalid')) {
        level = 'LOGIN_FAIL';
    } else if (txt.includes('logged out')) {
        level = 'LOGOUT';
    } else if (txt.includes('interface') || txt.includes('link')) {
        level = 'SYSTEM';
    } else if (txt.includes('dhcp') || txt.includes('assigned')) {
        level = 'NETWORK';
    } else if (txt.includes('firewall') || txt.includes('ping') || txt.includes('icmp')) {
        level = 'TRAFFIC';
    } else if (txt.includes('added') || txt.includes('removed') || txt.includes('changed')) {
        level = 'CONFIG';
    }

    console.log(`🎯 LEVEL: ${level}`);

    try {
        const response = await axios.post(`${TARGET_URL}/api/logs`, {
            level: level,
            message: logMentah,
            ip: ipRouter
        }, {
            timeout: 5000 // 5 detik timeout
        });
        
        successCount++;
        console.log(`✅ TERKIRIM KE SERVER (${successCount}/${logCounter})`);
        console.log('');
        
    } catch (error) {
        failCount++;
        console.log(`❌ GAGAL KIRIM KE SERVER! (Gagal: ${failCount})`);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️  Server web tidak merespons (ECONNREFUSED)');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('   ⚠️  Timeout - Server lambat atau internet bermasalah');
        } else if (error.response) {
            console.log(`   ⚠️  HTTP Error: ${error.response.status}`);
        } else {
            console.log(`   ⚠️  Error: ${error.message}`);
        }
        console.log('');
    }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGINT', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🛑 SERVER DIHENTIKAN');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   Total Log Diterima: ${logCounter}`);
    console.log(`   Berhasil Terkirim: ${successCount}`);
    console.log(`   Gagal Terkirim: ${failCount}`);
    console.log('═══════════════════════════════════════════════════════════════');
    server.close();
    process.exit(0);
});

// ============================================================
// START SERVER
// ============================================================
// BIND KE '0.0.0.0' AGAR MENDENGAR DARI SEMUA JALUR
try {
    server.bind(UDP_PORT, '0.0.0.0');
} catch (err) {
    console.log('❌ GAGAL START SERVER!');
    console.log(err.message);
    process.exit(1);
}
