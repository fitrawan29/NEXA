const fs = require('fs');
let content = fs.readFileSync('views/GuruView.js', 'utf-8');

// Replace table loading state with TableSkeleton
const loadingSpinnerRegex = /<div className="p-8 text-center text-slate-500">Memuat data...<\/div>/g;
content = content.replace(loadingSpinnerRegex, `<TableSkeleton />`);

const oldEmptyTable = /<tr><td colSpan="7" className="p-8 text-center text-slate-500">Belum ada data\.<\/td><\/tr>/g;
const newEmptyTable = `<tr><td colSpan="7" className="p-0"><EmptyState icon="edit_note" title="Bank Soal Kosong" message="Belum ada soal untuk mata pelajaran ini." /></td></tr>`;
content = content.replace(oldEmptyTable, newEmptyTable);

// Button Hierarchy and padding reduction
content = content.replace(/className="text-blue-500 hover:bg-blue-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1"/g, `className="text-primary hover:bg-primary/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1" title="Edit"`);
content = content.replace(/className="text-error hover:bg-error\/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors"/g, `className="text-slate-400 hover:text-error hover:bg-error/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors" title="Hapus"`);
content = content.replace(/className="text-orange-500 hover:bg-orange-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1"/g, `className="text-secondary hover:bg-secondary/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1"`);
content = content.replace(/<td className="p-4/g, `<td className="py-2 px-4`);
content = content.replace(/<th className="p-4/g, `<th className="py-3 px-4 font-semibold text-sm`);

// Responsive Table (Card Mode)
const tableRegex = /<table className="w-full text-left">([\s\S]*?)<\/table>/g;
content = content.replace(tableRegex, (match, inner) => {
  return `<div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap">${inner}</table></div>`;
});

// Penataan Ulang Tombol di Kelola Soal (Primary vs Secondary Outline)
// Currently "Import Excel" is solid green, "Pratinjau" is solid slate, "Tambah Soal" is solid primary, "Tambah Narasi" is solid secondary
// We'll change "Import Excel" and "Pratinjau" to outline ghost buttons so they don't fight with Primary.
const oldImportBtn = `className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow"`;
const newImportBtn = `className="px-4 py-2 border-2 border-green-600 text-green-600 dark:text-green-400 dark:border-green-500 rounded-xl font-bold hover:bg-green-50 dark:hover:bg-green-900/30 transition-all flex items-center gap-2 text-sm shadow-sm"`;
content = content.replace(oldImportBtn, newImportBtn);

const oldPreviewBtn = `className="px-4 py-2 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow"`;
const newPreviewBtn = `className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-sm shadow-sm"`;
content = content.replace(oldPreviewBtn, newPreviewBtn);

fs.writeFileSync('views/GuruView.js', content, 'utf-8');
console.log('Update GuruView.js UI selesai!');
