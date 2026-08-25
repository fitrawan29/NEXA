const fs = require('fs');
let content = fs.readFileSync('components/FormSoalModal.js', 'utf-8');

// Replace initialization with a function that checks localStorage if !data
const initState = `
      const [tipe, setTipe] = useState(data ? data.tipe_soal : 'PG');
      const [pertanyaan, setPertanyaan] = useState(data ? data.pertanyaan : '');
      const [idNarasi, setIdNarasi] = useState(data && data.id_narasi ? data.id_narasi : '');
      const [gambar, setGambar] = useState(data ? data.gambar : null);
      const [bobot, setBobot] = useState(data ? data.bobot : 1);
      
      const [opsiPG, setOpsiPG] = useState(data && (data.tipe_soal==='PG' || data.tipe_soal==='PGK') ? JSON.parse(data.opsi || '["","","","",""]') : ['','','','','']);
      const [kunciPG, setKunciPG] = useState(data && data.tipe_soal==='PG' ? data.kunci_jawaban : '');
      const [kunciPGK, setKunciPGK] = useState(data && data.tipe_soal==='PGK' ? JSON.parse(data.kunci_jawaban || '[]') : []);
      const [kunciBS, setKunciBS] = useState(data && data.tipe_soal==='BS' ? data.kunci_jawaban : 'Benar');
      
      const defaultPremis = [''];
      const defaultRespon = [''];
      const [premis, setPremis] = useState(data && data.tipe_soal==='JODOH' && data.opsi ? JSON.parse(data.opsi).premis : defaultPremis);
      const [respon, setRespon] = useState(data && data.tipe_soal==='JODOH' && data.opsi ? JSON.parse(data.opsi).respon : defaultRespon);
      const [kunciJodoh, setKunciJodoh] = useState(data && data.tipe_soal==='JODOH' ? JSON.parse(data.kunci_jawaban || '{}') : {});
      
      const [kunciIsian, setKunciIsian] = useState(data && data.tipe_soal==='ISIAN' ? data.kunci_jawaban : '');`;

const newState = `
      const savedDraft = !data ? JSON.parse(localStorage.getItem('formSoalDraft') || '{}') : {};
      const [tipe, setTipe] = useState(data ? data.tipe_soal : (savedDraft.tipe || 'PG'));
      const [pertanyaan, setPertanyaan] = useState(data ? data.pertanyaan : (savedDraft.pertanyaan || ''));
      const [idNarasi, setIdNarasi] = useState(data && data.id_narasi ? data.id_narasi : (savedDraft.idNarasi || ''));
      const [gambar, setGambar] = useState(data ? data.gambar : null);
      const [bobot, setBobot] = useState(data ? data.bobot : (savedDraft.bobot || 1));
      
      const [opsiPG, setOpsiPG] = useState(data && (data.tipe_soal==='PG' || data.tipe_soal==='PGK') ? JSON.parse(data.opsi || '["","","","",""]') : (savedDraft.opsiPG || ['','','','','']));
      const [kunciPG, setKunciPG] = useState(data && data.tipe_soal==='PG' ? data.kunci_jawaban : (savedDraft.kunciPG || ''));
      const [kunciPGK, setKunciPGK] = useState(data && data.tipe_soal==='PGK' ? JSON.parse(data.kunci_jawaban || '[]') : (savedDraft.kunciPGK || []));
      const [kunciBS, setKunciBS] = useState(data && data.tipe_soal==='BS' ? data.kunci_jawaban : (savedDraft.kunciBS || 'Benar'));
      
      const defaultPremis = [''];
      const defaultRespon = [''];
      const [premis, setPremis] = useState(data && data.tipe_soal==='JODOH' && data.opsi ? JSON.parse(data.opsi).premis : (savedDraft.premis || defaultPremis));
      const [respon, setRespon] = useState(data && data.tipe_soal==='JODOH' && data.opsi ? JSON.parse(data.opsi).respon : (savedDraft.respon || defaultRespon));
      const [kunciJodoh, setKunciJodoh] = useState(data && data.tipe_soal==='JODOH' ? JSON.parse(data.kunci_jawaban || '{}') : (savedDraft.kunciJodoh || {}));
      
      const [kunciIsian, setKunciIsian] = useState(data && data.tipe_soal==='ISIAN' ? data.kunci_jawaban : (savedDraft.kunciIsian || ''));
      
      // Auto-save logic
      React.useEffect(() => {
        if (!data) {
          const draft = { tipe, pertanyaan, idNarasi, bobot, opsiPG, kunciPG, kunciPGK, kunciBS, premis, respon, kunciJodoh, kunciIsian };
          localStorage.setItem('formSoalDraft', JSON.stringify(draft));
        }
      }, [tipe, pertanyaan, idNarasi, bobot, opsiPG, kunciPG, kunciPGK, kunciBS, premis, respon, kunciJodoh, kunciIsian, data]);`;

content = content.replace(initState, newState);

// When saving successfully, clear draft
const submitLogic = `        onSave(payload);
      };`;
const newSubmitLogic = `        onSave(payload);
        if (!data) localStorage.removeItem('formSoalDraft');
      };`;
content = content.replace(submitLogic, newSubmitLogic);

fs.writeFileSync('components/FormSoalModal.js', content, 'utf-8');
console.log('Update FormSoalModal.js selesai!');
