// ==============================================================================
// SISTEM BACKEND CBT AKM - FULL VERSION
// Dibuat untuk Google Apps Script sebagai REST API (dihubungkan ke Vercel/Frontend)
// ==============================================================================

// Wajib: Ganti dengan ID Spreadsheet Google Anda (dapat dari URL Spreadsheet)
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); // Otomatis jika script terikat ke sheet, atau paste ID di sini.

// ==========================================
// 1. MAIN ROUTER (doPost)
// Menangkap request JSON dari Frontend
// ==========================================
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No payload provided");
    }

    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;
    let result = {};

    // Routing Endpoint
    switch (action) {
      // Endpoint Global
      case 'login':
        result = handleLogin(payload.username, payload.password);
        break;
        
      // Endpoint Admin
      case 'get_admin_dashboard_data':
        result = getAdminDashboardData();
        break;
        
      // Endpoint Siswa
      case 'get_jadwal_siswa':
        result = getJadwalSiswa(payload.id_siswa);
        break;
      case 'mulai_ujian':
        result = mulaiUjian(payload.id_jadwal, payload.id_siswa, payload.token);
        break;
      case 'get_soal_ujian':
        result = getSoalUjian(payload.id_jadwal);
        break;
      case 'catat_pelanggaran':
        result = catatPelanggaranScreen(payload.id_log);
        break;
      case 'submit_ujian':
        result = submitUjianAutoGrading(payload.id_log, payload.id_jadwal, payload.id_siswa, payload.jawaban);
        break;
        
      // Endpoint Guru / Pengawas
      case 'get_jadwal_pengawas':
        result = getJadwalAktif();
        break;
      case 'get_token':
        result = manageDynamicToken(payload.id_jadwal);
        break;
      case 'monitoring_ujian':
        result = getMonitoringSiswa(payload.id_jadwal);
        break;
      case 'buka_blokir':
        result = unblockSiswa(payload.id_log);
        break;
      case 'submit_nilai_uraian':
        result = submitNilaiUraian(payload.id_log, payload.nilai);
        break;
        
      default:
        result = { status: 'error', message: 'Endpoint (action) tidak valid!' };
    }
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    output.setContent(JSON.stringify({ status: 'error', message: error.toString(), trace: error.stack }));
    return output;
  }
}

// Untuk testing di browser (GET method biasanya dilarang demi keamanan JSON POST)
function doGet(e) {
  return ContentService.createTextOutput("API CBT AKM Berjalan Normal. Silakan gunakan metode POST dari Frontend.").setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// 2. KUMPULAN CONTROLLER UTAMA
// ==========================================

function handleLogin(username, password) {
  const data = getSheetData('Users');
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username && data[i][2] === password) {
      return {
        status: 'success',
        data: {
          id_user: data[i][0],
          role: data[i][3],
          nama_lengkap: data[i][4],
          instansi: data[i][5]
        }
      };
    }
  }
  return { status: 'error', message: 'Username atau password salah!' };
}

function getAdminDashboardData() {
  const users = mapDataToObjects(getSheetData('Users'));
  const jadwal = mapDataToObjects(getSheetData('Jadwal'));
  const logs = mapDataToObjects(getSheetData('Log_Ujian'));
  
  const totalSiswa = users.filter(u => u.role === 'siswa').length;
  const totalGuru = users.filter(u => u.role === 'guru').length;
  const totalJadwal = jadwal.length;
  const totalSesiAktif = logs.filter(l => l.status_ujian === 'SEDANG KERJA').length;
  
  // Format jadwal aktif untuk ditampilkan
  const jadwalAktif = jadwal.map(j => {
    const guru = users.find(u => u.id_user === j.id_guru);
    return {
      id_jadwal: j.id_jadwal,
      nama_mapel: j.nama_mapel,
      guru: guru ? guru.nama_lengkap : 'Unknown',
      waktu_mulai: j.waktu_mulai,
      waktu_selesai: j.waktu_selesai
    };
  }).slice(0, 5); // Ambil 5 jadwal teratas
  
  return {
    status: 'success',
    data: {
      totalSiswa,
      totalGuru,
      totalJadwal,
      totalSesiAktif,
      jadwalAktif
    }
  };
}

