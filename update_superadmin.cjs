const fs = require('fs');
let content = fs.readFileSync('views/SuperAdminView.js', 'utf-8');

// 1. Update handleDelete
const oldHandleDelete = `      const handleDelete = async (type, item) => {
        if (!confirm(\`Hapus data ini secara permanen?\`)) return;
        let endpoint = '';
        let payload = {};
        
        if (type === 'sekolah') { endpoint = 'delete_sekolah'; payload = { npsn: item.npsn }; }
        else if (type === 'admin') { endpoint = 'delete_admin_sekolah'; payload = { id_admin: item.id_admin }; }
        else if (type === 'pengumuman') { endpoint = 'delete_pengumuman_global'; payload = { id_pengumuman: item.id_pengumuman }; }
        
        const res = await fetchAPI(endpoint, payload);
        if (res.status === 'success') fetchData(activeTab);
        else alert(res.message);
      };`;

const newHandleDelete = `      const handleSuspend = async (npsn, currentStatus) => {
        const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
        if (!confirm(\`Apakah Anda yakin ingin \${newStatus === 'SUSPENDED' ? 'menonaktifkan' : 'mengaktifkan'} sekolah dengan NPSN \${npsn}?\`)) return;
        const res = await fetchAPI('update_sekolah_status', { npsn, status: newStatus });
        if (res.status === 'success') fetchData('sekolah');
        else alert(res.message);
      };

      const handleDelete = async (type, item) => {
        if (type === 'sekolah') {
          const inputNpsn = prompt(\`PERINGATAN: Menghapus sekolah akan menghapus SEMUA data guru, siswa, dan ujian di dalamnya secara permanen.\\n\\nKetik ulang NPSN "\${item.npsn}" untuk mengonfirmasi penghapusan:\`);
          if (inputNpsn !== item.npsn) {
            if (inputNpsn !== null) alert("NPSN yang diketik tidak cocok. Penghapusan dibatalkan.");
            return;
          }
        } else {
          if (!confirm(\`Hapus data ini secara permanen?\`)) return;
        }

        let endpoint = '';
        let payload = {};
        
        if (type === 'sekolah') { endpoint = 'delete_sekolah'; payload = { npsn: item.npsn }; }
        else if (type === 'admin') { endpoint = 'delete_admin_sekolah'; payload = { id_admin: item.id_admin }; }
        else if (type === 'pengumuman') { endpoint = 'delete_pengumuman_global'; payload = { id_pengumuman: item.id_pengumuman }; }
        
        const res = await fetchAPI(endpoint, payload);
        if (res.status === 'success') fetchData(activeTab);
        else alert(res.message);
      };`;

content = content.replace(oldHandleDelete, newHandleDelete);

// 2. Update table rendering for status
const oldTableCells = `<td className="p-4">{row.npsn}</td><td className="p-4">{row.nama_sekolah}</td>`;
const newTableCells = `<td className="p-4">{row.npsn}</td><td className="p-4">{row.nama_sekolah}</td><td className="p-4"><span className={\`px-2 py-1 rounded-full text-xs font-bold \${row.status === 'SUSPENDED' ? 'bg-error/20 text-error' : 'bg-green-500/20 text-green-600'}\`}>{row.status || 'ACTIVE'}</span></td>`;
content = content.replace(oldTableCells, newTableCells);

const oldTableHeader = `<th className="p-4">Nama Sekolah</th>`;
const newTableHeader = `<th className="p-4">Nama Sekolah</th>{activeTab === 'sekolah' && <th className="p-4">Status</th>}`;
content = content.replace(oldTableHeader, newTableHeader);

const oldDeleteButton = `<button onClick={() => handleDelete(activeTab, row)} className="text-error hover:bg-error/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>`;
const newButtons = `
  {activeTab === 'sekolah' && (
    <button onClick={() => handleSuspend(row.npsn, row.status)} title={row.status === 'SUSPENDED' ? 'Aktifkan' : 'Suspend'} className="text-orange-500 hover:bg-orange-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1">
      <span className="material-symbols-outlined text-[20px]">{row.status === 'SUSPENDED' ? 'play_circle' : 'pause_circle'}</span>
    </button>
  )}
  <button onClick={() => handleDelete(activeTab, row)} title="Hapus" className="text-error hover:bg-error/10 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>
`;
content = content.replace(oldDeleteButton, newButtons);

fs.writeFileSync('views/SuperAdminView.js', content, 'utf-8');
console.log('Update SuperAdminView.js selesai!');
