const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertToBmp() {
    try {
        const buildDir = path.join(__dirname, '../build');

        // Convert header image (150x57)
        await sharp(path.join(buildDir, 'installer-header.png'))
            .resize(150, 57, { fit: 'fill' })
            .toFormat('bmp')
            .toFile(path.join(buildDir, 'installer-header.bmp'));

        console.log('✓ Created installer-header.bmp');

        // Convert sidebar image (164x314)
        await sharp(path.join(buildDir, 'installer-sidebar.png'))
            .resize(164, 314, { fit: 'fill' })
            .toFormat('bmp')
            .toFile(path.join(buildDir, 'installer-sidebar.bmp'));

        console.log('✓ Created installer-sidebar.bmp');

        console.log('All BMP files created successfully!');
    } catch (error) {
        console.error('Error converting to BMP:', error);
        process.exit(1);
    }
}

convertToBmp();