function manageDynamicToken(id_jadwal) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Jadwal');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id_jadwal) {
      let tokenAktif = data[i][5];
      let lastUpdateString = data[i][6];
      let lastUpdate = lastUpdateString ? new Date(lastUpdateString).getTime() : 0;
      let now = new Date().getTime();
      
      // Expired dalam 5 Menit (300.000 milliseconds)
      if (now - lastUpdate > 300000 || !tokenAktif) {
        tokenAktif = Math.random().toString(36).substring(2, 8).toUpperCase();
        sheet.getRange(i + 1, 6).setValue(tokenAktif);
        sheet.getRange(i + 1, 7).setValue(new Date().toISOString()); // ISO Format aman untuk JSON & Date parsing
      }
      return { status: 'success', token: tokenAktif };
    }
  }
  return { status: 'error', message: 'Jadwal tidak ditemukan' };
}

function catatPelanggaranScreen(id_log) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Log_Ujian');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id_log) {
      let currentPelanggaran = parseInt(data[i][4]) || 0;
      let newPelanggaran = currentPelanggaran + 1;
      let isBlocked = "FALSE";
      
      // Logika Pemblokiran: Max 3 pelanggaran (Pelanggaran ke-4 = BLOKIR)
      if (newPelanggaran > 3) {
        isBlocked = "TRUE";
      }
      
      sheet.getRange(i + 1, 5).setValue(newPelanggaran); 
      sheet.getRange(i + 1, 6).setValue(isBlocked);      
      
      return { 
        status: 'success', 
        message: 'Pelanggaran dicatat', 
        pelanggaran_saat_ini: newPelanggaran,
        terblokir: isBlocked === "TRUE" 
      };
    }
  }
  return { status: 'error', message: 'Sesi log ujian tidak valid.' };
}

function unblockSiswa(id_log) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Log_Ujian');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id_log) {
      sheet.getRange(i + 1, 5).setValue(0);       // Reset pelanggaran ke 0
      sheet.getRange(i + 1, 6).setValue("FALSE"); // Cabut blokir
      return { status: 'success', message: 'Blokir akun siswa telah dibuka.' };
    }
  }
  return { status: 'error', message: 'Log tidak ditemukan.' };
}

function getJadwalAktif() {
  const jadwal = mapDataToObjects(getSheetData('Jadwal'));
  return { status: 'success', data: jadwal };
}

function getJadwalSiswa(id_siswa) {
  // Karena Siswa hanya perlu melihat jadwal global, return jadwal beserta log mereka (sudah dikerjakan/belum)
  const jadwalList = mapDataToObjects(getSheetData('Jadwal'));
  const logList = mapDataToObjects(getSheetData('Log_Ujian')).filter(l => l.id_siswa === id_siswa);
  
  const result = jadwalList.map(jadwal => {
    let status = "BELUM MULAI";
    let logInfo = logList.find(l => l.id_jadwal === jadwal.id_jadwal);
    if(logInfo) status = logInfo.status_ujian; // SEDANG KERJA atau SELESAI
    return { ...jadwal, status_siswa: status, id_log: logInfo ? logInfo.id_log : null };
  });
  
  return { status: 'success', data: result };
}

