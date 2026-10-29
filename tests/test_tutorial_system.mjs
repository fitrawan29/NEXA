import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Tutorial System Integrity Verification ---');

// 1. Read TutorialModal.jsx to extract TUTORIAL_DATA keys and targetIds
const tutorialModalContent = fs.readFileSync(path.join(rootDir, 'src/components/TutorialModal.jsx'), 'utf-8');

// Check exports
const requiredExports = ['TutorialModal', 'TutorialBadge', 'getTutorialProgress', 'saveTutorialProgress', 'resetTutorialProgress', 'TUTORIAL_DATA', 'ROLE_THEMES'];
for (const exp of requiredExports) {
  const hasExp = tutorialModalContent.includes(`export const ${exp}`) ||
                 tutorialModalContent.includes(`export function ${exp}`) ||
                 tutorialModalContent.includes(`export default ${exp}`);
  if (!hasExp) {
    console.error(`FAIL: Missing export ${exp}`);
    process.exit(1);
  }
}
console.log('✓ All required exports present in TutorialModal.jsx');

// Extract all targetId values per role in TUTORIAL_DATA
const targetIdRegex = /targetId:\s*['"]([^'"]+)['"]/g;
const targetsFound = [];
let match;
while ((match = targetIdRegex.exec(tutorialModalContent)) !== null) {
  targetsFound.push(match[1]);
}
console.log(`Found ${targetsFound.length} targetIds in TUTORIAL_DATA:`, targetsFound);

// Check views where these targets should exist
const viewFiles = {
  admin: path.join(rootDir, 'src/views/AdminView.jsx'),
  guru: path.join(rootDir, 'src/views/GuruView.jsx'),
  siswa: path.join(rootDir, 'src/views/SiswaView.jsx'),
  superadmin: path.join(rootDir, 'src/views/SuperAdminView.jsx'),
  exam: path.join(rootDir, 'src/views/ExamRoom.jsx')
};

const viewContents = {};
for (const [key, filePath] of Object.entries(viewFiles)) {
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: View file not found: ${filePath}`);
    process.exit(1);
  }
  viewContents[key] = fs.readFileSync(filePath, 'utf-8');
}

// Map of targetId to expected view content check
const checks = [
  // Admin
  { id: 'admin-siswa', view: 'admin' },
  { id: 'admin-jadwal', view: 'admin' },
  { id: 'admin-kontrol', view: 'admin' },
  { id: 'admin-pengaturan', view: 'admin' },
  { id: 'admin-panduan', view: 'admin' },
  // Guru
  { id: 'guru-bank_soal', view: 'guru' },
  { id: 'guru-pengawasan', view: 'guru' },
  { id: 'guru-monitoring', view: 'guru' },
  { id: 'guru-nilai', view: 'guru' },
  { id: 'guru-panduan', view: 'guru' },
  // Siswa
  { id: 'siswa-beranda', view: 'siswa' },
  { id: 'siswa-presensi', view: 'siswa' },
  { id: 'siswa-token', view: 'siswa' },
  { id: 'siswa-riwayat', view: 'siswa' },
  { id: 'siswa-panduan', view: 'siswa' },
  // SuperAdmin
  { id: 'superadmin-sekolah', view: 'superadmin' },
  { id: 'superadmin-admin', view: 'superadmin' },
  { id: 'superadmin-analytics', view: 'superadmin' },
  { id: 'superadmin-pengumuman', view: 'superadmin' },
  { id: 'superadmin-panduan', view: 'superadmin' },
  // Exam Room
  { id: 'exam-timer', view: 'exam' },
  { id: 'exam-font-size', view: 'exam' },
  { id: 'exam-palette', view: 'exam' },
  { id: 'exam-bottom-bar', view: 'exam' },
  { id: 'exam-selesai', view: 'exam' },
  { id: 'exam-panduan', view: 'exam' }
];

function verifyTargetInView(checkId, viewName, content) {
  // 1. Literal exact match in quotes or attribute string
  if (content.includes(`"${checkId}"`) || content.includes(`'${checkId}'`)) {
    return true;
  }
  // 2. Multi-alias in attribute (e.g. data-tutorial="admin-pengawas admin-kontrol")
  if (content.includes(` ${checkId}`) || content.includes(`${checkId} `) || content.includes(`${checkId}"`) || content.includes(`${checkId}'`)) {
    return true;
  }
  // 3. Dynamic interpolation check (prefix + verified item id in list)
  const prefixMap = {
    admin: 'admin-',
    guru: 'guru-',
    siswa: 'siswa-',
    superadmin: 'superadmin-'
  };
  const prefix = prefixMap[viewName];
  if (prefix && checkId.startsWith(prefix)) {
    const pureId = checkId.slice(prefix.length);
    const hasInterpolation = content.includes(`${prefix}\${item.id}`) ||
                            content.includes(`${prefix}\${tab.id}`) ||
                            content.includes(`${prefix}\${id}`);
    const hasItemId = content.includes(`id: '${pureId}'`) ||
                      content.includes(`id: "${pureId}"`) ||
                      content.includes(`'${pureId}'`);
    if (hasInterpolation && hasItemId) {
      return true;
    }
  }
  return false;
}

let failed = false;
for (const check of checks) {
  const content = viewContents[check.view];
  const hasAttr = verifyTargetInView(check.id, check.view, content);
  if (!hasAttr) {
    console.error(`FAIL: TargetId ${check.id} not found in view ${check.view}`);
    failed = true;
  } else {
    console.log(`✓ TargetId '${check.id}' verified in ${check.view}`);
  }
}

// Verify TutorialBadge usage in views
for (const [key, content] of Object.entries(viewContents)) {
  if (!content.includes('<TutorialBadge')) {
    console.error(`FAIL: <TutorialBadge JSX not rendered in ${key}`);
    failed = true;
  } else {
    console.log(`✓ <TutorialBadge rendered in ${key}`);
  }
  if (!content.includes('<TutorialModal')) {
    console.error(`FAIL: <TutorialModal JSX not rendered in ${key}`);
    failed = true;
  } else {
    console.log(`✓ <TutorialModal rendered in ${key}`);
  }
  if (!content.includes('resetTutorialProgress') && !content.includes('handleRestartTutorial')) {
    console.warn(`Note: Restart functionality might be missing in ${key}`);
  } else {
    console.log(`✓ Restart tutorial functionality present in ${key}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log('--- All Tutorial Verification Checks Passed ---');
