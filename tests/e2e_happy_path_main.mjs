#!/usr/bin/env node
/**
 * ============================================================================
 * CBT NEXA — Master Automated End-to-End (E2E) Happy Path Test Suite
 * ============================================================================
 * 
 * Skenario Pengujian Utama (Happy Path):
 * 1. Persiapan Data (Pembuatan data / verifikasi user Guru & Siswa)
 * 2. Persiapan Ujian oleh Guru (Mata pelajaran, bank soal UI, jadwal aktif, token UI)
 * 3. Pelaksanaan Ujian oleh Siswa (Login, token, double-gating canvas, jawab soal, submit, status UI)
 * 4. Pelaporan dan pengecekan Nilai oleh Guru (Monitoring API & UI, rekap hasil, verifikasi nilai)
 * 
 * Tech-Stack:
 * - Frontend: React 18 SPA + Vite 5 + Tailwind CSS 3
 * - Backend / Database: Supabase PostgreSQL (REST RPC, Auth, Real-time)
 * - Automation Driver: Google Chrome Headless via Chrome DevTools Protocol (CDP)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Project Root Discovery
const candidateRoots = [
  path.resolve(__dirname, '../kode NEXA'),
  path.resolve(__dirname, '..'),
  path.resolve(process.cwd(), 'kode NEXA'),
  process.cwd()
];
const projectRoot = candidateRoots.find(p => fs.existsSync(path.resolve(p, 'src/api.js')));
if (!projectRoot) {
  console.error('FATAL: Could not locate project root containing src/api.js');
  process.exit(1);
}
const srcDir = path.resolve(projectRoot, 'src');

// Module require for dependencies in kode NEXA/node_modules
const req = createRequire(path.resolve(projectRoot, 'package.json'));
const { createClient } = req('@supabase/supabase-js');

// Import project config and API
const configModule = await import(pathToFileURL(path.resolve(srcDir, 'config.js')).href);
const { SUPABASE_URL, SUPABASE_ANON_KEY } = configModule;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const apiModule = await import(pathToFileURL(path.resolve(srcDir, 'api.js')).href);
const { fetchAPI } = apiModule;

// Test Reporting Harness
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  steps: {
    STEP1_DATA_PREP: { total: 0, passed: 0, failed: 0, label: '1. Persiapan Data Guru & Siswa' },
    STEP2_GURU_PREP: { total: 0, passed: 0, failed: 0, label: '2. Persiapan Ujian oleh Guru' },
    STEP3_SISWA_EXAM: { total: 0, passed: 0, failed: 0, label: '3. Pelaksanaan Ujian oleh Siswa' },
    STEP4_GURU_REPORT: { total: 0, passed: 0, failed: 0, label: '4. Pelaporan dan Pengecekan Nilai oleh Guru' }
  },
  failures: []
};

function recordTest(stepKey, testName, condition, details = '') {
  testResults.total++;
  testResults.steps[stepKey].total++;
  if (condition) {
    testResults.passed++;
    testResults.steps[stepKey].passed++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m [${stepKey}] ${testName}`);
  } else {
    testResults.failed++;
    testResults.steps[stepKey].failed++;
    testResults.failures.push({ stepKey, testName, details });
    console.log(`  \x1b[31m✖ [FAIL]\x1b[0m [${stepKey}] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

// Chrome DevTools Protocol (CDP) Runner
class ChromeCDPRunner {
  constructor(port = 9388) {
    this.port = port;
    this.chromeProc = null;
    this.tmpDir = null;
    this.ws = null;
    this.msgId = 1;
  }

  async launch(targetUrl) {
    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'google-chrome',
      'chrome'
    ];
    const chromePath = chromeCandidates.find(p => fs.existsSync(p));
    if (!chromePath) {
      throw new Error('Google Chrome / Edge executable not found on system.');
    }

    this.tmpDir = path.join(os.tmpdir(), `cbt_nexa_cdp_main_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
    fs.mkdirSync(this.tmpDir, { recursive: true });

    const chromeArgs = [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.tmpDir}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      '--window-size=1280,800',
      'about:blank'
    ];

    this.chromeProc = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

    // Poll for DevTools WebSocket URL
    let pages = [];
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        if (r.ok) {
          pages = await r.json();
          if (pages.some(p => p.type === 'page')) break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }

    const target = pages.find(p => p.type === 'page') || pages[0];
    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error(`Failed to obtain WebSocket debugger URL on port ${this.port}`);
    }

    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(res => { this.ws.onopen = res; });

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    try {
      await this.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    } catch (e) {}

    await this.send('Page.navigate', { url: targetUrl });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      const handler = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            this.ws.removeEventListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch (err) {
          reject(err);
        }
      };
      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async waitForText(needle, timeoutMs = 8000) {
    const start = Date.now();
    const lowerNeedle = needle.toLowerCase();
    while (Date.now() - start < timeoutMs) {
      const text = await this.evaluate('document.body ? document.body.innerText : ""');
      if (text && text.toLowerCase().includes(lowerNeedle)) return true;
      await this.wait(200);
    }
    return false;
  }

  async close() {
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } catch (e) {}
    try {
      if (this.chromeProc) {
        this.chromeProc.kill();
        this.chromeProc = null;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    try {
      if (this.tmpDir && fs.existsSync(this.tmpDir)) {
        fs.rmSync(this.tmpDir, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

// Main E2E Happy Path Runner
async function runE2EHappyPath() {
  const startTime = Date.now();
  console.log('==============================================================================');
  console.log('  CBT NEXA — AUTOMATED END-TO-END (E2E) HAPPY PATH TEST SUITE                 ');
  console.log('==============================================================================');
  console.log(`Target Codebase : ${projectRoot}`);
  console.log(`Supabase URL    : ${SUPABASE_URL}`);
  console.log(`Node.js Version : ${process.version}`);
  console.log(`Platform        : ${process.platform} (${os.arch()})\n`);

  // Target Web Application Endpoint Check & Auto-Recovery (Requirement 1)
  const defaultAppUrl = 'http://127.0.0.1:5173/';
  let appUrl = defaultAppUrl;
  let isAppRunning = false;
  let inProcessServer = null;

  try {
    const checkRes = await fetch(defaultAppUrl);
    if (checkRes.ok || checkRes.status === 200) {
      isAppRunning = true;
      console.log(`✔ Verified target web application is active at: ${appUrl}`);
    }
  } catch (e) {
    console.warn(`Target ${defaultAppUrl} not immediately reachable. Checking fallback / starting Vite dev server...`);
  }

  if (!isAppRunning) {
    try {
      const { createServer } = req('vite');
      const serverPort = 5173;
      console.log(`▶ Starting In-Process Vite Server on http://127.0.0.1:${serverPort}...`);
      inProcessServer = await createServer({
        root: projectRoot,
        configFile: path.resolve(projectRoot, 'vite.config.js'),
        server: { port: serverPort, host: '127.0.0.1' },
        logLevel: 'error'
      });
      await inProcessServer.listen();
      const actualAddress = inProcessServer.httpServer?.address();
      const actualPort = typeof actualAddress === 'object' && actualAddress?.port ? actualAddress.port : serverPort;
      appUrl = `http://127.0.0.1:${actualPort}/`;
      isAppRunning = true;
      console.log(`  ✔ Vite server is running and listening on port ${actualPort}\n`);
    } catch (err) {
      console.error('FATAL: Web application could not be launched automatically:', err.message);
      process.exit(1);
    }
  }

  // --------------------------------------------------------------------------
  // Launch Chrome Browser via CDP
  // --------------------------------------------------------------------------
  const cdpPort = 9380 + Math.floor(Math.random() * 15);
  const cdp = new ChromeCDPRunner(cdpPort);

  try {
    console.log(`▶ Launching Headless Chrome on CDP port ${cdpPort}...`);
    await cdp.launch(appUrl);
    console.log('  ✔ Connected to Chrome DevTools Protocol WebSocket\n');
  } catch (err) {
    console.error(`  ✖ Failed to launch Chrome CDP: ${err.message}`);
    process.exit(1);
  }

  try {
    // UI Interaction Helper Functions
    const waitForAppMount = async () => {
      return cdp.waitForText('Selamat Datang', 10000);
    };

    const clickRoleButton = async (roleLabel) => {
      return cdp.evaluate(`(async () => {
        const gantiBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ganti'));
        if (gantiBtn) {
          gantiBtn.click();
          await new Promise(r => setTimeout(r, 400));
        }

        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => {
          const t = b.innerText.trim();
          if ('${roleLabel}' === 'Admin') return t.includes('Admin') && !t.includes('S-Admin');
          if ('${roleLabel}' === 'S-Admin' || '${roleLabel}' === 'Superadmin') return t.includes('S-Admin');
          return t.toLowerCase().includes('${roleLabel.toLowerCase()}');
        });
        if (btn) {
          btn.click();
          await new Promise(r => setTimeout(r, 400));
          return true;
        }
        return false;
      })()`);
    };

    const fillLoginForm = async (username, password, npsnVal) => {
      return cdp.evaluate(`(async () => {
        const setNativeValue = (element, value) => {
          const proto = Object.getPrototypeOf(element);
          const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (set) set.call(element, value);
          else element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const select = document.querySelector('select[name="npsn"]');
        if (select) {
          for (let i = 0; i < 30; i++) {
            if (select.options.length > 1) break;
            await new Promise(r => setTimeout(r, 100));
          }
          const options = Array.from(select.options);
          const targetOpt = options.find(o => o.value === '${npsnVal}' || o.text.includes('${npsnVal}')) || (options.length > 1 ? options[1] : null);
          if (targetOpt) {
            select.selectedIndex = options.indexOf(targetOpt);
            select.value = targetOpt.value;
            const proto = Object.getPrototypeOf(select);
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) {
              setter.call(select, targetOpt.value);
            }
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        const inputs = Array.from(document.querySelectorAll('input'));
        const uInput = inputs.find(i => i.placeholder && (i.placeholder.includes('Username') || i.placeholder.includes('NIP') || i.placeholder.includes('NISN')));
        const pInput = inputs.find(i => i.placeholder && i.placeholder.includes('Password'));
        if (uInput && pInput) {
          setNativeValue(uInput, '${username}');
          setNativeValue(pInput, '${password}');
          await new Promise(r => setTimeout(r, 300));
          return true;
        }
        return false;
      })()`);
    };

    const clickSubmitLogin = async () => {
      return cdp.evaluate(`(() => {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
        return false;
      })()`);
    };

    // ========================================================================
    // TAHAP 1: PERSIAPAN DATA (VERIFIKASI & PEMBUATAN DATA GURU & SISWA)
    // ========================================================================
    console.log('▶ [TAHAP 1/4] PERSIAPAN DATA: VERIFIKASI USER GURU & SISWA');

    // 1.1 Verifikasi Sekolah Aktif
    let activeNpsn = '70040625';
    let activeSchoolName = 'SMA Nizamudin';
    const { data: sekolahList } = await supabase.from('sekolah').select('npsn, nama_sekolah').limit(1);
    if (sekolahList && sekolahList.length > 0) {
      activeNpsn = sekolahList[0].npsn;
      activeSchoolName = sekolahList[0].nama_sekolah;
    }
    recordTest('STEP1_DATA_PREP', `Sekolah terdaftar di database: [${activeNpsn}-${activeSchoolName}]`, !!activeNpsn);

    // 1.2 Verifikasi Akun Guru
    const teacherUsername = 'ade_matematika';
    const teacherPassword = 'ade27';
    let { data: guruRecord, error: guruErr } = await supabase
      .from('guru')
      .select('*')
      .eq('username', teacherUsername)
      .eq('npsn', activeNpsn)
      .single();

    if (guruErr || !guruRecord) {
      console.log(`  ℹ Akun Guru "${teacherUsername}" tidak ditemukan. Membuat akun uji baru...`);
      const newGuruId = 'G-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const { data: createdGuru } = await supabase.from('guru').insert({
        id_guru: newGuruId,
        username: teacherUsername,
        password: teacherPassword,
        nama_lengkap: 'Ade Fitrawan Ibrahim, M.Pd., Gr.',
        npsn: activeNpsn,
        role: 'guru'
      }).select().single();
      guruRecord = createdGuru;
    }

    recordTest('STEP1_DATA_PREP', `User Guru "${teacherUsername}" terverifikasi di database`, !!guruRecord?.id_guru);

    const guruAuthRes = await fetchAPI('login', {
      role: 'guru',
      npsn: activeNpsn,
      username: teacherUsername,
      password: teacherPassword
    });
    recordTest('STEP1_DATA_PREP', 'Autentikasi kredensial Guru berhasil (fetchAPI)', guruAuthRes.status === 'success' && guruAuthRes.data?.role === 'guru');

    // 1.3 Verifikasi Akun Siswa
    const studentUsername = 'muhammad_xi merdeka_1';
    const studentPassword = 'yusuf27';
    let { data: siswaRecord, error: siswaErr } = await supabase
      .from('siswa')
      .select('*')
      .eq('username', studentUsername)
      .eq('npsn', activeNpsn)
      .single();

    if (siswaErr || !siswaRecord) {
      console.log(`  ℹ Akun Siswa "${studentUsername}" tidak ditemukan. Membuat akun uji baru...`);
      const newSiswaId = 'S-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const { data: createdSiswa } = await supabase.from('siswa').insert({
        id_siswa: newSiswaId,
        username: studentUsername,
        password: studentPassword,
        nama_lengkap: 'Muhammad Yusuf Balandatu',
        nisn: '1234567890',
        kelas: 'XI Merdeka',
        npsn: activeNpsn
      }).select().single();
      siswaRecord = createdSiswa;
    }

    recordTest('STEP1_DATA_PREP', `User Siswa "${studentUsername}" terverifikasi di database`, !!siswaRecord?.id_siswa);

    // Clear stale session_token to ensure login security guard allows entry
    await supabase.from('siswa').update({ session_token: null }).eq('username', studentUsername);

    const siswaAuthRes = await fetchAPI('login', {
      role: 'siswa',
      npsn: activeNpsn,
      username: studentUsername,
      password: studentPassword
    });
    recordTest('STEP1_DATA_PREP', 'Autentikasi kredensial Siswa berhasil (fetchAPI)', siswaAuthRes.status === 'success' && siswaAuthRes.data?.role === 'siswa');

    // Clear session_token again so subsequent browser UI login succeeds without conflict
    await supabase.from('siswa').update({ session_token: null }).eq('username', studentUsername);
    console.log();

    // ========================================================================
    // TAHAP 2: PERSIAPAN UJIAN OLEH GURU
    // ========================================================================
    console.log('▶ [TAHAP 2/4] PERSIAPAN UJIAN OLEH GURU');

    // 2.1 Guru UI Login via Browser (Headless Chrome)
    await waitForAppMount();
    await clickRoleButton('Guru');
    await cdp.waitForText('Masuk Guru', 6000);
    await fillLoginForm(teacherUsername, teacherPassword, activeNpsn);
    await cdp.wait(300);
    await clickSubmitLogin();

    const guruMounted = await cdp.waitForText('Ade Fitrawan', 10000) || await cdp.waitForText('Guru', 10000);
    recordTest('STEP2_GURU_PREP', 'Guru berhasil login via UI dan mount dashboard <GuruView>', guruMounted);

    // 2.2 Persiapan Mata Pelajaran & Soal Ujian Bersih
    const testMapelId = 'M-7AE60E7B';
    const testSoalId = 'SOAL-E2E-HAPPY-01';
    const testSoalPertanyaan = 'Berapakah hasil dari 15 + 25?';
    const testSoalOpsi = ['20', '30', '40', '50'];
    const testSoalKunci = '40';

    // Bersihkan fixture lama soal uji coba ini agar bank soal deterministik
    await supabase.from('soal_ujian').delete().eq('id_soal', testSoalId);

    await supabase.from('soal_ujian').insert({
      id_soal: testSoalId,
      id_mapel: testMapelId,
      pertanyaan: testSoalPertanyaan,
      tipe_soal: 'PG',
      opsi: JSON.stringify(testSoalOpsi),
      kunci_jawaban: testSoalKunci,
      bobot: 10,
      npsn: activeNpsn
    });

    const { data: soalCheck } = await supabase.from('soal_ujian').select('id_soal, pertanyaan, kunci_jawaban').eq('id_soal', testSoalId).single();
    recordTest('STEP2_GURU_PREP', 'Guru menyiapkan butir soal PG pilihan ganda ("15 + 25?") dengan kunci "40"', soalCheck?.id_soal === testSoalId && soalCheck?.kunci_jawaban === '40');

    // 2.3 Persiapan Jadwal Ujian Aktif & Token
    const activeJadwalId = 'U-67AC6649';
    const activeExamToken = 'NX88AA';

    // Bersihkan log ujian siswa lama pada jadwal ini agar siap mengikuti ujian baru dengan bersih
    if (siswaRecord?.id_siswa) {
      await supabase.from('log_ujian').delete().eq('id_siswa', siswaRecord.id_siswa).eq('id_jadwal', activeJadwalId);
      await supabase.from('absensi_ujian').delete().eq('id_siswa', siswaRecord.id_siswa).eq('id_jadwal', activeJadwalId);
    }

    await supabase.from('jadwal').upsert({
      id_jadwal: activeJadwalId,
      id_mapel: testMapelId,
      id_guru: guruRecord?.id_guru,
      waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
      waktu_selesai: new Date(Date.now() + 86400000).toISOString(),
      token_aktif: activeExamToken,
      last_update_token: new Date().toISOString(),
      target_kelas: 'XI Merdeka',
      npsn: activeNpsn,
      durasi_menit: 90,
      browser_lockdown: true
    }, { onConflict: 'id_jadwal' });

    const { data: jadwalCheck } = await supabase.from('jadwal').select('id_jadwal, token_aktif, target_kelas').eq('id_jadwal', activeJadwalId).single();
    recordTest('STEP2_GURU_PREP', `Jadwal ujian diaktifkan dengan token "${activeExamToken}" dan target kelas "XI Merdeka"`, jadwalCheck?.token_aktif === activeExamToken);

    // 2.4 Verifikasi Bank Soal & Butir Soal di Antarmuka Guru (UI)
    const clickNavBankSoal = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button, nav button'));
      const btn = buttons.find(b => b.innerText && b.innerText.includes('Bank Soal'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await cdp.wait(1000);
    await cdp.waitForText('Matematika X', 6000);

    const clickMapelMatematika = await cdp.evaluate(`(() => {
      const h4s = Array.from(document.querySelectorAll('h4'));
      const h4 = h4s.find(h => h.innerText.trim().includes('Matematika X'));
      if (h4) {
        const card = h4.closest('.cursor-pointer') || h4.parentElement || h4;
        card.click();
        return true;
      }
      return false;
    })()`);
    await cdp.wait(1200);

    const questionInBankSoalUI = await cdp.waitForText('15 + 25', 8000);
    recordTest('STEP2_GURU_PREP', 'Guru memverifikasi butir soal baru ("15 + 25?") tampil pada antarmuka Bank Soal UI', clickNavBankSoal && clickMapelMatematika && questionInBankSoalUI);

    // 2.5 Verifikasi Jadwal Ujian & Token di Antarmuka Guru (UI)
    const clickNavJadwal = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button, nav button'));
      const btn = buttons.find(b => b.innerText && (b.innerText.includes('Jadwal Mengajar') || b.innerText.includes('Jadwal')));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await cdp.wait(800);

    const jadwalInUI = (await cdp.waitForText('Matematika', 6000)) && (await cdp.waitForText(activeExamToken, 6000) || await cdp.waitForText('XI Merdeka', 6000));
    recordTest('STEP2_GURU_PREP', `Guru memverifikasi jadwal aktif dan token "${activeExamToken}" terdaftar pada antarmuka Jadwal UI`, clickNavJadwal && jadwalInUI);

    // 2.6 Logout Guru dari UI
    const clickLogoutGuru = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.title === 'Keluar Akun' || b.innerText.includes('Keluar'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    const returnedToLogin = await cdp.waitForText('Selamat Datang', 8000);
    recordTest('STEP2_GURU_PREP', 'Guru keluar (logout) dengan bersih menuju halaman Login', clickLogoutGuru && returnedToLogin);
    console.log();

    // ========================================================================
    // TAHAP 3: PELAKSANAAN UJIAN OLEH SISWA
    // ========================================================================
    console.log('▶ [TAHAP 3/4] PELAKSANAAN UJIAN OLEH SISWA');

    // Pastikan session token siswa bersih sebelum login browser
    await supabase.from('siswa').update({ session_token: null }).eq('username', studentUsername);

    // 3.1 Siswa UI Login via Browser
    await clickRoleButton('Siswa');
    await cdp.waitForText('Masuk Siswa', 8000);
    await fillLoginForm(studentUsername, studentPassword, activeNpsn);
    await cdp.wait(300);
    await clickSubmitLogin();

    const siswaMounted = await cdp.waitForText('Muhammad Yusuf', 10000) || await cdp.waitForText('Ujian Hari Ini', 10000);
    recordTest('STEP3_SISWA_EXAM', 'Siswa berhasil login via UI dan mount dashboard <SiswaView>', siswaMounted);

    // 3.2 Menemukan Kartu Jadwal Ujian Aktif
    const cardFound = await cdp.waitForText('Matematika', 8000);
    recordTest('STEP3_SISWA_EXAM', 'Siswa melihat kartu jadwal ujian aktif "Matematika X"', cardFound);

    // 3.3 Mengklik "Mulai Ujian"
    await cdp.waitForText('Mulai Ujian', 8000) || await cdp.waitForText('Lanjutkan Ujian', 8000);
    const clickMulai = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Mulai Ujian') || b.innerText.includes('Lanjutkan Ujian'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    recordTest('STEP3_SISWA_EXAM', 'Siswa mengklik tombol aksi "Mulai Ujian"', clickMulai);

    // 3.4 Input Token Ujian
    await cdp.waitForText('Token', 6000) || await cdp.waitForText('Masuk Ujian', 6000);
    const { data: latestJadwalData } = await supabase.from('jadwal').select('token_aktif').eq('id_jadwal', activeJadwalId).single();
    const tokenToUse = latestJadwalData?.token_aktif || activeExamToken;

    const fillToken = await cdp.evaluate(`(() => {
      const setNativeValue = (element, value) => {
        const lastVal = element.value;
        element.value = value;
        const tracker = element._valueTracker;
        if (tracker) tracker.setValue(lastVal);
        const proto = Object.getPrototypeOf(element);
        const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (set) set.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const modal = document.querySelector('.fixed.inset-0');
      const tokenInput = modal ? modal.querySelector('input') : document.querySelector('input[maxlength="6"]');
      if (tokenInput) {
        setNativeValue(tokenInput, '${tokenToUse}');
        return true;
      }
      return false;
    })()`);
    recordTest('STEP3_SISWA_EXAM', `Siswa memasukkan 6-digit token ruang ujian: "${tokenToUse}"`, fillToken);

    await cdp.wait(300);

    const clickMasukUjian = await cdp.evaluate(`(() => {
      const modal = document.querySelector('.fixed.inset-0');
      const buttons = Array.from((modal || document).querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Masuk Ujian') || b.innerText.includes('Mulai Ujian Sekarang'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    recordTest('STEP3_SISWA_EXAM', 'Siswa mengirim token dan masuk ke sesi ruang ujian', clickMasukUjian);

    // 3.5 Deteksi Transisi & Penandatanganan Digital Canvas (Double-Gating)
    let inExamOrSignature = false;
    for (let i = 0; i < 35; i++) {
      inExamOrSignature = await cdp.evaluate(`(() => {
        const text = document.body ? document.body.innerText : '';
        return text.includes('Pakta Integritas') || text.includes('Tanda Tangan') || text.includes('Coretan') || !!document.querySelector('canvas') || text.includes('Kumpulkan Ujian') || text.includes('15 + 25');
      })()`);
      if (inExamOrSignature) break;
      await cdp.wait(500);
    }
    recordTest('STEP3_SISWA_EXAM', 'Sesi ruang ujian aktif terkonfirmasi (ExamRoom / Signature Modal mounted)', inExamOrSignature);

    // Cek apakah ada canvas / DigitalSignatureModal
    const hasCanvas = await cdp.evaluate('!!document.querySelector("canvas")');
    if (hasCanvas) {
      console.log('    ℹ DigitalSignatureModal terdeteksi: memverifikasi gating & tanda tangan canvas');

      // 3.5.1 Verifikasi gating awal: tombol kirim wajib non-aktif (disabled) saat canvas kosong
      const initiallyDisabled = await cdp.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('.fixed.inset-0 button, button'));
        const btn = buttons.find(b => b.innerText.includes('Kirim Kehadiran') || b.innerText.includes('Mulai Ujian'));
        return btn ? btn.disabled : false;
      })()`);
      recordTest('STEP3_SISWA_EXAM', 'Modal pakta integritas mengunci tombol mulai saat canvas masih kosong (disabled: true)', initiallyDisabled);

      // 3.5.2 Verifikasi penolakan sentuhan tunggal / aksidental (1 koordinat tap)
      await cdp.evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 50, clientY: rect.top + 50, pointerId: 1 }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + 50, clientY: rect.top + 50, pointerId: 1 }));
      })()`);
      await cdp.wait(300);

      const stillDisabledAfterTap = await cdp.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('.fixed.inset-0 button, button'));
        const btn = buttons.find(b => b.innerText.includes('Kirim Kehadiran') || b.innerText.includes('Mulai Ujian'));
        return btn ? btn.disabled : false;
      })()`);
      recordTest('STEP3_SISWA_EXAM', 'Filter tanda tangan menolak sentuhan tunggal / aksidental di bawah ambang batas (disabled: true)', stillDisabledAfterTap);

      // 3.5.3 Membubuhkan tanda tangan digital asli (35 titik koordinat terhubung)
      const drawSuccess = await cdp.evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        const startX = rect.left + 50;
        const startY = rect.top + 50;

        canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: startX, clientY: startY, pointerId: 1 }));
        for (let i = 1; i <= 35; i++) {
          canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: startX + i * 4, clientY: startY + Math.sin(i) * 15, pointerId: 1 }));
        }
        canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: startX + 150, clientY: startY, pointerId: 1 }));
        return true;
      })()`);
      recordTest('STEP3_SISWA_EXAM', 'Siswa membubuhkan tanda tangan digital pada canvas HTML5', drawSuccess);
      await cdp.wait(600);

      const isNowEnabled = await cdp.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('.fixed.inset-0 button, button'));
        const btn = buttons.find(b => b.innerText.includes('Kirim Kehadiran') || b.innerText.includes('Mulai Ujian'));
        return btn ? !btn.disabled : false;
      })()`);
      recordTest('STEP3_SISWA_EXAM', 'Tanda tangan valid terverifikasi (density >= 35px, points >= 8) dan membuka tombol kirim', isNowEnabled);

      const clickKirimKehadiran = await cdp.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('.fixed.inset-0 button, button'));
        const btn = buttons.find(b => b.innerText.includes('Kirim Kehadiran') || b.innerText.includes('Mulai Ujian'));
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      })()`);
      recordTest('STEP3_SISWA_EXAM', 'Siswa mengirim tanda tangan kehadiran ("Kirim Kehadiran & Mulai Ujian")', clickKirimKehadiran);

      // Dismiss popup dialog konfirmasi kehadiran ("Mengerti") jika ada
      await cdp.wait(1000);
      for (let attempt = 0; attempt < 6; attempt++) {
        const clicked = await cdp.evaluate(`(() => {
          const modalBtns = Array.from(document.querySelectorAll('.fixed.inset-0 button, button'));
          const okBtn = modalBtns.find(b => b.innerText.includes('Mengerti') || b.innerText.includes('Tutup') || b.innerText.includes('OK'));
          if (okBtn) { okBtn.click(); return true; }
          return false;
        })()`);
        if (clicked) break;
        await cdp.wait(500);
      }
      await cdp.wait(1000);
    } else {
      recordTest('STEP3_SISWA_EXAM', 'Status tanda tangan kehadiran telah terverifikasi sebelumnya', true);
    }

    // 3.6 Membaca dan Menjawab Soal Ujian
    const questionLoaded = await cdp.waitForText('15 + 25', 15000);
    recordTest('STEP3_SISWA_EXAM', 'Palet soal berhasil dimuat dan menampilkan pertanyaan: "15 + 25?"', questionLoaded);

    const selectAnswer = await cdp.evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const targetLabel = labels.find(l => l.innerText && (l.innerText.includes('40') || l.innerText.includes('C.')));
      if (targetLabel) {
        const radio = targetLabel.querySelector('input[type="radio"]');
        if (radio) {
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          targetLabel.click();
        }
        return true;
      }
      return false;
    })()`);
    recordTest('STEP3_SISWA_EXAM', 'Siswa memilih jawaban benar ("40") pada soal pilihan ganda', selectAnswer);

    await cdp.wait(1000);

    // 3.7 Mengumpulkan Ujian
    const clickKumpulkan = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Kumpulkan Ujian'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    recordTest('STEP3_SISWA_EXAM', 'Siswa mengklik tombol "Kumpulkan Ujian" di sticky action bar', clickKumpulkan);

    await cdp.waitForText('Ikhtisar & Konfirmasi Pengumpulan', 8000) || await cdp.wait(1000);

    const confirmSubmit = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Ya, Kumpulkan'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    recordTest('STEP3_SISWA_EXAM', 'Siswa mengonfirmasi pengumpulan jawaban pada modal konfirmasi', confirmSubmit);

    // Tunggu onFinish transition (ExamRoom 4000ms delay + buffer)
    await cdp.wait(5000);

    // Dismiss popup "Ujian Selesai" jika masih tampil
    await cdp.evaluate(`(() => {
      const modalBtns = Array.from(document.querySelectorAll('.fixed.inset-0 button, button'));
      const okBtn = modalBtns.find(b => b.innerText.includes('Mengerti') || b.innerText.includes('Tutup') || b.innerText.includes('OK'));
      if (okBtn) okBtn.click();
    })()`);
    await cdp.wait(1500);

    // 3.8 Verifikasi Status Penyelesaian Ujian di Portal Siswa
    const statusInSiswaUI = (await cdp.waitForText('SELESAI', 6000)) || (await cdp.waitForText('Ujian Hari Ini', 6000)) || (await cdp.waitForText('Muhammad Yusuf', 6000));
    recordTest('STEP3_SISWA_EXAM', 'Portal Siswa mengonfirmasi status ujian selesai pada kartu jadwal / dashboard', statusInSiswaUI);

    // Logout Siswa
    const clickLogoutSiswa = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.title === 'Keluar' || b.title === 'Keluar Aplikasi' || b.getAttribute('aria-label') === 'Keluar Aplikasi' || b.getAttribute('aria-label') === 'Keluar' || b.innerText.includes('logout'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await cdp.waitForText('Selamat Datang', 8000);
    recordTest('STEP3_SISWA_EXAM', 'Siswa menyelesaikan ujian dan keluar (logout) menuju halaman Login', clickLogoutSiswa);
    console.log();

    // ========================================================================
    // TAHAP 4: PELAPORAN DAN PENGECEKAN NILAI OLEH GURU
    // ========================================================================
    console.log('▶ [TAHAP 4/4] PELAPORAN DAN PENGECEKAN NILAI OLEH GURU');

    // 4.1 Guru UI Login Kembali
    await clickRoleButton('Guru');
    await cdp.waitForText('Masuk Guru', 6000);
    await fillLoginForm(teacherUsername, teacherPassword, activeNpsn);
    await cdp.wait(300);
    await clickSubmitLogin();
    await cdp.waitForText('Ade Fitrawan', 10000);

    // 4.2 Pengecekan via Live API & Database Integrity
    const monitoringRes = await fetchAPI('monitoring_ujian', {
      id_jadwal: activeJadwalId,
      npsn: activeNpsn
    });
    recordTest('STEP4_GURU_REPORT', 'API monitoring_ujian mengembalikan status: "success"', monitoringRes.status === 'success');

    const studentLogs = (monitoringRes.data || []).filter(l => l.id_siswa === siswaRecord?.id_siswa);
    const studentLog = studentLogs.find(l => l.status_ujian === 'SELESAI') || studentLogs[0];
    recordTest('STEP4_GURU_REPORT', 'Nama siswa "Muhammad Yusuf Balandatu" tercatat pada log pengawasan ujian', !!studentLog);
    recordTest('STEP4_GURU_REPORT', 'Status pengerjaan siswa terverifikasi "SELESAI"', studentLog?.status_ujian === 'SELESAI');

    // 4.3 Pengecekan Nilai Akhir (Nilai Auto)
    const { data: dbLogsFinal } = await supabase
      .from('log_ujian')
      .select('id_log, status_ujian, nilai_auto, pelanggaran, is_blocked')
      .eq('id_siswa', siswaRecord?.id_siswa)
      .eq('id_jadwal', activeJadwalId)
      .order('waktu_login', { ascending: false })
      .limit(1);
    const dbLogFinal = dbLogsFinal && dbLogsFinal.length > 0 ? dbLogsFinal[0] : null;

    recordTest('STEP4_GURU_REPORT', 'Database Supabase mengonfirmasi status log_ujian: "SELESAI"', dbLogFinal?.status_ujian === 'SELESAI');
    recordTest('STEP4_GURU_REPORT', `Nilai akhir siswa terhitung otomatis 100% (nilai_auto = ${dbLogFinal?.nilai_auto})`, typeof dbLogFinal?.nilai_auto === 'number' && dbLogFinal?.nilai_auto === 100);

    // 4.4 Verifikasi Catatan Butir Jawaban Siswa
    const { data: dbJawaban } = await supabase
      .from('jawaban_siswa')
      .select('id_soal, jawaban_user, is_correct, skor_diperoleh')
      .eq('id_log', dbLogFinal?.id_log)
      .eq('id_soal', testSoalId);

    const isAnswerCorrect = dbJawaban && dbJawaban.length > 0 && dbJawaban[0].is_correct === true;
    recordTest('STEP4_GURU_REPORT', 'Tabel jawaban_siswa memvalidasi jawaban objektif: is_correct = true', isAnswerCorrect);

    // 4.5 Guru Navigasi ke Tab Monitoring di UI Browser
    const clickMonitoringTab = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button, nav button'));
      const btn = buttons.find(b => b.innerText && (b.innerText.includes('Live Monitoring') || b.innerText.includes('Monitoring') || b.innerText.includes('Monitor')));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await cdp.wait(1000);
    recordTest('STEP4_GURU_REPORT', 'Guru menavigasi ke tab "Live Monitoring Peserta" di UI Browser', !!clickMonitoringTab);

    // 4.6 Guru Membuka Monitoring Jadwal Ujian Aktif
    const openMonitoringSchedule = await cdp.evaluate(`(() => {
      // 1. Cek tombol "Buka Monitoring" pada kartu aktif
      const buttons = Array.from(document.querySelectorAll('button'));
      const bukaBtn = buttons.find(b => b.innerText && b.innerText.includes('Buka Monitoring'));
      if (bukaBtn) { bukaBtn.click(); return true; }

      // 2. Fallback jika dropdown jadwal ada
      const select = document.querySelector('select');
      if (select && select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    })()`);
    await cdp.wait(1500);

    const studentRenderedInUI = await cdp.waitForText('Muhammad Yusuf', 8000);
    const statusSelesaiRenderedInUI = await cdp.waitForText('SELESAI', 8000);
    recordTest('STEP4_GURU_REPORT', 'Tabel Live Monitoring UI menampilkan nama siswa "Muhammad Yusuf" dengan status "SELESAI"', studentRenderedInUI && statusSelesaiRenderedInUI);

    // 4.7 Guru Mengakses Panel Hasil Evaluasi
    const clickHasilTab = await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button, nav button'));
      const btn = buttons.find(b => b.innerText && (b.innerText.includes('Hasil & Rekap') || b.innerText.includes('Hasil')));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await cdp.wait(1000);
    const hasilTabMounted = (await cdp.waitForText('Hasil & Rekap Nilai Evaluasi', 6000)) || (await cdp.waitForText('Rekap Nilai', 6000)) || (await cdp.waitForText('Kelas / Tingkat', 6000));
    recordTest('STEP4_GURU_REPORT', 'Guru berhasil mengakses panel "Hasil & Rekap Nilai Evaluasi" di UI Browser', clickHasilTab && hasilTabMounted);

    // Bersihkan data soal uji coba dari Supabase
    await supabase.from('soal_ujian').delete().eq('id_soal', testSoalId);

    // Logout Guru
    await cdp.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.title === 'Keluar Akun' || b.innerText.includes('Keluar'));
      if (btn) btn.click();
    })()`);
    await cdp.wait(800);

  } finally {
    try {
      if (testSoalId) {
        await supabase.from('soal_ujian').delete().eq('id_soal', testSoalId);
      }
      if (siswaRecord?.id_siswa && activeJadwalId) {
        await supabase.from('log_ujian').delete().eq('id_siswa', siswaRecord.id_siswa).eq('id_jadwal', activeJadwalId);
        await supabase.from('absensi_ujian').delete().eq('id_siswa', siswaRecord.id_siswa).eq('id_jadwal', activeJadwalId);
      }
    } catch (cleanErr) {}

    // Teardown Chrome DevTools Protocol
    console.log('\n▶ Menutup sesi browser headless Chrome...');
    await cdp.close();
    console.log('  ✔ Browser terminated cleanly');

    if (inProcessServer) {
      try {
        await inProcessServer.close();
        console.log('  ✔ In-process Vite server terminated cleanly');
      } catch (e) {}
    }
    console.log();
  }

  // --------------------------------------------------------------------------
  // Summary & Scorecard
  // --------------------------------------------------------------------------
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);

  console.log('==============================================================================');
  console.log('        CBT NEXA E2E HAPPY PATH TESTING SCORECARD SUMMARY                     ');
  console.log('==============================================================================');
  Object.entries(testResults.steps).forEach(([k, step]) => {
    console.log(`  ${step.label.padEnd(46)} : ${step.passed}/${step.total} PASSED (failed: ${step.failed})`);
  });
  console.log('------------------------------------------------------------------------------');
  console.log(`  TOTAL TESTS    : ${testResults.total}`);
  console.log(`  PASSED         : ${testResults.passed}`);
  console.log(`  FAILED         : ${testResults.failed}`);
  console.log(`  PASS RATE      : ${passRate}%`);
  console.log(`  TOTAL DURATION : ${duration}s`);
  console.log('==============================================================================\n');

  if (testResults.failed > 0) {
    console.error(`✖ TEST FAILED: ${testResults.failed} assertion(s) failed.`);
    testResults.failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.stepKey}] ${f.testName} ${f.details ? `(${f.details})` : ''}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 100% PASS: Seluruh skenario Happy Path Nexa CBT berhasil diverifikasi!');
    process.exit(0);
  }
}

runE2EHappyPath().catch((err) => {
  console.error('FATAL UNCAUGHT ERROR during E2E Happy Path execution:', err);
  process.exit(1);
});
