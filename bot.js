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

// ============================================================
// FUNGSI UNTUK PARSING DETAIL PERUBAHAN KONFIGURASI
// ============================================================
function parseConfigChange(rawMsg) {
    let msg = rawMsg;
    
    // Deteksi tipe perubahan dan komponen yang diubah
    const patterns = [
        // Firewall rules
        { regex: /firewall.*rule.*added/i, prefix: '🛡️ FIREWALL RULE ADDED' },
        { regex: /firewall.*rule.*removed/i, prefix: '🛡️ FIREWALL RULE DELETED' },
        { regex: /firewall.*rule.*changed/i, prefix: '🛡️ FIREWALL RULE MODIFIED' },
        { regex: /firewall.*filter.*added/i, prefix: '🛡️ FIREWALL FILTER ADDED' },
        { regex: /firewall.*filter.*removed/i, prefix: '🛡️ FIREWALL FILTER REMOVED' },
        
        // IP Address
        { regex: /ip.*address.*added/i, prefix: '🌐 IP ADDRESS ADDED' },
        { regex: /ip.*address.*removed/i, prefix: '🌐 IP ADDRESS REMOVED' },
        { regex: /ip.*address.*changed/i, prefix: '🌐 IP ADDRESS CHANGED' },
        
        // NAT Rules
        { regex: /nat.*rule.*added/i, prefix: '🔄 NAT RULE ADDED' },
        { regex: /nat.*rule.*removed/i, prefix: '🔄 NAT RULE DELETED' },
        { regex: /nat.*rule.*changed/i, prefix: '🔄 NAT RULE MODIFIED' },
        { regex: /nat.*added/i, prefix: '🔄 NAT ADDED' },
        { regex: /nat.*removed/i, prefix: '🔄 NAT REMOVED' },
        
        // User Management
        { regex: /user.*added/i, prefix: '👤 USER CREATED' },
        { regex: /user.*removed/i, prefix: '👤 USER DELETED' },
        { regex: /user.*changed/i, prefix: '👤 USER MODIFIED' },
        { regex: /user.*logged in/i, prefix: '👤 USER LOGIN' },
        
        // DHCP Server
        { regex: /dhcp.*server.*added/i, prefix: '📶 DHCP SERVER ADDED' },
        { regex: /dhcp.*server.*removed/i, prefix: '📶 DHCP SERVER REMOVED' },
        { regex: /dhcp.*server.*changed/i, prefix: '📶 DHCP CONFIG CHANGED' },
        { regex: /dhcp.*lease.*added/i, prefix: '📶 DHCP LEASE ADDED' },
        
        // Wireless/WiFi
        { regex: /wireless.*changed/i, prefix: '📡 WIFI CONFIG CHANGED' },
        { regex: /wireless.*added/i, prefix: '📡 WIFI ADDED' },
        { regex: /wireless.*removed/i, prefix: '📡 WIFI REMOVED' },
        { regex: /wireless.*ssid.*changed/i, prefix: '📡 WIFI SSID CHANGED' },
        { regex: /wireless.*security.*changed/i, prefix: '📡 WIFI SECURITY CHANGED' },
        { regex: /wlan.*changed/i, prefix: '📡 WLAN CONFIG CHANGED' },
        
        // Routes
        { regex: /route.*added/i, prefix: '🗺️ ROUTE ADDED' },
        { regex: /route.*removed/i, prefix: '🗺️ ROUTE DELETED' },
        { regex: /route.*changed/i, prefix: '🗺️ ROUTE MODIFIED' },
        
        // Bridge
        { regex: /bridge.*added/i, prefix: '🌉 BRIDGE CREATED' },
        { regex: /bridge.*removed/i, prefix: '🌉 BRIDGE DELETED' },
        { regex: /bridge.*changed/i, prefix: '🌉 BRIDGE MODIFIED' },
        { regex: /bridge.*port.*added/i, prefix: '🌉 BRIDGE PORT ADDED' },
        
        // Interface
        { regex: /interface.*added/i, prefix: '🔌 INTERFACE ADDED' },
        { regex: /interface.*removed/i, prefix: '🔌 INTERFACE REMOVED' },
        { regex: /interface.*changed/i, prefix: '🔌 INTERFACE MODIFIED' },
        { regex: /interface.*enabled/i, prefix: '🔌 INTERFACE ENABLED' },
        { regex: /interface.*disabled/i, prefix: '🔌 INTERFACE DISABLED' },
        
        // System
        { regex: /system.*identity.*changed/i, prefix: '⚙️ SYSTEM NAME CHANGED' },
        { regex: /system.*clock.*changed/i, prefix: '🕐 SYSTEM TIME CHANGED' },
        { regex: /system.*ntp.*changed/i, prefix: '🕐 NTP CONFIG CHANGED' },
        { regex: /password.*changed/i, prefix: '🔐 PASSWORD CHANGED' },
        { regex: /system.*reboot/i, prefix: '⚙️ SYSTEM REBOOTED' },
        
        // Backup & Restore
        { regex: /configuration.*saved/i, prefix: '💾 CONFIG SAVED' },
        { regex: /backup.*created/i, prefix: '💾 BACKUP CREATED' },
        { regex: /system.*restored/i, prefix: '♻️ SYSTEM RESTORED' },
        { regex: /export/i, prefix: '💾 CONFIG EXPORTED' },
        
        // Script & Scheduler
        { regex: /script.*added/i, prefix: '📜 SCRIPT ADDED' },
        { regex: /script.*removed/i, prefix: '📜 SCRIPT DELETED' },
        { regex: /script.*changed/i, prefix: '📜 SCRIPT MODIFIED' },
        { regex: /scheduler.*added/i, prefix: '⏰ SCHEDULER ADDED' },
        { regex: /scheduler.*removed/i, prefix: '⏰ SCHEDULER REMOVED' },
        
        // Queue & Bandwidth
        { regex: /queue.*added/i, prefix: '🚦 QUEUE RULE ADDED' },
        { regex: /queue.*changed/i, prefix: '🚦 QUEUE MODIFIED' },
        { regex: /queue.*removed/i, prefix: '🚦 QUEUE REMOVED' },
        { regex: /simple.*queue.*added/i, prefix: '🚦 SIMPLE QUEUE ADDED' },
        
        // DNS
        { regex: /dns.*changed/i, prefix: '🌍 DNS CONFIG CHANGED' },
        { regex: /dns.*static.*added/i, prefix: '🌍 DNS RECORD ADDED' },
        { regex: /dns.*static.*removed/i, prefix: '🌍 DNS RECORD REMOVED' },
        
        // Pool & Address Lists
        { regex: /pool.*added/i, prefix: '🏊 IP POOL ADDED' },
        { regex: /pool.*removed/i, prefix: '🏊 IP POOL REMOVED' },
        { regex: /address-list.*added/i, prefix: '📋 ADDRESS LIST ADDED' },
        
        // VPN & Tunneling
        { regex: /vpn.*added/i, prefix: '🔒 VPN ADDED' },
        { regex: /vpn.*removed/i, prefix: '🔒 VPN REMOVED' },
        { regex: /pptp.*added/i, prefix: '🔒 PPTP ADDED' },
        { regex: /l2tp.*added/i, prefix: '🔒 L2TP ADDED' },
        { regex: /ipsec.*added/i, prefix: '🔒 IPSEC ADDED' },
        
        // VLAN
        { regex: /vlan.*added/i, prefix: '🏷️ VLAN ADDED' },
        { regex: /vlan.*removed/i, prefix: '🏷️ VLAN REMOVED' },
        { regex: /vlan.*changed/i, prefix: '🏷️ VLAN MODIFIED' },
        
        // Service & Port
        { regex: /service.*enabled/i, prefix: '🔧 SERVICE ENABLED' },
        { regex: /service.*disabled/i, prefix: '🔧 SERVICE DISABLED' },
        { regex: /port.*changed/i, prefix: '🔧 PORT CHANGED' },
    ];
    
    // Cek pattern yang cocok
    for (const pattern of patterns) {
        if (pattern.regex.test(msg)) {
            msg = `${pattern.prefix} >> ${msg}`;
            break;
        }
    }
    
    return msg;
}

