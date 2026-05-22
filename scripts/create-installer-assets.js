/**
 * Create high-quality installer assets
 * - Uses Sharp for high-quality image processing
 * - Uses Jimp for 24-bit BMP conversion
 * - Dark gray background (#333333)
 * - Logo centered
 */
const sharp = require('sharp');
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const BUILD_DIR = path.join(__dirname, '../build');
const LOGO_PATH = path.join(__dirname, '../assets/installer-logo.jpg');

// NSIS dimensions
const SIDEBAR_WIDTH = 164;
const SIDEBAR_HEIGHT = 314;
const HEADER_WIDTH = 150;
const HEADER_HEIGHT = 57;

// Dark gray background color matching the reference
const BG_COLOR = { r: 51, g: 51, b: 51 }; // #333333

async function createInstallerAssets() {
    console.log('Creating installer assets...');

    // Ensure build directory exists
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
    }

    // Check if logo exists
    if (!fs.existsSync(LOGO_PATH)) {
        throw new Error(`Logo file not found: ${LOGO_PATH}`);
    }

    // Get logo dimensions
    const logoMeta = await sharp(LOGO_PATH).metadata();
    console.log(`Logo dimensions: ${logoMeta.width}x${logoMeta.height}`);

    // --- Create Sidebar (164x314) ---
    console.log('Creating sidebar...');

    // Calculate logo size to fit within sidebar (with padding)
    const sidebarPadding = 12;
    const maxLogoWidth = SIDEBAR_WIDTH - (sidebarPadding * 2);
    const maxLogoHeight = SIDEBAR_HEIGHT - (sidebarPadding * 2);

    // Resize logo maintaining aspect ratio
    const logoForSidebar = await sharp(LOGO_PATH)
        .resize(maxLogoWidth, maxLogoHeight, {
            fit: 'inside',
            withoutEnlargement: false
        })
        .toBuffer();

    const resizedLogoMeta = await sharp(logoForSidebar).metadata();
    const logoLeft = Math.floor((SIDEBAR_WIDTH - resizedLogoMeta.width) / 2);
    const logoTop = Math.floor((SIDEBAR_HEIGHT - resizedLogoMeta.height) / 2);

    // Create sidebar with dark gray background and centered logo (output as PNG)
    const sidebarPngPath = path.join(BUILD_DIR, 'sidebar_temp.png');
    await sharp({
        create: {
            width: SIDEBAR_WIDTH,
            height: SIDEBAR_HEIGHT,
            channels: 3,
            background: BG_COLOR
        }
    })
        .composite([
            {
                input: logoForSidebar,
                left: logoLeft,
                top: logoTop
            }
        ])
        .removeAlpha()
        .png()
        .toFile(sidebarPngPath);

    // Convert to BMP using Jimp
    const sidebarImg = await Jimp.read(sidebarPngPath);
    await sidebarImg.write(path.join(BUILD_DIR, 'installerSidebar.bmp'));
    fs.unlinkSync(sidebarPngPath);
    console.log(`  Created: build/installerSidebar.bmp (${SIDEBAR_WIDTH}x${SIDEBAR_HEIGHT})`);

    // --- Create Header (150x57) ---
    console.log('Creating header...');

    // Simple dark gray header
    const headerPngPath = path.join(BUILD_DIR, 'header_temp.png');
    await sharp({
        create: {
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT,
            channels: 3,
            background: BG_COLOR
        }
    })
        .removeAlpha()
        .png()
        .toFile(headerPngPath);

    // Convert to BMP using Jimp
    const headerImg = await Jimp.read(headerPngPath);
    await headerImg.write(path.join(BUILD_DIR, 'installerHeader.bmp'));
    fs.unlinkSync(headerPngPath);
    console.log(`  Created: build/installerHeader.bmp (${HEADER_WIDTH}x${HEADER_HEIGHT})`);

    console.log('Installer assets created successfully!');
}

createInstallerAssets().catch(err => {
    console.error('Error creating installer assets:', err);
    process.exit(1);
});
