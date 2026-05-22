const puppeteer = require('puppeteer');
const { spawn, execSync } = require('child_process');
const http = require('http');

function checkServer(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

async function waitForServer(port, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await checkServer(port)) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function run() {
    const port = 8081; // Use a slightly different port to avoid conflicts
    console.log(`Starting web server on port ${port}...`);
    // Run http-server directly to avoid rebuilds and platform issues with npm scripts
    const server = spawn('npx', ['http-server', '.', '-p', port.toString(), '--cors', '-c-1'], {
        shell: true,
        stdio: 'pipe'
    });

    // Log server output for debugging
    server.stdout.on('data', (data) => console.log(`Server stdout: ${data}`));
    server.stderr.on('data', (data) => console.error(`Server stderr: ${data}`));

    let browser;
    try {
        console.log('Waiting for server to be ready...');
        const isReady = await waitForServer(port);
        if (!isReady) {
            throw new Error('Server failed to start within timeout');
        }
        console.log('Server is ready!');

        console.log('Launching browser...');
        browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        const url = `http://127.0.0.1:${port}`;
        console.log(`Navigating to ${url}...`);
        await page.goto(url);

        await page.setViewport({ width: 1280, height: 720 });

        const title = await page.title();
        console.log(`Page Title: "${title}"`);

        // Wait for a bit to let client-side JS init
        await new Promise(r => setTimeout(r, 2000));

        await page.screenshot({ path: 'web_test_screenshot.png' });
        console.log('Screenshot saved to web_test_screenshot.png');

    } catch (error) {
        console.error('Test failed:', error);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
        if (server) {
            console.log('Stopping web server...');
            try {
                // Windows-specific kill
                execSync(`taskkill /pid ${server.pid} /T /F`);
            } catch (e) {
                // Fallback or already dead
                server.kill();
            }
        }
    }
}

run();
