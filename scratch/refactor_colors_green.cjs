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

        // Replace bg-primary with the gradient and text-on-primary
        content = content.replace(/\bbg-primary\b(?![-/])/g, 'bg-gradient-to-r from-primary to-secondary text-on-primary');
        
        // Remove text-white if it's next to bg-primary (which is now text-on-primary)
        // Since we already replaced bg-primary, we can look for the new string followed by text-white
        content = content.replace(/bg-gradient-to-r from-primary to-secondary text-on-primary\s+text-white/g, 'bg-gradient-to-r from-primary to-secondary text-on-primary');
        content = content.replace(/text-white\s+bg-gradient-to-r from-primary to-secondary text-on-primary/g, 'bg-gradient-to-r from-primary to-secondary text-on-primary');

        // Replace hover states
        content = content.replace(/\bhover:bg-primary\/90\b/g, 'hover:from-primary/90 hover:to-secondary/90');
        content = content.replace(/\bhover:bg-primary\b/g, 'hover:from-primary hover:to-secondary');
        
        // Replace selection bg
        content = content.replace(/\bselection:bg-primary\/20\b/g, 'selection:bg-primary/30');

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${filePath}`);
        }
    }
});
