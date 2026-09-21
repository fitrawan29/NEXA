import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as parser from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

console.log('====================================================');
console.log(' ADVERSARIAL CHALLENGE PROBE — EMPIRICAL VERIFICATION');
console.log('====================================================');

let totalErrors = 0;

// 1. Check package.json for UI framework additions (R3 compliance)
console.log('\n[Probe 1] Package.json Dependency Audit (R3 Tech Constraints)...');
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
// The original dependencies present in package.json at commit 580e2361
const expectedDeps = [
  '@supabase/supabase-js',
  'canvas-confetti',
  'lucide-react',
  'prop-types',
  'react',
  'react-dom',
  'react-quill',
  'react-router-dom',
  'xlsx'
];
const actualDeps = Object.keys(pkg.dependencies || {});
const addedDeps = actualDeps.filter(d => !expectedDeps.includes(d));
if (addedDeps.length > 0) {
  console.error('FAIL: Unexpected new dependencies added to package.json:', addedDeps);
  totalErrors++;
} else {
  console.log('PASS: package.json has 0 added UI frameworks or external dependencies. Current dependencies:', actualDeps);
}

// 2. AST parsing of all JS/JSX files in src/
console.log('\n[Probe 2] Full Babel AST Syntax & Parsing Audit on all src/ files...');
function getAllFiles(dir, extList) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extList));
    } else if (extList.includes(path.extname(item.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsFiles = getAllFiles(srcDir, ['.js', '.jsx']);
console.log(`Found ${jsFiles.length} JS/JSX files to audit.`);

let parseFailures = 0;
const astCache = {};

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    astCache[file] = { ast, content };
  } catch (err) {
    console.error(`FAIL: Babel AST Parse error in ${path.relative(projectRoot, file)}:`, err.message);
    parseFailures++;
    totalErrors++;
  }
}
if (parseFailures === 0) {
  console.log(`PASS: All ${jsFiles.length} files parsed into Babel AST with 0 syntax errors.`);
}

// 3. Scan for Phantom Material Design 3 Classes across all JSX files
console.log('\n[Probe 3] Comprehensive Phantom Material Design 3 Classes Scan...');
const phantomPatterns = [
  /\bbg-surface\b/,
  /\bbg-surface-container\b/,
  /\bbg-surface-variant\b/,
  /\btext-on-surface\b/,
  /\btext-on-surface-variant\b/,
  /\bborder-outline\b/,
  /\bborder-outline-variant\b/,
  /\bp-md\b/,
  /\bp-lg\b/,
  /\bgap-md\b/,
  /\bgap-lg\b/,
  /\bfont-label-md\b/,
  /\bfont-label-lg\b/,
  /\bfont-title-md\b/,
  /\bfont-title-lg\b/,
  /\bbg-primary-container\b/,
  /\btext-on-primary-container\b/
];

let phantomCount = 0;
for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('className') || line.includes('class=')) {
      for (const pat of phantomPatterns) {
        if (pat.test(line)) {
          console.error(`FAIL: Phantom token matching ${pat} in ${path.relative(projectRoot, file)}:${idx + 1}: ${line.trim()}`);
          phantomCount++;
          totalErrors++;
        }
      }
    }
  });
}
if (phantomCount === 0) {
  console.log('PASS: 0 phantom Material Design 3 tokens found across all source files.');
}

// 4. AST Traversal for Broken Template Literals in JSX (${...})
console.log('\n[Probe 4] AST Traversal for Broken Template Literals in JSX Text & Attributes...');
function traverseAST(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach(c => traverseAST(c, visitor));
    } else if (child && typeof child === 'object') {
      traverseAST(child, visitor);
    }
  }
}

