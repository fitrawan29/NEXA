/**
 * CBT NEXA Codebase Audits Test Suite
 * Automated checks validating the 6 Acceptance Criteria from ORIGINAL_REQUEST.md & PROJECT.md:
 * 1. Production Build Success (npm run build)
 * 2. JSX Syntax & Absence of Broken Template Literals (${...} in JSX children)
 * 3. Phantom Classes Audit (bg-surface, border-outline-variant, p-md, etc.)
 * 4. Conflicting Inline Styles Audit (style={{ ... }})
 * 5. Responsive Breakpoint Utilities Audit (sm:, md:, lg:, xl:)
 * 6. Component Integrity & Interface Contract Compliance
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TestSuite, assert } from './test_framework.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

function getAllSourceFiles(dir, extensions = ['.jsx', '.js']) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.agents') {
        results = results.concat(getAllSourceFiles(fullPath, extensions));
      }
    } else if (entry.isFile()) {
      if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export function createAuditsSuite(options = {}) {
  const suite = new TestSuite('Codebase Audits & Acceptance Criteria', 'Static, AST, and Build Integrity Audits');
  const sourceFiles = getAllSourceFiles(srcDir);

  // =========================================================================
  // Audit 1: Production Build Success
  // =========================================================================
  suite.add('Audit 1 [AC-1] Production Build Verification (npm run build)', () => {
    if (options.skipBuild) {
      console.log('       ⏩ Skipping build execution (--fast mode)');
      return;
    }

    try {
      const output = execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 60000
      });

      assert.match(output, /built in/i, 'Vite production build completed');
      
      const distIndexHtml = path.join(projectRoot, 'dist', 'index.html');
      assert.ok(fs.existsSync(distIndexHtml), 'dist/index.html generated');
      const htmlContent = fs.readFileSync(distIndexHtml, 'utf8');
      assert.ok(htmlContent.length > 500, 'dist/index.html has content');

      const distAssets = path.join(projectRoot, 'dist', 'assets');
      assert.ok(fs.existsSync(distAssets), 'dist/assets directory exists');
      const assetFiles = fs.readdirSync(distAssets);
      assert.ok(assetFiles.some(f => f.endsWith('.js')), 'Production JS bundle generated');
      assert.ok(assetFiles.some(f => f.endsWith('.css')), 'Production CSS bundle generated');
    } catch (err) {
      throw new Error(`Build failed: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`);
    }
  });

  // =========================================================================
  // Audit 2: JSX Syntax & Broken Template Literals
  // =========================================================================
  suite.add('Audit 2 [AC-2] JSX Syntax & Absence of Broken Template Literals (${...})', async () => {
    const { parse } = await import('@babel/parser');
    const brokenExpressions = [];

    const findBrokenJSXInAST = (node, filePath, broken) => {
      if (!node) return;

      if (node.type === 'JSXElement') {
        const children = node.children || [];
        for (let i = 0; i < children.length - 1; i++) {
          const curr = children[i];
          const next = children[i + 1];
          // Check for pattern: JSXText ending with "$" followed immediately by JSXExpressionContainer
          if (curr.type === 'JSXText' && curr.value.trim().endsWith('$') && next.type === 'JSXExpressionContainer') {
            broken.push({
              file: path.relative(projectRoot, filePath),
              line: curr.loc ? curr.loc.start.line : 0,
              type: 'JSXText ($) directly followed by JSXExpressionContainer',
              snippet: `${curr.value.trim()}{...}`
            });
          }
        }
      }

      // Check for attribute values written as className="${...}" instead of className={`${...}`}
      if (node.type === 'JSXAttribute' && node.value && node.value.type === 'StringLiteral') {
        if (node.value.value.startsWith('${') && node.value.value.endsWith('}')) {
          broken.push({
            file: path.relative(projectRoot, filePath),
            line: node.value.loc ? node.value.loc.start.line : 0,
            type: 'JSXAttribute StringLiteral with unparsed ${...}',
            snippet: node.value.value
          });
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'comments') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(c => {
            if (c && typeof c === 'object' && c.type) findBrokenJSXInAST(c, filePath, broken);
          });
        } else if (child && typeof child === 'object' && child.type) {
          findBrokenJSXInAST(child, filePath, broken);
        }
      }
    };

    for (const filePath of sourceFiles) {
      if (!filePath.endsWith('.jsx')) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        const ast = parse(content, { sourceType: 'module', plugins: ['jsx'] });
        findBrokenJSXInAST(ast, filePath, brokenExpressions);
      } catch (parseErr) {
        brokenExpressions.push({
          file: path.relative(projectRoot, filePath),
          line: parseErr.loc ? parseErr.loc.line : 1,
          type: 'Fatal JSX Syntax Parse Error',
          snippet: parseErr.message
        });
      }
    }

    if (brokenExpressions.length > 0) {
      const details = brokenExpressions
        .map(b => `  - ${b.file}:${b.line} -> [${b.type}] "${b.snippet}"`)
        .join('\n');
      throw new Error(`Found ${brokenExpressions.length} broken template literal / syntax defect(s) in JSX:\n${details}`);
    }

    assert.equal(brokenExpressions.length, 0, 'No broken template literals inside JSX');
  });

  // =========================================================================
  // Audit 3: Absence of Phantom Classes
  // =========================================================================
  suite.add('Audit 3 [AC-3] Absence of Unhandled Phantom Material Design 3 Classes', () => {
    // Known phantom classes that lack Tailwind utilities in tailwind.config.js
    const phantomPatterns = [
      /\bbg-surface\b/,
      /\bbg-surface-variant\b/,
      /\btext-on-surface\b/,
      /\btext-on-surface-variant\b/,
      /\bborder-outline-variant\b/,
      /\bbg-secondary-container\b/,
      /\btext-on-secondary-container\b/,
      /\bp-md\b/,
      /\bp-lg\b/,
      /\bgap-md\b/,
      /\bgap-sm\b/,
      /\bfont-label-md\b/,
      /\btext-label-md\b/,
      /\bfont-body-md\b/,
      /\btext-body-md\b/,
      /\bfont-headline-lg\b/,
      /\btext-headline-lg\b/,
      /\bmb-sm\b/,
      /\bmb-lg\b/,
      /\bmb-xs\b/
    ];

    const detectedPhantoms = [];

    for (const filePath of sourceFiles) {
      const relPath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comments or non-className lines
        if (!line.includes('className') && !line.includes('class=')) return;

        for (const pattern of phantomPatterns) {
          if (pattern.test(line)) {
            const match = line.match(pattern)[0];
            detectedPhantoms.push({
              file: relPath,
              line: index + 1,
              class: match,
              snippet: line.trim().slice(0, 100)
            });
          }
        }
      });
    }

    if (detectedPhantoms.length > 0) {
      // Group by file
      const summary = {};
      detectedPhantoms.forEach(p => {
        summary[p.file] = (summary[p.file] || 0) + 1;
      });
      const summaryStr = Object.entries(summary)
        .map(([f, count]) => `  - ${f}: ${count} phantom class instances`)
        .join('\n');

      throw new Error(
        `Found ${detectedPhantoms.length} unhandled phantom class instances across ${Object.keys(summary).length} files:\n${summaryStr}\n` +
        `Examples:\n` +
        detectedPhantoms.slice(0, 5).map(p => `  * ${p.file}:${p.line} -> "${p.class}" in ${p.snippet}`).join('\n')
      );
    }

    assert.equal(detectedPhantoms.length, 0, 'No unhandled phantom classes found in production codebase');
  });

  // =========================================================================
  // Audit 4: Conflicting Inline Styles
  // =========================================================================
  suite.add('Audit 4 [AC-4] Absence of Conflicting Decorative Inline Styles (style={{ ... }})', () => {
    // Only strictly dynamic attributes (such as dynamic chart bar height or fontVariationSettings) are permitted.
    // Static decorative styles (e.g. style={{ color: 'red', margin: '10px' }}) must use Tailwind.
    const conflictingStyles = [];
    const forbiddenProperties = ['color', 'backgroundColor', 'padding', 'margin', 'fontSize', 'borderRadius'];

    for (const filePath of sourceFiles) {
      if (!filePath.endsWith('.jsx')) continue;
      const relPath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('style={{')) {
          for (const prop of forbiddenProperties) {
            // Check for hardcoded static properties like color: '#...' or padding: '...'
            const regex = new RegExp(`${prop}\\s*:\\s*['"][^'"]+['"]`);
            if (regex.test(line)) {
              conflictingStyles.push({
                file: relPath,
                line: index + 1,
                property: prop,
                snippet: line.trim()
              });
            }
          }
        }
      });
    }

    if (conflictingStyles.length > 0) {
      const details = conflictingStyles
        .map(s => `  - ${s.file}:${s.line} -> [${s.property}] in "${s.snippet}"`)
        .join('\n');
      throw new Error(`Found ${conflictingStyles.length} conflicting static inline style(s):\n${details}`);
    }

    assert.equal(conflictingStyles.length, 0, 'No conflicting static inline styles found');
  });

  // =========================================================================
  // Audit 5: Responsive Breakpoint Utilities Presence
  // =========================================================================
  suite.add('Audit 5 [AC-5] Presence of Responsive Breakpoint Utilities (sm:, md:, lg:, xl:)', () => {
    const keyViews = [
      'src/views/AdminView.jsx',
      'src/views/GuruView.jsx',
      'src/views/SiswaView.jsx',
      'src/views/ExamRoom.jsx',
      'src/components/UI.jsx'
    ];

    const breakpointResults = [];

    for (const relView of keyViews) {
      const fullPath = path.resolve(projectRoot, relView);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Required view file not found: ${relView}`);
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const smCount = (content.match(/\bsm:/g) || []).length;
      const mdCount = (content.match(/\bmd:/g) || []).length;
      const lgCount = (content.match(/\blg:/g) || []).length;
      const xlCount = (content.match(/\bxl:/g) || []).length;
      const totalBreakpoints = smCount + mdCount + lgCount + xlCount;

      breakpointResults.push({
        file: relView,
        sm: smCount,
        md: mdCount,
        lg: lgCount,
        xl: xlCount,
        total: totalBreakpoints
      });

      const minRequired = relView.includes('components/') ? 2 : 10;
      assert.greaterThanOrEqual(
        totalBreakpoints,
        minRequired,
        `Component ${relView} must utilize responsive breakpoints (found: ${totalBreakpoints}, min required: ${minRequired} [sm:${smCount}, md:${mdCount}, lg:${lgCount}, xl:${xlCount}])`
      );
    }

    assert.equal(breakpointResults.length, keyViews.length, 'All key views verified for responsive breakpoints');
  });

  // =========================================================================
  // Audit 6: Component Integrity & Contract Compliance
  // =========================================================================
  suite.add('Audit 6 [AC-6] Component Integrity & Interface Contract Compliance', () => {
    // 1. Check tailwind.config.js font family & colors
    const tailwindConfigPath = path.join(projectRoot, 'tailwind.config.js');
    assert.ok(fs.existsSync(tailwindConfigPath), 'tailwind.config.js exists');
    const tailwindContent = fs.readFileSync(tailwindConfigPath, 'utf8');
    assert.match(tailwindContent, /sans:\s*\[.*Nunito/i, 'tailwind.config.js configures Nunito font family');
    assert.match(tailwindContent, /primary:/, 'tailwind.config.js defines primary color token');

    // 2. Check index.html font links
    const indexHtmlPath = path.join(projectRoot, 'index.html');
    assert.ok(fs.existsSync(indexHtmlPath), 'index.html exists');
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(htmlContent, /fonts\.googleapis\.com.*Nunito/i, 'index.html loads Nunito font');
    assert.match(htmlContent, /Material\+Symbols\+Outlined/i, 'index.html loads Material Symbols Outlined');

    // 3. Check App.jsx imports and routing contracts
    const appPath = path.join(srcDir, 'App.jsx');
    assert.ok(fs.existsSync(appPath), 'App.jsx exists');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /AdminView/, 'App.jsx imports or lazy-loads AdminView');
    assert.match(appContent, /GuruView/, 'App.jsx imports or lazy-loads GuruView');
    assert.match(appContent, /SiswaView/, 'App.jsx imports or lazy-loads SiswaView');

    // 4. Check ExamRoom.jsx signature and exports
    const examRoomPath = path.join(srcDir, 'views', 'ExamRoom.jsx');
    assert.ok(fs.existsSync(examRoomPath), 'ExamRoom.jsx exists');
    const examRoomContent = fs.readFileSync(examRoomPath, 'utf8');
    assert.match(examRoomContent, /const ExamRoom\s*=.*jadwal/, 'ExamRoom accepts jadwal prop');
    assert.match(examRoomContent, /const ExamRoom\s*=.*idLog/, 'ExamRoom accepts idLog prop');
    assert.match(examRoomContent, /const ExamRoom\s*=.*onFinish/, 'ExamRoom accepts onFinish prop');
    assert.match(examRoomContent, /export default ExamRoom/, 'ExamRoom exports as default');
  });

  return suite;
}
