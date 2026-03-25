const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('/Users/disavito/Desktop/dashboard-final-5.9-main/src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    content = content.replace(/catch \(_error: any\) \{/g, 'catch (error: any) {');
    content = content.replace(/catch \(_error\) \{/g, 'catch (error) {');
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log('Reverted in', file);
    }
});
