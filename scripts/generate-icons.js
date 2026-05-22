const fs = require('fs');
const path = require('path');

const icons = [
    'google_ai_studio_icon.png',
    'vertex_ai_icon.png'
];

const outPath = path.join(__dirname, '../src/assets/icons.ts');
let content = '';

icons.forEach(icon => {
    const filePath = path.join(__dirname, '../src/assets/images', icon);
    if (fs.existsSync(filePath)) {
        const b64 = fs.readFileSync(filePath, 'base64');
        const varName = icon.replace('.png', '').replace(/_/g, '').toUpperCase();
        content += `export const ${varName}_ICON = 'data:image/png;base64,${b64}';\n`;
    } else {
        console.error(`File not found: ${filePath}`);
    }
});

fs.writeFileSync(outPath, content);
console.log('Icons generated at ' + outPath);
