import fs from 'fs';

const content = fs.readFileSync('src/components/TutorialModal.jsx', 'utf-8');
const adminView = fs.readFileSync('src/views/AdminView.jsx', 'utf-8');
const guruView = fs.readFileSync('src/views/GuruView.jsx', 'utf-8');
const siswaView = fs.readFileSync('src/views/SiswaView.jsx', 'utf-8');
const superView = fs.readFileSync('src/views/SuperAdminView.jsx', 'utf-8');
const examView = fs.readFileSync('src/views/ExamRoom.jsx', 'utf-8');

const regex = /id:\s*'([^']+)',\s*targetId:\s*'([^']+)'/g;
let m;
while ((m = regex.exec(content)) !== null) {
  const [_, id, targetId] = m;
  const role = id.startsWith('admin') ? 'admin' : id.startsWith('guru') ? 'guru' : id.startsWith('siswa') ? 'siswa' : id.startsWith('superadmin') ? 'super_admin' : 'exam_room';
  const v = role === 'admin' ? adminView : role === 'guru' ? guruView : role === 'siswa' ? siswaView : role === 'super_admin' ? superView : examView;
  const explicit = v.includes('"' + targetId + '"') || v.includes("'" + targetId + "'");
  const dynPrefix = role === 'admin' ? 'admin-' : role === 'guru' ? 'guru-' : role === 'siswa' ? 'siswa-' : 'superadmin-';
  const pureId = targetId.replace(dynPrefix, '');
  const dyn = v.includes(dynPrefix) && (v.includes("'" + pureId + "'") || v.includes('"' + pureId + '"'));
  console.log(`${role.padEnd(12)} | ${id.padEnd(22)} | targetId: ${targetId.padEnd(22)} | found: ${explicit || dyn ? 'YES' : 'NO'} (explicit=${explicit}, dyn=${dyn})`);
}