// ============================================================
// SAAT MENERIMA SINYAL LOG DARI MIKROTIK
// ============================================================
server.on('message', (msg, rinfo) => {
    const rawLog = msg.toString();
    console.log(`[TERIMA] ${rinfo.address} >> ${rawLog.substring(0, 40)}...`);

    // Kirim data ke Vercel
    kirimKePusat(rawLog, rinfo.address);
});

// ============================================================
// FUNGSI UTAMA UNTUK ANALISA DAN KIRIM LOG
// ============================================================
async function kirimKePusat(logMentah, ipRouter) {
    // 1. Analisa Level Bahaya (PRIORITAS DARI ATAS KE BAWAH)
    let level = 'INFO';
    const txt = logMentah.toLowerCase();
    
    // CRITICAL - Prioritas Tertinggi
    if (txt.includes('error') || txt.includes('failure') || txt.includes('critical')) {
        level = 'CRITICAL'; // Merah Tua (Bahaya)
    } 
    // LOGIN SUCCESS
    else if (txt.includes('logged in')) {
        level = 'LOGIN_SUCCESS'; // Hijau Neon (Ada yang masuk)
    }
    // LOGIN FAIL
    else if (txt.includes('login failure') || txt.includes('invalid user')) {
        level = 'LOGIN_FAIL'; // Merah (Ada yang coba bobol)
    }
    // LOGOUT
    else if (txt.includes('logged out')) {
        level = 'LOGOUT'; // Kuning (Target pergi)
    }
    // CONFIG CHANGES - Deteksi perubahan konfigurasi
    else if (txt.includes('changed') || txt.includes('modified') || 
             txt.includes('added') || txt.includes('removed') || 
             txt.includes('deleted') || txt.includes('updated') ||
             txt.includes(' set ') || txt.includes('configuration') ||
             txt.includes('enabled') || txt.includes('disabled')) {
        level = 'CONFIG'; // Orange (Konfigurasi diubah)
    }
    // TRAFFIC
    else if (txt.includes('icmp') || txt.includes('ping') || txt.includes('firewall')) {
        level = 'TRAFFIC'; // Biru (Lalulintas data)
    }
    // NETWORK
    else if (txt.includes('dhcp') || txt.includes('assigned')) {
        level = 'NETWORK'; // Ungu (Perangkat connect)
    }
    // SYSTEM
    else if (txt.includes('interface') || txt.includes('link up') || txt.includes('link down')) {
        level = 'SYSTEM'; // Putih (Status Kabel)
    }

    // 2. Bersihkan pesan (Buang kode syslog <30>, <14>, dll)
    let cleanMsg = logMentah.replace(/<[0-9]+>/g, '').trim();
    
    // 3. Parsing detail konfigurasi jika terdeteksi perubahan
    if (level === 'CONFIG') {
        cleanMsg = parseConfigChange(cleanMsg);
    }

    // 4. Kirim ke Server Vercel
    try {
        await axios.post(`${TARGET_URL}/api/logs`, {
            level: level,
            message: cleanMsg,
            ip: ipRouter
        });
        console.log(`[KIRIM] ${level} >> ${cleanMsg.substring(0, 30)}...`);
    } catch (error) {
        console.error(`[GAGAL KIRIM] Server Vercel Menolak: ${error.message}`);
    }
}

// ============================================================
// START SERVER
// ============================================================
server.bind(UDP_PORT, () => {
    console.log(`✅ MENUNGGU LOG DI PORT: ${UDP_PORT}`);
    console.log(`⚠️  Setting MikroTik Remote Address ke IP Laptop ini!`);
    console.log('');
    console.log('📋 FITUR DETEKSI:');
    console.log('   • Login/Logout Events');
    console.log('   • Firewall Changes');
    console.log('   • Network Config');
    console.log('   • User Management');
    console.log('   • System Changes');
    console.log('   • WiFi/Wireless Config');
    console.log('   • And 35+ more...');
    console.log('------------------------------------------------');
});