function mulaiUjian(id_jadwal, id_siswa, tokenInput) {
  const jadwalList = mapDataToObjects(getSheetData('Jadwal'));
  const targetJadwal = jadwalList.find(j => j.id_jadwal === id_jadwal);
  
  if (!targetJadwal) return { status: 'error', message: 'Jadwal tidak valid.' };
  
  // Validasi Token
  if (targetJadwal.token_aktif !== tokenInput) {
    return { status: 'error', message: 'Token salah atau sudah kadaluarsa!' };
  }
  
  const sheetLog = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Log_Ujian');
  const dataLog = mapDataToObjects(sheetLog.getDataRange().getValues());
  
  // Cek apakah siswa sudah pernah mulai
  let existingLog = dataLog.find(l => l.id_jadwal === id_jadwal && l.id_siswa === id_siswa);
  
  if (existingLog) {
    if (existingLog.is_blocked === "TRUE") return { status: 'error', message: 'Akun Anda diblokir karena pelanggaran!' };
    if (existingLog.status_ujian === "SELESAI") return { status: 'error', message: 'Anda sudah menyelesaikan ujian ini.' };
    return { status: 'success', id_log: existingLog.id_log, message: 'Melanjutkan ujian yang tertunda.' };
  } else {
    // Buat Sesi Baru
    const newIdLog = "L-" + new Date().getTime() + "-" + id_siswa;
    sheetLog.appendRow([newIdLog, id_jadwal, id_siswa, "SEDANG KERJA", 0, "FALSE", 0, 0]);
    return { status: 'success', id_log: newIdLog, message: 'Ujian dimulai.' };
  }
}

function getSoalUjian(id_jadwal) {
  const bankSoal = mapDataToObjects(getSheetData('Soal'));
  const soalFiltered = bankSoal.filter(s => s.id_jadwal === id_jadwal).map(s => {
    // PERHATIAN: Hapus kunci_jawaban dari JSON agar tidak bisa di-inspect oleh siswa di Frontend!
    return {
      id_soal: s.id_soal,
      tipe_soal: s.tipe_soal,
      pertanyaan: s.pertanyaan,
      opsi: s.opsi, // Dikirim sebagai String JSON, frontend harus parse JSON.parse()
      bobot: s.bobot
    };
  });
  
  return { status: 'success', data: soalFiltered };
}

