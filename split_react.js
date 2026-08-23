const fs = require('fs');

const lines = fs.readFileSync('script.js', 'utf8').split('\n');

const findLineIndex = (pattern) => lines.findIndex(line => line.includes(pattern));

const configEnd = findLineIndex('// Fungsi fetchAPI sebagai Router Supabase');
const apiEnd = findLineIndex('// Komponen Modal Premium');
const loaderStart = findLineIndex('const Loader = ({');
const adminViewStart = findLineIndex('const AdminView = ({');
const formSoalModalStart = findLineIndex('const FormSoalModal = ({');
const modalPeriksaUraianStart = findLineIndex('const ModalPeriksaUraian = ({');
const guruViewStart = findLineIndex('const GuruView = ({');
const examRoomStart = findLineIndex('const ExamRoom = ({');
const siswaViewStart = findLineIndex('const SiswaView = ({');
const appStart = findLineIndex('const App = () => {');

// Check if all were found
const points = {
  configEnd, apiEnd, loaderStart, adminViewStart, formSoalModalStart, 
  modalPeriksaUraianStart, guruViewStart, examRoomStart, siswaViewStart, appStart
};

for (const [key, value] of Object.entries(points)) {
  if (value === -1) {
    console.error(`Could not find marker for ${key}`);
    process.exit(1);
  }
}

// We need to create directories
if (!fs.existsSync('components')) fs.mkdirSync('components');
if (!fs.existsSync('views')) fs.mkdirSync('views');

// Slices
fs.writeFileSync('config.js', lines.slice(0, configEnd).join('\n'));
fs.writeFileSync('api.js', lines.slice(configEnd, apiEnd).join('\n'));
fs.writeFileSync('components/Modal.js', lines.slice(apiEnd, loaderStart).join('\n'));
fs.writeFileSync('components/Loader.js', lines.slice(loaderStart, adminViewStart).join('\n'));
fs.writeFileSync('views/AdminView.js', lines.slice(adminViewStart, formSoalModalStart).join('\n'));
fs.writeFileSync('components/FormSoalModal.js', lines.slice(formSoalModalStart, modalPeriksaUraianStart).join('\n'));
fs.writeFileSync('components/ModalPeriksaUraian.js', lines.slice(modalPeriksaUraianStart, guruViewStart).join('\n'));
fs.writeFileSync('views/GuruView.js', lines.slice(guruViewStart, examRoomStart).join('\n'));
fs.writeFileSync('views/ExamRoom.js', lines.slice(examRoomStart, siswaViewStart).join('\n'));
fs.writeFileSync('views/SiswaView.js', lines.slice(siswaViewStart, appStart).join('\n'));
fs.writeFileSync('App.js', lines.slice(appStart).join('\n'));

console.log("Successfully split script.js into modular parts.");
