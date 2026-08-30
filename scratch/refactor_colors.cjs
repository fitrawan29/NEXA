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

        // Replace bg-primary with the gradient
        // Note: some elements have text-white or text-on-primary already. 
        content = content.replace(/\bbg-primary\b(?![-/])/g, 'bg-gradient-to-r from-primary to-secondary text-white');
        
        // Replace bg-primary/90 hover states
        content = content.replace(/\bhover:bg-primary\/90\b/g, 'hover:from-primary/90 hover:to-secondary/90');
        content = content.replace(/\bhover:bg-primary\b/g, 'hover:from-primary hover:to-secondary');
        
        // Replace selection bg
        content = content.replace(/\bselection:bg-primary\/20\b/g, 'selection:bg-primary/30');

        // Note: for bg-primary/10 or bg-primary/20, they might not look good as gradients, so we'll leave them as solid primary (which is now pastel purple).
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${filePath}`);
        }
    }
});
