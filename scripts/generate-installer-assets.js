const puppeteer = require('puppeteer');
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const BUILD_DIR = path.join(__dirname, '../build');
const HTML_FILE = path.join(__dirname, 'installer-assets.html');

// NSIS recommended dimensions
const SIDEBAR_WIDTH = 164;
const SIDEBAR_HEIGHT = 314;
const HEADER_WIDTH = 150;
const HEADER_HEIGHT = 57;

async function generateInstallerAssets() {
    console.log('Generating installer assets...');

    // Ensure build directory exists
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set viewport large enough for both assets
        await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });

        // Navigate to the HTML file
        const htmlUrl = `file://${HTML_FILE}`;
        await page.goto(htmlUrl, { waitUntil: 'networkidle0' });

        // Capture Sidebar
        console.log('Capturing sidebar...');
        const sidebarElement = await page.$('#sidebar');
        if (!sidebarElement) {
            throw new Error('Sidebar element (#sidebar) not found in HTML');
        }
        const sidebarPngPath = path.join(BUILD_DIR, 'installerSidebar.png');
        await sidebarElement.screenshot({ path: sidebarPngPath });

        // Capture Header
        console.log('Capturing header...');
        const headerElement = await page.$('#header');
        if (!headerElement) {
            throw new Error('Header element (#header) not found in HTML');
        }
        const headerPngPath = path.join(BUILD_DIR, 'installerHeader.png');
        await headerElement.screenshot({ path: headerPngPath });

        // Convert to 24-bit BMP using Jimp v1.x API
        console.log('Converting to 24-bit BMP...');

        // Sidebar BMP
        const sidebarImg = await Jimp.read(sidebarPngPath);
        sidebarImg.resize({ w: SIDEBAR_WIDTH, h: SIDEBAR_HEIGHT });
        await sidebarImg.write(path.join(BUILD_DIR, 'installerSidebar.bmp'));
        console.log(`  Created: build/installerSidebar.bmp (${SIDEBAR_WIDTH}x${SIDEBAR_HEIGHT})`);

        // Header BMP
        const headerImg = await Jimp.read(headerPngPath);
        headerImg.resize({ w: HEADER_WIDTH, h: HEADER_HEIGHT });
        await headerImg.write(path.join(BUILD_DIR, 'installerHeader.bmp'));
        console.log(`  Created: build/installerHeader.bmp (${HEADER_WIDTH}x${HEADER_HEIGHT})`);

        // Clean up temporary PNG files
        fs.unlinkSync(sidebarPngPath);
        fs.unlinkSync(headerPngPath);

        console.log('Installer assets generated successfully!');

    } finally {
        await browser.close();
    }
}

generateInstallerAssets().catch(err => {
    console.error('Error generating installer assets:', err);
    process.exit(1);
});
