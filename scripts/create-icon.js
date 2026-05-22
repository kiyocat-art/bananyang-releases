const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputPng = path.join(__dirname, '../assets/icon.png');
const outputDir = path.join(__dirname, '../build');
const outputPngPath = path.join(outputDir, 'icon.png');
const outputIcoPath = path.join(outputDir, 'icon.ico');
const outputIcnsPath = path.join(outputDir, 'icon.icns');

/**
 * Builds an ICO file that stores every entry as raw PNG data (PNG-in-ICO).
 * Windows Vista+ reads PNG entries natively — no BMP conversion, no quality loss.
 * Width/height byte = 0 signals "256 or larger" per ICO spec; Windows reads
 * actual dimensions from the embedded PNG header.
 */
function buildIcoFromPngBuffers(pngBuffers) {
    const count = pngBuffers.length;
    const HEADER_SIZE = 6;        // ICONDIR
    const ENTRY_SIZE  = 16;       // ICONDIRENTRY × count
    const dirSize     = HEADER_SIZE + count * ENTRY_SIZE;

    // Pre-calculate offsets
    const offsets = [];
    let offset = dirSize;
    for (const buf of pngBuffers) {
        offsets.push(offset);
        offset += buf.length;
    }

    const ico = Buffer.alloc(offset);

    // ICONDIR
    ico.writeUInt16LE(0, 0);      // Reserved
    ico.writeUInt16LE(1, 2);      // Type: 1 = ICO
    ico.writeUInt16LE(count, 4);  // Number of images

    // ICONDIRENTRY for each PNG buffer
    for (let i = 0; i < count; i++) {
        const buf = pngBuffers[i];
        const base = HEADER_SIZE + i * ENTRY_SIZE;

        // Read actual pixel dimensions from PNG IHDR (bytes 16-23)
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);

        ico.writeUInt8(w >= 256 ? 0 : w,  base + 0);  // width  (0 = 256)
        ico.writeUInt8(h >= 256 ? 0 : h,  base + 1);  // height (0 = 256)
        ico.writeUInt8(0,  base + 2);                   // color count
        ico.writeUInt8(0,  base + 3);                   // reserved
        ico.writeUInt16LE(1,  base + 4);                // planes
        ico.writeUInt16LE(32, base + 6);                // bit depth
        ico.writeUInt32LE(buf.length,   base + 8);      // data size
        ico.writeUInt32LE(offsets[i],   base + 12);     // data offset
    }

    // Append PNG data blobs
    for (let i = 0; i < count; i++) {
        pngBuffers[i].copy(ico, offsets[i]);
    }

    return ico;
}

async function generateIcon() {
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // ── 1. build/icon.png (512 × 512) for electron-builder / Linux ──────
        await sharp(inputPng)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 9 })
            .toFile(outputPngPath);

        console.log('✓ icon.png (512×512)');

        // ── 2. build/icon.ico — PNG-in-ICO, all standard Windows sizes ───────
        // Include 512px entry so Windows 200% DPI picks the sharpest frame.
        const icoSizes = [16, 24, 32, 40, 48, 64, 96, 128, 256, 512];

        const pngBuffers = await Promise.all(
            icoSizes.map(size =>
                sharp(inputPng)
                    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png({ compressionLevel: 9 })
                    .toBuffer()
            )
        );

        const icoBuffer = buildIcoFromPngBuffers(pngBuffers);
        fs.writeFileSync(outputIcoPath, icoBuffer);

        console.log(`✓ icon.ico  (PNG-in-ICO, ${icoSizes.join('/')})` );

        // ── 3. build/icon.icns for macOS ─────────────────────────────────────
        await generateIcns();

    } catch (error) {
        console.error('Error generating icon:', error);
        process.exit(1);
    }
}

async function generateIcns() {
    if (process.platform === 'darwin') {
        await generateIcnsWithIconutil();
        return;
    }

    try {
        const png2icons = require('png2icons');
        const input = fs.readFileSync(inputPng);
        const icnsBuffer = png2icons.createICNS(input, png2icons.BILINEAR, 0);
        if (icnsBuffer) {
            fs.writeFileSync(outputIcnsPath, icnsBuffer);
            console.log('✓ icon.icns (png2icons)');
        } else {
            throw new Error('png2icons returned null buffer');
        }
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            console.warn('⚠  png2icons not installed. Run: npm install --save-dev png2icons');
        } else {
            console.warn('⚠  Failed to generate .icns:', e.message);
        }
    }
}

async function generateIcnsWithIconutil() {
    const iconsetDir = path.join(outputDir, 'icon.iconset');

    try {
        if (!fs.existsSync(iconsetDir)) {
            fs.mkdirSync(iconsetDir, { recursive: true });
        }

        const iconsetSizes = [
            { size: 16,   suffix: 'icon_16x16' },
            { size: 32,   suffix: 'icon_16x16@2x' },
            { size: 32,   suffix: 'icon_32x32' },
            { size: 64,   suffix: 'icon_32x32@2x' },
            { size: 128,  suffix: 'icon_128x128' },
            { size: 256,  suffix: 'icon_128x128@2x' },
            { size: 256,  suffix: 'icon_256x256' },
            { size: 512,  suffix: 'icon_256x256@2x' },
            { size: 512,  suffix: 'icon_512x512' },
            { size: 1024, suffix: 'icon_512x512@2x' },
        ];

        await Promise.all(
            iconsetSizes.map(({ size, suffix }) =>
                sharp(inputPng)
                    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png({ compressionLevel: 9 })
                    .toFile(path.join(iconsetDir, `${suffix}.png`))
            )
        );

        execSync(`iconutil -c icns "${iconsetDir}" -o "${outputIcnsPath}"`);
        fs.rmSync(iconsetDir, { recursive: true, force: true });
        console.log('✓ icon.icns (iconutil)');
    } catch (e) {
        console.warn('⚠  iconutil failed:', e.message);
        if (fs.existsSync(iconsetDir)) {
            fs.rmSync(iconsetDir, { recursive: true, force: true });
        }
    }
}

generateIcon();
