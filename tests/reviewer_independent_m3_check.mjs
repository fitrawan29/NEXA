import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const guru = fs.readFileSync(path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx'), 'utf8');
const skema = fs.readFileSync(path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx'), 'utf8');
const api = fs.readFileSync(path.resolve(projectRoot, 'src', 'api.js'), 'utf8');

console.log('--- INDEPENDENT REVIEW CHECKS ---');

// 1. Skema button in toolbar
const skemaBtnMatch = guru.includes('setSkemaModal({ isOpen: true, id_mapel: selectedMapel })');
console.log('1. Skema button trigger present:', skemaBtnMatch);

// 2. Skema button touch target
const skemaBtnIdx = guru.indexOf('setSkemaModal({ isOpen: true');
const skemaBtnBlock = guru.substring(skemaBtnIdx - 50, skemaBtnIdx + 300);
console.log('2. Skema button min-h-[44px]:', skemaBtnBlock.includes('min-h-[44px]'));

// 3. Modal containment
const modalIdx = guru.indexOf('skemaModal.isOpen && (');
const modalBlock = guru.substring(modalIdx, modalIdx + 500);
console.log('3. Modal max-w-2xl and responsive padding:', modalBlock.includes('max-w-2xl') && modalBlock.includes('p-4'));

// 4. Mode selection in SkemaPenilaianPanel
console.log('4. SkemaPenilaianPanel default mode state:', skema.includes("useState('default')"));
console.log('5. Inputs disabled on default mode:', skema.includes("disabled={mode === 'default'}"));
console.log('6. Strict 100% sum check in custom mode:', skema.includes('total !== 100'));
console.log('7. Default mode sets bobot 0:', skema.includes('bobot: 0'));
console.log('8. Custom mode sets bobot 1:', skema.includes('bobot: 1'));

// 5. Check for any fixed width > 375px in GuruView & SkemaPanel
const fixedWidthsGuru = [...guru.matchAll(/w-\[(\d+)px\]/g)].map(m => parseInt(m[1])).filter(w => w > 375);
const fixedWidthsSkema = [...skema.matchAll(/w-\[(\d+)px\]/g)].map(m => parseInt(m[1])).filter(w => w > 375);
console.log('9. Fixed widths > 375px in GuruView:', fixedWidthsGuru);
console.log('10. Fixed widths > 375px in SkemaPenilaianPanel:', fixedWidthsSkema);

// 6. Check responsive classes for 1024px+
console.log('11. lg:grid-cols-12 present:', guru.includes('lg:grid-cols-12'));
console.log('12. lg:col-span-7 present:', guru.includes('lg:col-span-7'));
console.log('13. lg:col-span-5 present:', guru.includes('lg:col-span-5'));

// 7. Check 3-column stats bar responsiveness
const statsBarIdx = guru.indexOf('grid grid-cols-3 gap-2.5 sm:gap-3.5');
const statsBar = guru.substring(statsBarIdx, statsBarIdx + 1500);
console.log('14. Mobile responsive label truncation/abbreviation:', statsBar.includes('sm:hidden') && statsBar.includes('hidden sm:inline'));

// 8. Test simulation of SkemaPenilaianPanel logic directly
function testSkemaLogic(mode, weights) {
  const hitungTotal = (w) => Object.values(w).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  if (mode === 'custom') {
    const total = hitungTotal(weights);
    if (total !== 100) {
      return { error: `Total persentase bobot skema khusus harus tepat 100%. Saat ini: ${total}%.` };
    }
    return { payload: { kunci_jawaban: JSON.stringify({ mode: 'custom', skema: weights }), bobot: 1 } };
  } else {
    return { payload: { kunci_jawaban: JSON.stringify({ mode: 'default', skema: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 } }), bobot: 0 } };
  }
}

console.log('15. Default mode test:', testSkemaLogic('default', {}));
console.log('16. Custom mode test (valid 100%):', testSkemaLogic('custom', { PG: 50, PGK: 20, BS: 10, JODOH: 0, ISIAN: 0, URAIAN: 20 }));
console.log('17. Custom mode test (invalid 90%):', testSkemaLogic('custom', { PG: 50, PGK: 20, BS: 10, JODOH: 0, ISIAN: 0, URAIAN: 10 }));
console.log('18. Custom mode test (invalid 110%):', testSkemaLogic('custom', { PG: 60, PGK: 20, BS: 10, JODOH: 0, ISIAN: 0, URAIAN: 20 }));
