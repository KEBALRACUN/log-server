const axios = require('axios');

// GANTI DENGAN URL SERVER KAMU
const TARGET_URL = 'http://localhost:3000';

// ==========================================
// 🤖 DAFTAR PASUKAN BOT (BOT ARMY)
// ==========================================
const botSquad = [
    {
        name: "User Biasa (Windows)",
        ip: "192.168.1.105",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        role: "NORMAL", // Suka download/upload wajar
        files: ["skripsi_bab1.docx", "foto_liburan.jpg", "tugas_kuliah.pdf"]
    },
    {
        name: "Admin Palsu (Mac)",
        ip: "10.0.0.1", // Mencoba menyamar jadi localhost
        ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        role: "ADMIN_WANNABE", // Suka coba login admin
        files: ["admin_backup.sql", "config.json"]
    },
    {
        name: "Hacker Linux",
        ip: "172.16.0.55",
        ua: "Kali Linux/Firefox",
        role: "ATTACKER", // Suka cari celah error
        files: ["exploit_payload.exe", "virus.bat", "rootkit.sh"]
    },
    {
        name: "Android User",
        ip: "192.168.0.20",
        ua: "Mozilla/5.0 (Linux; Android 13; SM-S908B)",
        role: "NORMAL",
        files: ["screenshot_wa.jpg", "video_lucu.mp4"]
    },
    {
        name: "iPhone User",
        ip: "192.168.0.21",
        ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        role: "NORMAL",
        files: ["selfie.heic", "catatan.pages"]
    }
];

// ==========================================
// ⚙️ MESIN PENGGERAK
// ==========================================

async function botAction(agent) {
    const config = {
        headers: {
            'User-Agent': agent.ua,
            'X-Forwarded-For': agent.ip // Kirim IP Palsu ke Server
        },
        validateStatus: () => true // Jangan stop kalau error
    };

    try {
        let method, url, data = null;
        const randomFile = agent.files[Math.floor(Math.random() * agent.files.length)];

        // TENTUKAN AKSI BERDASARKAN PERAN (ROLE)
        const dice = Math.random();

        if (agent.role === "ATTACKER") {
            // Hacker suka cari masalah (Cari 404 atau 403)
            if (dice > 0.5) {
                method = 'GET'; url = '/wp-admin'; // Cari halaman login wordpress (pasti 404)
            } else {
                method = 'POST'; url = '/upload';
                data = { filename: randomFile, size: "1GB" }; // Upload virus
            }
        } 
        else if (agent.role === "ADMIN_WANNABE") {
            // Admin palsu suka coba login atau akses folder terlarang
            if (dice > 0.6) {
                method = 'POST'; url = '/api/login';
                data = { username: "admin", password: "123" }; // Salah password
            } else {
                method = 'GET'; url = '/admin'; // Coba intip dashboard
            }
        } 
        else {
            // User NORMAL (Upload / Download wajar)
            if (dice > 0.5) {
                method = 'POST'; url = '/upload';
                data = { filename: randomFile };
            } else {
                method = 'GET'; url = `/download/${randomFile}`;
            }
        }

        // EKSEKUSI REQUEST
        let res;
        if (method === 'GET') {
            res = await axios.get(`${TARGET_URL}${url}`, config);
        } else {
            res = await axios.post(`${TARGET_URL}${url}`, data, config);
        }

        // PRINT LOG DI TERMINAL
        let icon = "✅";
        if (res.status >= 400) icon = "⚠️";
        if (res.status >= 500) icon = "🔥";
        
        console.log(`[${agent.name}] ${icon} ${method} ${url} -> ${res.status}`);

    } catch (err) {
        console.log(`❌ ${agent.name} Gagal connect: ${err.message}`);
    }
}

// ==========================================
// 🚀 PELUNCURAN
// ==========================================
console.log("⚔️ BOT ARMY STARTED: 5 Concurrent Agents");
console.log("Menyerang target: " + TARGET_URL);

// Jalankan loop untuk setiap bot secara acak
setInterval(() => {
    // Pilih 1 bot secara acak dari pasukan untuk beraksi
    const randomAgent = botSquad[Math.floor(Math.random() * botSquad.length)];
    botAction(randomAgent);
}, 800); // Setiap 0.8 detik ada aksi baru (Sangat sibuk!)