const dgram = require('dgram'); // Penerima Sinyal UDP (MikroTik)
const axios = require('axios'); // Pengirim HTTP (Ke Vercel)

// =========================================================
// ⚠️ KONFIGURASI
// =========================================================
const TARGET_URL = 'https://log-server-five.vercel.app'; 
const UDP_PORT = 5140; 

const server = dgram.createSocket('udp4');

// --- BUFFER ANTI DUPLIKAT ---
// Menyimpan hash pesan terakhir untuk mencegah spam double log dari mikrotik
let lastLogHash = "";
let lastLogTime = 0;

console.log('------------------------------------------------');
console.log('   📡 RADAR MIKROTIK V3.5 (FIXED)   ');
console.log(`   🎯 Target Server: ${TARGET_URL}`);
console.log('------------------------------------------------');

// ============================================================
// FUNGSI PARSING CONFIG (REGEX)
// ============================================================
function parseConfigChange(rawMsg) {
    let msg = rawMsg;
    let detected = false;
    
    // Pola Regex (Urutan penting!)
    const patterns = [
        { regex: /firewall.*rule.*added/i, prefix: '🛡️ FIREWALL RULE ADDED' },
        { regex: /firewall.*rule.*removed/i, prefix: '🛡️ FIREWALL RULE DELETED' },
        { regex: /firewall.*rule.*changed/i, prefix: '🛡️ FIREWALL RULE MODIFIED' },
        { regex: /address.*added/i, prefix: '🌐 IP ADDRESS ADDED' },
        { regex: /address.*removed/i, prefix: '🌐 IP ADDRESS REMOVED' },
        { regex: /user.*logged in/i, prefix: '👤 USER LOGIN' },
        { regex: /user.*logged out/i, prefix: '👤 USER LOGOUT' },
        { regex: /login failure/i, prefix: '🚫 LOGIN FAILED' },
        { regex: /interface.*link up/i, prefix: '🔌 CABLE CONNECTED' },
        { regex: /interface.*link down/i, prefix: '🔌 CABLE DISCONNECTED' },
        { regex: /interface.*disabled/i, prefix: '🔌 INTERFACE DISABLED' },
        { regex: /interface.*enabled/i, prefix: '🔌 INTERFACE ENABLED' },
        { regex: /dhcp.*assigned/i, prefix: '📶 DHCP ASSIGNED' },
        { regex: /dhcp.*deassigned/i, prefix: '📶 DHCP RELEASED' },
        { regex: /system.*reboot/i, prefix: '⚠️ SYSTEM REBOOT' },
        { regex: /script.*added/i, prefix: '📜 SCRIPT ADDED' },
        { regex: /script.*removed/i, prefix: '📜 SCRIPT REMOVED' }
    ];
    
    for (const pattern of patterns) {
        if (pattern.regex.test(msg)) {
            // Kita ganti pesannya dengan Prefix + Detail singkat
            msg = `${pattern.prefix} >> ${msg}`;
            detected = true;
            break;
        }
    }
    
    // Jika tidak cocok regex manapun tapi mengandung kata kunci sensitif
    if (!detected) {
        if (msg.includes('added') || msg.includes('removed') || msg.includes('changed') || msg.includes('set')) {
             msg = `⚙️ CONFIG CHANGE >> ${msg}`;
        }
    }
    
    return msg;
}

// ============================================================
// RECEIVER UDP
// ============================================================
server.on('message', (msg, rinfo) => {
    const rawLog = msg.toString();

    // 1. FILTERING SAMPAH SYSLOG (Hanya ambil isinya)
    // Biasanya format: <30>Feb 11 09:00:00 MikroTik message...
    // Kita buang bagian <30> dan timestamp bawaan syslog
    let cleanLog = rawLog.replace(/^<[0-9]+>.*?\sMikroTik\s/, '').trim();
    
    // Fallback jika format beda (langsung bersihkan tag <> saja)
    if (cleanLog === rawLog) {
        cleanLog = rawLog.replace(/<[0-9]+>/g, '').trim();
    }

    // 2. ANTI DUPLICATE CHECK (Jeda 500ms untuk pesan persis sama)
    const now = Date.now();
    if (cleanLog === lastLogHash && (now - lastLogTime) < 500) {
        return; // Abaikan, ini log ganda
    }
    lastLogHash = cleanLog;
    lastLogTime = now;

    console.log(`[TERIMA] ${rinfo.address} >> ${cleanLog.substring(0, 50)}...`);

    // 3. Kirim ke Prosesor
    kirimKePusat(cleanLog, rinfo.address);
});

// ============================================================
// LOGIC PENGIRIM KE WEB
// ============================================================
async function kirimKePusat(logMentah, ipRouter) {
    let level = 'INFO';
    let processedMsg = logMentah;
    const txt = logMentah.toLowerCase();

    // --- PENENTUAN LEVEL & WARNA ---
    
    // 1. CRITICAL / ERROR
    if (txt.includes('error') || txt.includes('failure') || txt.includes('critical') || txt.includes('down')) {
        level = 'CRITICAL';
    } 
    // 2. AUTHENTICATION
    else if (txt.includes('login failure') || txt.includes('invalid user')) {
        level = 'LOGIN_FAIL';
    }
    else if (txt.includes('logged in')) {
        level = 'LOGIN_SUCCESS';
    }
    else if (txt.includes('logged out')) {
        level = 'LOGOUT';
    }
    // 3. SYSTEM & INTERFACE
    else if (txt.includes('interface') || txt.includes('link')) {
        level = 'SYSTEM';
    }
    // 4. NETWORK (DHCP/IP)
    else if (txt.includes('dhcp') || txt.includes('address') || txt.includes('assigned')) {
        level = 'NETWORK';
    }
    // 5. TRAFFIC / FIREWALL
    else if (txt.includes('firewall') || txt.includes('ping') || txt.includes('icmp')) {
        level = 'TRAFFIC';
    }
    // 6. CONFIG CHANGES (General)
    else if (txt.includes('added') || txt.includes('removed') || txt.includes('changed') || txt.includes('set ')) {
        level = 'CONFIG'; // Kategori baru untuk perubahan setting
        // Proses pesan biar lebih cantik pakai fungsi regex di atas
        processedMsg = parseConfigChange(logMentah);
    }

    // --- KIRIM KE VERCEL ---
    try {
        await axios.post(`${TARGET_URL}/api/logs`, {
            level: level,
            message: processedMsg,
            ip: ipRouter
        });
        // Feedback di terminal
        console.log(`   └─ [KIRIM] ${level}: ${processedMsg.substring(0, 40)}`);

    } catch (error) {
        console.error(`[GAGAL KIRIM] ${error.message}`);
    }
}

server.bind(UDP_PORT, () => {
    console.log(`✅ SERVER SIAP DENGARKAN PORT ${UDP_PORT}`);
    console.log(`⚠️  PASTIKAN SETTING REMOTE WINBOX KE IP LAPTOP INI!`);
});