// ==========================================
// 3. ENGINE PENILAIAN & AUTO-GRADING AKM
// ==========================================
function submitUjianAutoGrading(id_log, id_jadwal, id_siswa, jawabanSiswaArr) {
  // jawabanSiswaArr = [{id_soal: 'S-1', jawaban: 'A'}, {id_soal: 'S-2', jawaban: '["A", "C"]'}, ...]
  const bankSoal = mapDataToObjects(getSheetData('Soal')).filter(s => s.id_jadwal === id_jadwal);
  let totalNilaiAuto = 0;
  let rowsJawabanToInsert = [];
  
  jawabanSiswaArr.forEach(jawabanInput => {
    let soal = bankSoal.find(s => s.id_soal === jawabanInput.id_soal);
    if (!soal) return;
    
    let isBenar = false;
    let skorDidapat = 0;
    let stringJawabanSiswa = typeof jawabanInput.jawaban === 'object' ? JSON.stringify(jawabanInput.jawaban) : String(jawabanInput.jawaban);
    
    // Logika Grading berdasarkan Tipe Soal
    switch(soal.tipe_soal) {
      case 'PG': // Pilihan Ganda Biasa (Exact Match)
      case 'BS': // Benar Salah (Exact Match)
        if (stringJawabanSiswa === String(soal.kunci_jawaban)) {
          isBenar = true;
          skorDidapat = parseFloat(soal.bobot);
        }
        break;
        
      case 'PGK': // Pilihan Ganda Kompleks (Array Mapping)
        // Standar AKM: PGK harus tepat menjawab SEMUA opsi benar baru poin penuh, atau sebagian? 
        // Disini diterapkan: Exact Match dari Array untuk poin penuh.
        let arrKunci = [];
        let arrJawab = [];
        try { 
          arrKunci = JSON.parse(soal.kunci_jawaban).sort(); 
          arrJawab = JSON.parse(stringJawabanSiswa).sort();
        } catch(e) {}
        
        if (JSON.stringify(arrKunci) === JSON.stringify(arrJawab)) {
          isBenar = true;
          skorDidapat = parseFloat(soal.bobot);
        }
        break;
        
      case 'JODOH': // Menjodohkan (Objek Mapping)
      case 'ISIAN': // Isian Singkat (Case Insensitive Match)
        if (stringJawabanSiswa.trim().toLowerCase() === String(soal.kunci_jawaban).trim().toLowerCase()) {
          isBenar = true;
          skorDidapat = parseFloat(soal.bobot);
        }
        break;
        
      case 'URAIAN':
        // Uraian tidak di-auto-grade. Guru yang nilai.
        isBenar = false;
        skorDidapat = 0; 
        break;
    }
    
    totalNilaiAuto += skorDidapat;
    
    // Siapkan data untuk disisipkan ke sheet 'Jawaban_Siswa'
    let newIdJawaban = "JWB-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
    rowsJawabanToInsert.push([newIdJawaban, id_log, soal.id_soal, stringJawabanSiswa, (isBenar ? "BENAR" : "SALAH"), skorDidapat]);
  });
  
  // Batch Insert ke Jawaban_Siswa (Lebih cepat daripada insert 1-1)
  if(rowsJawabanToInsert.length > 0) {
    const sheetJawab = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Jawaban_Siswa');
    sheetJawab.getRange(sheetJawab.getLastRow() + 1, 1, rowsJawabanToInsert.length, rowsJawabanToInsert[0].length).setValues(rowsJawabanToInsert);
  }
  
  // Update status di Log_Ujian jadi SELESAI dan simpan nilai_auto
  const sheetLog = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Log_Ujian');
  const dataLog = sheetLog.getDataRange().getValues();
  for (let i = 1; i < dataLog.length; i++) {
    if (dataLog[i][0] === id_log) {
      sheetLog.getRange(i + 1, 4).setValue("SELESAI");
      sheetLog.getRange(i + 1, 7).setValue(totalNilaiAuto);
      break;
    }
  }
  
  return { status: 'success', message: 'Ujian berhasil dikumpulkan.', nilai_objektif: totalNilaiAuto };
}

function getMonitoringSiswa(id_jadwal) {
  const users = mapDataToObjects(getSheetData('Users')).filter(u => u.role === 'siswa');
  const logs = mapDataToObjects(getSheetData('Log_Ujian')).filter(l => l.id_jadwal === id_jadwal);
  
  // Gabungkan Data Siswa dengan Status Ujian Mereka
  const monitoringList = users.map(siswa => {
    const logSiswa = logs.find(l => l.id_siswa === siswa.id_user);
    return {
      id_siswa: siswa.id_user,
      nama_lengkap: siswa.nama_lengkap,
      status_ujian: logSiswa ? logSiswa.status_ujian : 'BELUM MULAI',
      pelanggaran: logSiswa ? logSiswa.jumlah_pelanggaran : 0,
      is_blocked: logSiswa ? logSiswa.is_blocked === "TRUE" : false,
      id_log: logSiswa ? logSiswa.id_log : null,
      nilai_auto: logSiswa ? logSiswa.nilai_auto : 0,
      nilai_uraian: logSiswa ? logSiswa.nilai_uraian : 0
    };
  });
  
  return { status: 'success', data: monitoringList };
}

function submitNilaiUraian(id_log, nilai) {
  const sheetLog = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Log_Ujian');
  const dataLog = sheetLog.getDataRange().getValues();
  for (let i = 1; i < dataLog.length; i++) {
    if (dataLog[i][0] === id_log) {
      sheetLog.getRange(i + 1, 8).setValue(nilai); // Kolom 8 adalah nilai_uraian
      return { status: 'success', message: 'Nilai uraian berhasil disimpan.' };
    }
  }
  return { status: 'error', message: 'Log Ujian tidak ditemukan.' };
}

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan di Database.");
  return sheet.getDataRange().getValues();
}

