const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', function(filePath) {
    if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;

        // Replace 'text-white text-white' or 'text-white' that are attached to our gradient
        content = content.replace(/bg-gradient-to-r from-primary to-secondary text-white( text-white)?/g, 'bg-gradient-to-r from-primary to-secondary text-on-primary');
        
        // Sometimes the original element had text-white somewhere else in the className string
        // We'll just globally replace 'text-white text-white' with 'text-on-primary' just in case
        content = content.replace(/text-white text-white/g, 'text-on-primary');

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${filePath}`);
        }
    }
});
