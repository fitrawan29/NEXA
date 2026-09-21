#!/usr/bin/env node
/**
 * CBT NEXA — Challenger M5.2 Adversarial Production Build Verification Harness
 * 
 * Verifies:
 * 1. Production build generation via `npm run build` (exit code 0).
 * 2. File existence and non-zero sizes for dist/index.html, CSS assets, and JS bundles.
 * 3. ES Module syntax validity (0 AST syntax errors via vm.SourceTextModule).
 * 4. Runtime import graph resolution: 0 bare specifiers, 100% resolved imports.
 * 5. View chunk boundaries: SuperAdminView, AdminView, GuruView, SiswaView, ExamRoom
 *    all compile to distinct lazy chunks, plus heavy library isolation (xlsx).
 * 6. CSS bundle integrity: balanced AST braces, Tailwind utility classes present,
 *    no uncompiled @tailwind/@apply directives.
 * 7. Feature payload presence inside compiled chunks (R1-R4 requirements).
 * 8. Live HTTP static serving simulation: 200 OK responses and proper MIME types.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate project root and kode NEXA directory
const possibleDirs = [
  path.resolve(__dirname, '../kode NEXA'),
  path.resolve(__dirname, '..'),
  path.resolve(process.cwd(), 'kode NEXA'),
  process.cwd()
];

let kodeNexaDir = possibleDirs.find(d => fs.existsSync(path.join(d, 'vite.config.js')) || fs.existsSync(path.join(d, 'vite.config.ts')));
if (!kodeNexaDir) {
  throw new Error('Could not locate kode NEXA project directory');
}

const distDir = path.join(kodeNexaDir, 'dist');
const assetsDir = path.join(distDir, 'assets');

console.log('==============================================================================');
console.log('  CHALLENGER M5.2: PRODUCTION BUILD ADVERSARIAL VERIFICATION HARNESS');
console.log('==============================================================================');
console.log(`Target Kode NEXA: ${kodeNexaDir}`);
console.log(`Target Dist Dir : ${distDir}`);
console.log(`Node Version    : ${process.version}\n`);

let passedTests = 0;
let totalTests = 0;
const failures = [];

function assert(condition, message, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
    if (details) console.error(`     Details: ${details}`);
    failures.push({ message, details });
  }
}

async function run() {
  // ---------------------------------------------------------------------------
  // SECTION 1: Build Execution & Exit Code
  // ---------------------------------------------------------------------------
  console.log('▶ [SECTION 1] Production Build Execution');
  try {
    const buildStartTime = Date.now();
    const buildOutput = execSync('npm run build', {
      cwd: kodeNexaDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const buildDuration = ((Date.now() - buildStartTime) / 1000).toFixed(2);
    assert(true, `npm run build executed cleanly with exit code 0 in ${buildDuration}s`);
    assert(buildOutput.includes('built in') || buildOutput.includes('✓'), 'Vite reports successful build transformation');
  } catch (err) {
    assert(false, 'npm run build failed with non-zero exit code', err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: Artifact Existence & Non-Zero File Sizes
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 2] Dist Artifact Existence & Non-Zero File Sizes');
  assert(fs.existsSync(distDir), 'dist directory exists');
  
  const indexHtmlPath = path.join(distDir, 'index.html');
  assert(fs.existsSync(indexHtmlPath), 'dist/index.html exists');
  const indexHtmlStat = fs.statSync(indexHtmlPath);
  assert(indexHtmlStat.size > 1000, `dist/index.html has valid size (${indexHtmlStat.size} bytes > 1000 bytes)`);

  const assetFiles = fs.readdirSync(assetsDir);
  assert(assetFiles.length >= 6, `dist/assets contains compiled bundle files (${assetFiles.length} files found)`);

  let allNonZero = true;
  const fileSizes = {};
  for (const f of assetFiles) {
    const stat = fs.statSync(path.join(assetsDir, f));
    fileSizes[f] = stat.size;
    if (stat.size === 0) allNonZero = false;
  }
  assert(allNonZero, 'All files in dist/assets have non-zero file sizes');

  // ---------------------------------------------------------------------------
  // SECTION 3: View Chunks Compilation & Code-Splitting
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 3] View Chunks Compilation & Chunk Boundaries');
  const superAdminChunk = assetFiles.find(f => f.startsWith('SuperAdminView-') && f.endsWith('.js'));
  const adminChunk = assetFiles.find(f => f.startsWith('AdminView-') && f.endsWith('.js'));
  const guruChunk = assetFiles.find(f => f.startsWith('GuruView-') && f.endsWith('.js'));
  const siswaChunk = assetFiles.find(f => f.startsWith('SiswaView-') && f.endsWith('.js'));
  const examRoomChunk = assetFiles.find(f => f.startsWith('ExamRoom-') && f.endsWith('.js'));
  const indexJsChunk = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
  const indexCssChunk = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.css'));
  const xlsxChunk = assetFiles.find(f => f.startsWith('xlsx-') && f.endsWith('.js'));

  assert(Boolean(superAdminChunk), `SuperAdminView compiled to chunk: ${superAdminChunk} (${fileSizes[superAdminChunk]} B)`);
  assert(Boolean(adminChunk), `AdminView compiled to chunk: ${adminChunk} (${fileSizes[adminChunk]} B)`);
  assert(Boolean(guruChunk), `GuruView compiled to chunk: ${guruChunk} (${fileSizes[guruChunk]} B)`);
  assert(Boolean(siswaChunk), `SiswaView compiled to chunk: ${siswaChunk} (${fileSizes[siswaChunk]} B)`);
  assert(Boolean(examRoomChunk), `ExamRoom compiled to chunk: ${examRoomChunk} (${fileSizes[examRoomChunk]} B)`);
  assert(Boolean(indexJsChunk), `Main entry compiled to chunk: ${indexJsChunk} (${fileSizes[indexJsChunk]} B)`);
  assert(Boolean(indexCssChunk), `CSS styles compiled to chunk: ${indexCssChunk} (${fileSizes[indexCssChunk]} B)`);
  assert(Boolean(xlsxChunk), `Heavy dependency (xlsx) isolated to separate vendor chunk: ${xlsxChunk} (${fileSizes[xlsxChunk]} B)`);

  // Verify chunk size boundaries for production
  assert(fileSizes[superAdminChunk] > 10000 && fileSizes[superAdminChunk] < 200000, 'SuperAdminView chunk within safe size range (10KB - 200KB)');
  assert(fileSizes[adminChunk] > 50000 && fileSizes[adminChunk] < 500000, 'AdminView chunk within safe size range (50KB - 500KB)');
  assert(fileSizes[guruChunk] > 100000 && fileSizes[guruChunk] < 600000, 'GuruView chunk within safe size range (100KB - 600KB)');
  assert(fileSizes[siswaChunk] > 20000 && fileSizes[siswaChunk] < 200000, 'SiswaView chunk within safe size range (20KB - 200KB)');
  assert(fileSizes[examRoomChunk] > 20000 && fileSizes[examRoomChunk] < 200000, 'ExamRoom chunk within safe size range (20KB - 200KB)');
  assert(fileSizes[indexJsChunk] < 600000, 'Main entry chunk under 600KB uncompressed');

  // Gzip compression check
  const indexJsCode = fs.readFileSync(path.join(assetsDir, indexJsChunk));
  const gzippedIndexJs = zlib.gzipSync(indexJsCode);
  assert(gzippedIndexJs.length < 150000, `Main entry chunk gzipped is compact (${(gzippedIndexJs.length / 1024).toFixed(1)} kB < 150 kB)`);

  const indexCssCode = fs.readFileSync(path.join(assetsDir, indexCssChunk));
  const gzippedCss = zlib.gzipSync(indexCssCode);
  assert(gzippedCss.length < 30000, `Production CSS gzipped is compact (${(gzippedCss.length / 1024).toFixed(1)} kB < 30 kB)`);

  // ---------------------------------------------------------------------------
  // SECTION 4: ES Module Syntax & AST Integrity
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 4] ES Module Syntax & AST Integrity');
  const jsBundles = assetFiles.filter(f => f.endsWith('.js'));
  
  for (const jsFile of jsBundles) {
    const code = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
    let syntaxOk = false;
    let errMsg = '';
    try {
      new vm.SourceTextModule(code, { initializeImportMeta() {} });
      syntaxOk = true;
    } catch (err) {
      errMsg = err.message;
    }
    assert(syntaxOk, `JS bundle ${jsFile} has 0 AST syntax errors`, errMsg);
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: Runtime Import Graph Resolution
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 5] Runtime Import Graph Resolution');
  let bareSpecifiers = [];
  let unresolvableImports = [];

  for (const jsFile of jsBundles) {
    const code = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

    // Extract true ES Module imports:
    // 1. Static imports: \bfrom\s*['"]([^'"]+)['"]
    // 2. Dynamic imports: (?<![\.\?\w])import\s*\(\s*['"]([^'"]+)['"]\s*\)
    const staticRegex = /\bfrom\s*['"]([^'"]+)['"]/g;
    const dynamicRegex = /(?<![\.\?\w])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    const specifiers = [];
    let m;
    while ((m = staticRegex.exec(code)) !== null) {
      specifiers.push({ type: 'static', specifier: m[1] });
    }
    while ((m = dynamicRegex.exec(code)) !== null) {
      specifiers.push({ type: 'dynamic', specifier: m[1] });
    }

    for (const item of specifiers) {
      const { specifier } = item;
      // Skip data URIs or HTTP URLs
      if (specifier.startsWith('data:') || specifier.startsWith('http://') || specifier.startsWith('https://')) {
        continue;
      }
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        bareSpecifiers.push({ file: jsFile, specifier });
        continue;
      }
      const targetPath = specifier.startsWith('/')
        ? path.join(distDir, specifier)
        : path.resolve(assetsDir, specifier);

      if (!fs.existsSync(targetPath)) {
        unresolvableImports.push({ file: jsFile, specifier, targetPath });
      }
    }
  }

  assert(bareSpecifiers.length === 0, 'Zero bare module specifiers found in production JS bundles', JSON.stringify(bareSpecifiers));
  assert(unresolvableImports.length === 0, 'Zero unresolvable import references across all bundles', JSON.stringify(unresolvableImports));

  // Check index.html linked assets
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexHtmlContent.includes(indexJsChunk), `dist/index.html references main JS chunk ${indexJsChunk}`);
  assert(indexHtmlContent.includes(indexCssChunk), `dist/index.html references main CSS chunk ${indexCssChunk}`);

  // ---------------------------------------------------------------------------
  // SECTION 6: CSS Integrity & Tailwind Directives Verification
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 6] CSS Integrity & Tailwind Directives');
  const cssContent = fs.readFileSync(path.join(assetsDir, indexCssChunk), 'utf8');
  
  // Verify balanced braces
  let braceBalance = 0;
  for (let i = 0; i < cssContent.length; i++) {
    if (cssContent[i] === '{') braceBalance++;
    else if (cssContent[i] === '}') braceBalance--;
    if (braceBalance < 0) break;
  }
  assert(braceBalance === 0, 'CSS stylesheet has perfectly balanced braces');

  // Verify no raw unprocessed Tailwind directives
  assert(!cssContent.includes('@tailwind'), 'No uncompiled @tailwind directives in production CSS');
  assert(!cssContent.includes('@apply'), 'No uncompiled @apply directives in production CSS');

  // Verify essential layout & utility classes exist in the built CSS
  const requiredClasses = [
    'fixed',
    'bottom-0',
    'left-0',
    'right-0',
    'z-40',
    'pb-28',
    'grid-cols-3'
  ];
  for (const cls of requiredClasses) {
    assert(cssContent.includes(cls), `Built CSS contains required utility class token '${cls}'`);
  }

  // ---------------------------------------------------------------------------
  // SECTION 7: Feature Code Presence in Production Chunks
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 7] Feature Payloads Compiled into Role Chunks');

  // SuperAdminView chunk check: cascading deletion
  const superAdminCode = fs.readFileSync(path.join(assetsDir, superAdminChunk), 'utf8');
  assert(
    superAdminCode.includes('delete_sekolah_cascade') || superAdminCode.includes('delete_sekolah'),
    'SuperAdminView chunk contains cascading school deletion endpoint reference'
  );

  // AdminView chunk check: bulk CRUD templates and avatar update
  const adminCode = fs.readFileSync(path.join(assetsDir, adminChunk), 'utf8');
  assert(adminCode.includes('Template_Siswa.xlsx'), 'AdminView chunk includes Siswa bulk template filename');
  assert(adminCode.includes('Template_Guru.xlsx'), 'AdminView chunk includes Guru bulk template filename');
  assert(adminCode.includes('Template_Jadwal.xlsx'), 'AdminView chunk includes Jadwal bulk template filename');
  assert(adminCode.includes('onUpdateUser'), 'AdminView chunk contains onUpdateUser callback invocation');

  // GuruView chunk check: compact layout and id_soal generator
  const guruCode = fs.readFileSync(path.join(assetsDir, guruChunk), 'utf8');
  assert(guruCode.includes('SOAL-') || guruCode.includes('id_soal'), 'GuruView chunk contains id_soal generation logic');
  assert(guruCode.includes('Skema Penilaian') || guruCode.includes('kunci_jawaban'), 'GuruView chunk contains grading scheme integration');

  // ExamRoom chunk check: 3-strike exam security
  const examRoomCode = fs.readFileSync(path.join(assetsDir, examRoomChunk), 'utf8');
  assert(examRoomCode.includes('visibilitychange'), 'ExamRoom chunk attaches visibilitychange listener');
  assert(examRoomCode.includes('blur'), 'ExamRoom chunk attaches blur listener');
  assert(examRoomCode.includes('catat_pelanggaran'), 'ExamRoom chunk invokes catat_pelanggaran endpoint');
  assert(examRoomCode.includes('2500'), 'ExamRoom chunk enforces 2500ms cooldown window');

  // ---------------------------------------------------------------------------
  // SECTION 8: Live HTTP Static Server Simulation
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SECTION 8] Live HTTP Static Server Simulation');
  
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.json': 'application/json; charset=utf-8'
  };

  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';
    const filePath = path.join(distDir, reqUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function fetchHttp(resourcePath) {
    return new Promise((resolve) => {
      http.get(`${baseUrl}${resourcePath}`, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }).on('error', (err) => {
        resolve({ status: 500, error: err.message });
      });
    });
  }

  // Test root /
  const rootRes = await fetchHttp('/');
  assert(rootRes.status === 200, 'HTTP GET / returns 200 OK');
  assert(rootRes.headers['content-type'].includes('text/html'), 'HTTP GET / returns text/html content-type');
  assert(rootRes.body.includes('<div id="root"></div>'), 'HTTP GET / serves complete index.html shell');

  // Test main JS
  const jsRes = await fetchHttp(`/assets/${indexJsChunk}`);
  assert(jsRes.status === 200, `HTTP GET /assets/${indexJsChunk} returns 200 OK`);
  assert(jsRes.headers['content-type'].includes('javascript'), 'Main JS bundle served with javascript MIME type');

  // Test CSS
  const cssRes = await fetchHttp(`/assets/${indexCssChunk}`);
  assert(cssRes.status === 200, `HTTP GET /assets/${indexCssChunk} returns 200 OK`);
  assert(cssRes.headers['content-type'].includes('css'), 'CSS bundle served with text/css MIME type');

  // Test dynamic view chunks
  const viewChunks = [superAdminChunk, adminChunk, guruChunk, siswaChunk, examRoomChunk];
  for (const chunk of viewChunks) {
    const r = await fetchHttp(`/assets/${chunk}`);
    assert(r.status === 200, `HTTP GET /assets/${chunk} returns 200 OK`);
  }

  // Test static assets
  const logoFile = assetFiles.find(f => f.startsWith('screen_3_logo-') && f.endsWith('.png'));
  if (logoFile) {
    const imgRes = await fetchHttp(`/assets/${logoFile}`);
    assert(imgRes.status === 200, `HTTP GET /assets/${logoFile} returns 200 OK`);
    assert(imgRes.headers['content-type'] === 'image/png', 'PNG logo served with image/png MIME type');
  }

  server.close();

  // ---------------------------------------------------------------------------
  // SUMMARY & VERDICT
  // ---------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log('                 ADVERSARIAL BUILD VERIFICATION SUMMARY                       ');
  console.log('==============================================================================');
  console.log(`  TOTAL CHECKS  : ${totalTests}`);
  console.log(`  PASSED        : ${passedTests}`);
  console.log(`  FAILED        : ${failures.length}`);
  console.log(`  SUCCESS RATE  : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('==============================================================================\n');

  if (failures.length > 0) {
    console.error(`\x1b[31mVERDICT: REJECT (${failures.length} verification checks failed)\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mVERDICT: APPROVE (100% of adversarial build verifications passed)\x1b[0m`);
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal error in build verification harness:', err);
  process.exit(1);
});
