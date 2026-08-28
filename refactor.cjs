const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function refactorViews() {
  const viewsDir = path.join(srcDir, 'views');
  const files = fs.readdirSync(viewsDir);
  files.forEach(file => {
    if (file.endsWith('.jsx')) {
      const name = file.replace('.jsx', '');
      let content = fs.readFileSync(path.join(viewsDir, file), 'utf8');
      
      // prepend React import if not there
      if (!content.includes("import React")) {
        content = `import React, { useState, useEffect, useRef } from 'react';\n` + content;
      }
      
      // append export
      if (!content.includes(`export default ${name}`)) {
        content += `\nexport default ${name};\n`;
      }
      
      fs.writeFileSync(path.join(viewsDir, file), content);
    }
  });
}

function refactorComponents() {
  const compDir = path.join(srcDir, 'components');
  const files = fs.readdirSync(compDir);
  files.forEach(file => {
    if (file.endsWith('.jsx')) {
      const name = file.replace('.jsx', '');
      let content = fs.readFileSync(path.join(compDir, file), 'utf8');
      
      if (!content.includes("import React")) {
        content = `import React, { useState, useEffect, useRef } from 'react';\n` + content;
      }
      
      if (!content.includes(`export default ${name}`) && !file.includes('UI')) {
        // Only append export if it's a standard component. UI.jsx uses window.EmptyState etc.
        content += `\nexport default ${name};\n`;
      }
      
      fs.writeFileSync(path.join(compDir, file), content);
    }
  });
}

function refactorApp() {
  const appPath = path.join(srcDir, 'App.jsx');
  let content = fs.readFileSync(appPath, 'utf8');
  
  if (!content.includes("import React")) {
    const imports = `import React, { useState, useEffect, useRef } from 'react';
import AdminView from './views/AdminView';
import ExamRoom from './views/ExamRoom';
import GuruView from './views/GuruView';
import SiswaView from './views/SiswaView';
import SuperAdminView from './views/SuperAdminView';
import Modal from './components/Modal';\n\n`;
    content = imports + content;
  }
  
  // Remove ReactDOM.createRoot at the bottom
  content = content.replace(/const root = ReactDOM\.createRoot[\s\S]*/, 'export default App;\n');
  
  fs.writeFileSync(appPath, content);
}

refactorViews();
refactorComponents();
refactorApp();
console.log("Refactoring complete");
