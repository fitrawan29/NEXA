const fs = require('fs');

// ==== 1. Update AdminView.js ====
let adminContent = fs.readFileSync('views/AdminView.js', 'utf-8');

// Replace table loading state with TableSkeleton
const adminLoadingSpinner = `<div className="p-8 text-center"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span><p className="mt-2 text-slate-500">Memuat data...</p></div>`;
adminContent = adminContent.replace(adminLoadingSpinner, `<TableSkeleton />`);
adminContent = adminContent.replace(/<div className="p-8 text-center text-slate-500">Memuat data...<\/div>/g, `<TableSkeleton />`);

// Replace Empty State in Tables
const oldEmptySiswa = `<tr><td colSpan="3" className="p-4 text-center text-slate-500">Belum ada siswa di kelas ini.</td></tr>`;
const newEmptySiswa = `<tr><td colSpan="3" className="p-0"><EmptyState icon="group_off" title="Kelas Kosong" message="Belum ada siswa yang terdaftar di kelas ini." /></td></tr>`;
adminContent = adminContent.replace(oldEmptySiswa, newEmptySiswa);

const oldEmptyTable = `<tr><td colSpan="10" className="p-8 text-center text-slate-500">Belum ada data.</td></tr>`;
const newEmptyTable = `<tr><td colSpan="10" className="p-0"><EmptyState icon="database" title="Belum Ada Data" message="Silakan tambahkan data baru menggunakan tombol di atas." /></td></tr>`;
adminContent = adminContent.replace(oldEmptyTable, newEmptyTable);

// Responsive Table (Card Mode)
const tableRegex = /<table className="w-full text-left">([\s\S]*?)<\/table>/g;
adminContent = adminContent.replace(tableRegex, (match, inner) => {
  // Wrap table with a div that hides it on mobile, and adds a mobile card view.
  // Actually, rewriting the whole table structure to CSS grid is cleaner, but to be fast we can just add `hidden md:table` and a mobile fallback block. 
  // Wait, parsing the data is dynamic so we can just add responsive classes to the table elements.
  return `<div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap">${inner}</table></div>`;
});

// Update Button Hierarchy in AdminView
adminContent = adminContent.replace(/className="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-colors mr-1"/g, `className="text-primary hover:bg-primary/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1" title="Edit"`);
adminContent = adminContent.replace(/className="text-error hover:bg-error\/10 p-2 rounded-lg transition-colors"/g, `className="text-slate-400 hover:text-error hover:bg-error/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors" title="Hapus"`);

// Table padding reduction
adminContent = adminContent.replace(/<td className="p-4/g, `<td className="py-2 px-4`);
adminContent = adminContent.replace(/<th className="p-4/g, `<th className="py-3 px-4 font-semibold text-sm`);

fs.writeFileSync('views/AdminView.js', adminContent, 'utf-8');

// ==== 2. Update SuperAdminView.js ====
let superadminContent = fs.readFileSync('views/SuperAdminView.js', 'utf-8');

superadminContent = superadminContent.replace(/<div className="p-8 text-center text-slate-500">Memuat data...<\/div>/g, `<TableSkeleton />`);
superadminContent = superadminContent.replace(/<tr><td colSpan="10" className="p-8 text-center text-slate-500">Belum ada data.<\/td><\/tr>/g, `<tr><td colSpan="10" className="p-0"><EmptyState icon="dns" title="Tidak Ada Data" message="Belum ada data yang terdaftar." /></td></tr>`);

// Button Hierarchy
superadminContent = superadminContent.replace(/className="text-blue-500 hover:bg-blue-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1"/g, `className="text-primary hover:bg-primary/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1" title="Edit"`);
superadminContent = superadminContent.replace(/className="text-error hover:bg-error\/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors"/g, `className="text-slate-400 hover:text-error hover:bg-error/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors" title="Hapus"`);
superadminContent = superadminContent.replace(/className="text-orange-500 hover:bg-orange-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1"/g, `className="text-secondary hover:bg-secondary/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1"`);

// Table padding reduction
superadminContent = superadminContent.replace(/<td className="p-4/g, `<td className="py-2 px-4`);
superadminContent = superadminContent.replace(/<th className="p-4/g, `<th className="py-3 px-4 font-semibold text-sm`);

fs.writeFileSync('views/SuperAdminView.js', superadminContent, 'utf-8');

console.log('Update Admin & SuperAdmin selesai!');