let jsxLiteralErrors = 0;
for (const [file, { ast }] of Object.entries(astCache)) {
  traverseAST(ast, (node) => {
    // Check JSXText nodes for literal "${...}"
    if (node.type === 'JSXText') {
      if (/\$\{[^}]+\}/.test(node.value)) {
        console.error(`FAIL: Unescaped template expression in JSXText in ${path.relative(projectRoot, file)}: "${node.value.trim()}"`);
        jsxLiteralErrors++;
        totalErrors++;
      }
    }
    // Check static string attributes for literal "${...}"
    if (node.type === 'JSXAttribute' && node.value && node.value.type === 'StringLiteral') {
      if (/\$\{[^}]+\}/.test(node.value.value)) {
        console.error(`FAIL: Unescaped template expression in string attribute in ${path.relative(projectRoot, file)} (${node.name.name}): "${node.value.value}"`);
        jsxLiteralErrors++;
        totalErrors++;
      }
    }
  });
}
if (jsxLiteralErrors === 0) {
  console.log('PASS: 0 broken template expressions (${...}) found inside JSX text or static string attributes.');
}

// 5. Broken Import Paths Resolution Audit
console.log('\n[Probe 5] Broken Import Paths Resolution Audit...');
let brokenImports = 0;
for (const [file, { ast }] of Object.entries(astCache)) {
  const dir = path.dirname(file);
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const importSource = node.source.value;
      if (importSource.startsWith('.')) {
        const resolved = path.resolve(dir, importSource);
        const candidates = [
          resolved,
          resolved + '.js',
          resolved + '.jsx',
          resolved + '.json',
          resolved + '.css',
          path.join(resolved, 'index.js'),
          path.join(resolved, 'index.jsx')
        ];
        const exists = candidates.some(c => fs.existsSync(c));
        if (!exists) {
          console.error(`FAIL: Unresolved relative import '${importSource}' in ${path.relative(projectRoot, file)}`);
          brokenImports++;
          totalErrors++;
        }
      }
    }
  }
}
if (brokenImports === 0) {
  console.log('PASS: All relative import declarations resolve to existing files on disk.');
}

// 6. Conflicting Inline Styles Check
console.log('\n[Probe 6] Conflicting Inline Styles Audit...');
let conflictingStyles = 0;
for (const [file, { content }] of Object.entries(astCache)) {
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/style=\{\{\s*(backgroundColor|color|borderColor|padding|margin|display):\s*['"`]/.test(line)) {
      if (/backgroundColor:\s*['"]#(?:[0-9a-fA-F]{3,8})['"]/.test(line)) {
        console.error(`FAIL: Hardcoded decorative hex background color in ${path.relative(projectRoot, file)}:${idx + 1}: ${line.trim()}`);
        conflictingStyles++;
        totalErrors++;
      }
    }
  });
}
if (conflictingStyles === 0) {
  console.log('PASS: 0 conflicting decorative inline styles detected.');
}

// 7. Responsive Breakpoint Density Audit on Primary Views
console.log('\n[Probe 7] Responsive Breakpoint Density on Core Views...');
const coreViews = [
  'src/views/SiswaView.jsx',
  'src/views/ExamRoom.jsx',
  'src/views/AdminView.jsx',
  'src/views/GuruView.jsx',
  'src/views/SuperAdminView.jsx',
  'src/components/UI.jsx'
];

for (const relPath of coreViews) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`FAIL: View file missing: ${relPath}`);
    totalErrors++;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const smMatches = (content.match(/\bsm:/g) || []).length;
  const mdMatches = (content.match(/\bmd:/g) || []).length;
  const lgMatches = (content.match(/\blg:/g) || []).length;
  const xlMatches = (content.match(/\bxl:/g) || []).length;
  const totalResponsive = smMatches + mdMatches + lgMatches + xlMatches;

  console.log(`- ${relPath}: sm=${smMatches}, md=${mdMatches}, lg=${lgMatches}, xl=${xlMatches} (Total: ${totalResponsive})`);
  if (totalResponsive === 0 && !relPath.includes('UI.jsx')) {
    console.error(`FAIL: View ${relPath} lacks responsive breakpoint classes!`);
    totalErrors++;
  }
}

console.log('\n====================================================');
console.log(`PROBE SUMMARY: Total Errors Detected: ${totalErrors}`);
console.log('====================================================');

process.exit(totalErrors === 0 ? 0 : 1);
