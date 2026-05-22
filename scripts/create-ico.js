const fs = require('fs');
const path = require('path');
const toIco = require('to-ico');

async function convertToIco() {
    try {
        const inputPath = path.join(__dirname, '../build/icon.png');
        const outputPath = path.join(__dirname, '../build/icon.ico');

        const input = fs.readFileSync(inputPath);
        // to-ico has a max size of 256x256
        const ico = await toIco([input], { sizes: [16, 24, 32, 48, 64, 128, 256] });

        fs.writeFileSync(outputPath, ico);
        console.log('Successfully created icon.ico');
    } catch (error) {
        console.error('Error converting to ICO:', error);
        process.exit(1);
    }
}

convertToIco();
