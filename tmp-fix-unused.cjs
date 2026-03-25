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
    
    // Replace catch (error: any) with catch (_error: any) globally where suitable
    content = content.replace(/catch \(error: any\) \{/g, 'catch (_error: any) {');
    content = content.replace(/catch \(error\) \{/g, 'catch (_error) {');
    
    // Also fix any variables intentionally unused like _id or _format if needed
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log('Updated unused vars in', file);
    }
});