function mapDataToObjects(data2D) {
  if (data2D.length <= 1) return [];
  const headers = data2D[0];
  const rows = [];
  for (let i = 1; i < data2D.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data2D[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

// ==========================================
// 5. FITUR AUTO-SETUP DATABASE (JALANKAN SEKALI)
// Buka file ini di Apps Script editor, pilih fungsi setupDatabaseOtomatis di dropdown atas, lalu klik "Run/Jalankan"
// ==========================================
function setupDatabaseOtomatis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Skema Database Standard Aplikasi CBT AKM
  const dbStructure = {
    'Users': [
      ['id_user', 'username', 'password', 'role', 'nama_lengkap', 'instansi'],
      ['U-001', 'admin', 'admin123', 'admin', 'Super Administrator', 'Sistem Pusat CBT'],
      ['U-002', 'guru01', 'guru123', 'guru', 'Bpk. Budi Santoso (Guru Matik)', 'SMA Negeri 1'],
      ['U-003', 'siswa01', 'siswa123', 'siswa', 'Ahmad Widodo', 'SMA Negeri 1'],
      ['U-004', 'siswa02', 'siswa123', 'siswa', 'Putri Ayu', 'SMA Negeri 1']
    ],
    'Jadwal': [
      ['id_jadwal', 'nama_mapel', 'id_guru', 'waktu_mulai', 'waktu_selesai', 'token_aktif', 'last_token_update'],
      ['J-001', 'Matematika Terapan', 'U-002', '2026-08-20 07:00:00', '2026-08-25 12:00:00', '', ''] // Diset hingga 2026 sesuai konteks
    ],
    'Soal': [
      ['id_soal', 'id_jadwal', 'tipe_soal', 'pertanyaan', 'opsi', 'kunci_jawaban', 'bobot'],
      ['S-001', 'J-001', 'PG', 'Apa ibu kota Indonesia saat ini (2026)?', '["A. Jakarta", "B. Nusantara", "C. Bandung", "D. Surabaya", "E. Makassar"]', 'B', 10],
      ['S-002', 'J-001', 'PGK', 'Pilih dua bilangan prima dari pilihan berikut!', '["A. 2", "B. 4", "C. 5", "D. 9", "E. 10"]', '["A","C"]', 20],
      ['S-003', 'J-001', 'BS', 'Pernyataan: Bumi berbentuk datar.', '["Benar", "Salah"]', 'Salah', 10],
      ['S-004', 'J-001', 'ISIAN', 'Sebutkan unsur kimia dari Emas.', '', 'Au', 20],
      ['S-005', 'J-001', 'URAIAN', 'Jelaskan dampak global warming!', '', '', 40]
    ],
    'Log_Ujian': [
      ['id_log', 'id_jadwal', 'id_siswa', 'status_ujian', 'jumlah_pelanggaran', 'is_blocked', 'nilai_auto', 'nilai_uraian']
    ],
    'Jawaban_Siswa': [
      ['id_jawaban', 'id_log', 'id_soal', 'jawaban_siswa', 'status_benar', 'skor_didapat']
    ]
  };

  // Build Sheet
  for (let sheetName in dbStructure) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear(); // Bersihkan isi lama jika re-run setup
    }
    
    const dataMatrix = dbStructure[sheetName];
    sheet.getRange(1, 1, dataMatrix.length, dataMatrix[0].length).setValues(dataMatrix);
    
    // Formatting & UX Database
    const headerRange = sheet.getRange(1, 1, 1, dataMatrix[0].length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#2c3e50"); // Warna biru gelap premium
    headerRange.setFontColor("#ffffff");  
    sheet.setFrozenRows(1);               
    sheet.autoResizeColumns(1, dataMatrix[0].length);
  }
  
  Logger.log("SETUP BERHASIL! Database CBT Anda siap digunakan.");
}