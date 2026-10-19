import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
  }
}

console.log('======================================================================');
console.log(' ADVERSARIAL STRESS TEST: ROUND 25-2 REVIEWER HARDCORE SUITE         ');
console.log(' A11y, Focus Trap, Role Normalization, Zero Crash & Tailwind Tokens  ');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: Tailwind CSS v3 Token Validity
// ---------------------------------------------------------------------------
console.log('▶ Suite 1: Tailwind CSS v3 Token Validity Audit...');
const modalSource = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TutorialModal.jsx'), 'utf8');

assert(!modalSource.includes('shadow-xs'), 'No invalid "shadow-xs" class in TutorialModal');
assert(!modalSource.includes('shadow-2xs'), 'No invalid "shadow-2xs" class in TutorialModal');
assert(!modalSource.includes('backdrop-blur-xs'), 'No invalid "backdrop-blur-xs" class in TutorialModal');
assert(modalSource.includes('shadow-sm'), 'Uses standard Tailwind v3 "shadow-sm" class');

// ---------------------------------------------------------------------------
// Suite 2: Long Text Chips & Empty Bold Robustness
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 2: Long Text Chips & Bold Formatter Resilience...');
// Check that formatted text chip contains max-w-full and break-words
assert(
  modalSource.includes('max-w-full') && modalSource.includes('break-words'),
  'UI chips have max-w-full break-words protection against mobile viewport overflow'
);

// Check that empty bold ** is prevented from creating empty strong tags
assert(
  modalSource.includes('part.length > 4'),
  'renderFormattedText guards against empty double-asterisk tags (**)'
);

// ---------------------------------------------------------------------------
// Suite 3: WAI-ARIA Semantics & Accessibility
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 3: WAI-ARIA Semantics & Screen Reader Accessibility...');
assert(modalSource.includes('role="dialog"'), 'Has role="dialog"');
assert(modalSource.includes('aria-modal="true"'), 'Has aria-modal="true"');
assert(modalSource.includes('aria-labelledby="tutorial-modal-title"'), 'Has aria-labelledby');
assert(modalSource.includes('aria-current={isCurrent ? \'step\' : undefined}'), 'Step pill buttons use aria-current="step"');
assert(modalSource.includes('aria-label={`Tahap ${idx + 1}: ${st.shortTitle}`}'), 'Step pill buttons use descriptive aria-label');
assert(modalSource.includes('<ol') && modalSource.includes('role="list"'), 'Action points rendered as semantic ordered list (<ol role="list">)');
assert(modalSource.includes('<li') && modalSource.includes('role="listitem"'), 'Action point items rendered as semantic list items (<li role="listitem">)');
assert(modalSource.includes('aria-label="Tahap Sebelumnya"'), 'Previous button has explicit aria-label');
assert(modalSource.includes('aria-label="Tahap Selanjutnya"'), 'Next button has explicit aria-label');
assert(modalSource.includes('aria-label="Selesai dan Paham"'), 'Finish button has explicit aria-label');

// ---------------------------------------------------------------------------
// Suite 4: Keyboard Navigation, Input Collision & Focus Trap
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 4: Keyboard Navigation, Input Collision & Focus Trap...');
assert(modalSource.includes('safeOnClose'), 'Uses safe defensive onClose wrapper');
assert(modalSource.includes('modalCardRef'), 'Declares ref for accessible focus trap');
assert(modalSource.includes('e.key === \'Tab\''), 'Implements keyboard Tab trap logic for modal accessibility');
assert(modalSource.includes('e.key === \'Escape\''), 'Implements Escape key dismissal');
assert(modalSource.includes('[\'INPUT\', \'TEXTAREA\'].includes(e.target?.tagName)'), 'Prevents arrow key step change when user types in inputs');

// ---------------------------------------------------------------------------
// Suite 5: SSR Component Loading & Multi-Role SSR Verification
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 5: SSR Multi-Role Rendering & Edge Case Inputs...');
let vite;
try {
  vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const tutModule = await vite.ssrLoadModule('/src/components/TutorialModal.jsx');
  const TutorialModal = tutModule.default;

  // Test 1: Standard render for each role
  for (const role of ['admin', 'guru', 'siswa', 'super_admin']) {
    const html = ReactDOMServer.renderToString(
      React.createElement(TutorialModal, { isOpen: true, initialRole: role, onClose: () => {} })
    );
    assert(html.includes('Tutorial &amp; Panduan Alur Kerja'), `Renders cleanly for role: ${role}`);
    assert(/Langkah (<!-- -->)?1/.test(html), `Displays Langkah 1 badge for role: ${role}`);
  }

  // Test 2: Closed modal renders nothing
  const closedHtml = ReactDOMServer.renderToString(
    React.createElement(TutorialModal, { isOpen: false, initialRole: 'admin', onClose: () => {} })
  );
  assert(closedHtml === '', 'Closed modal returns null');

  // Test 3: Missing onClose prop does NOT crash SSR
  const noCloseHtml = ReactDOMServer.renderToString(
    React.createElement(TutorialModal, { isOpen: true, initialRole: 'admin' })
  );
  assert(noCloseHtml.includes('Tutorial &amp; Panduan Alur Kerja'), 'Missing onClose prop does not throw error');

  // Test 4: Exotic initialRole inputs (uppercase, superadmin, null, unknown)
  const upperHtml = ReactDOMServer.renderToString(
    React.createElement(TutorialModal, { isOpen: true, initialRole: 'ADMIN' })
  );
  assert(upperHtml.includes('Admin Sekolah'), 'Uppercase role "ADMIN" normalizes to admin');

  const superadminNoUnderHtml = ReactDOMServer.renderToString(
    React.createElement(TutorialModal, { isOpen: true, initialRole: 'superadmin' })
  );
  assert(superadminNoUnderHtml.includes('Super Admin'), 'Role "superadmin" without underscore normalizes to super_admin');

  const nullRoleHtml = ReactDOMServer.renderToString(
    React.createElement(TutorialModal, { isOpen: true, initialRole: null })
  );
  assert(nullRoleHtml.includes('Admin Sekolah'), 'Null role gracefully falls back to admin');

  const unknownRoleHtml = ReactDOMServer.renderToString(
    React.createElement(TutorialModal, { isOpen: true, initialRole: 'astronaut_role' })
  );
  assert(unknownRoleHtml.includes('Admin Sekolah'), 'Unknown role gracefully falls back to admin');

} finally {
  if (vite) await vite.close();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL HARDCORE ADVERSARIAL CHECKS PASSED!\n');
}
