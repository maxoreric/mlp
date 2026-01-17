import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../dist');
const ARTIFACTS_DIR = path.resolve(__dirname, '../../../../.gemini/antigravity/brain/2b3bc5bf-39ac-440b-9cbb-9a886c444f80');

// Ensure dist exists
if (!fs.existsSync(EXTENSION_PATH)) {
    console.error('Extension path not found:', EXTENSION_PATH);
    process.exit(1);
}

// Ensure artifacts dir exists (or use current dir)
const SCREENSHOT_DIR = fs.existsSync(ARTIFACTS_DIR) ? ARTIFACTS_DIR : process.cwd();

async function runTest() {
    console.log('🤖 Launching browser with extension...');
    console.log(`📂 Extension path: ${EXTENSION_PATH}`);

    const browser = await puppeteer.launch({
        headless: false, // Extensions only work in headful mode usually
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        defaultViewport: { width: 1280, height: 800 }
    });

    try {
        const page = await browser.newPage();

        // 1. Test Web Page Translation
        console.log('🌍 Navigating to English Wikipedia...');
        await page.goto('https://en.wikipedia.org/wiki/Programmer', { waitUntil: 'networkidle0' });

        console.log('📸 Taking screenshot: before_translation.png');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'before_translation.png') });

        // Wait for Floating Ball
        console.log('⏳ Waiting for Floating Ball...');
        await page.waitForSelector('immersive-translate-ball', { timeout: 10000 });
        console.log('✅ Floating Ball found');

        // Simulate click on Floating Ball
        // Since it's in shadow DOM, we need to pierce it or use JS click
        console.log('🖱️ Clicking translation button...');
        await page.evaluate(() => {
            const ballWrapper = document.querySelector('immersive-translate-ball');
            const ball = ballWrapper.shadowRoot.querySelector('.floating-ball');
            ball.click(); // Open menu
            const menu = ballWrapper.shadowRoot.querySelector('.menu-item[data-action="translate"]');
            menu.click(); // Trigger translation
        });

        // Wait for translation results
        console.log('⏳ Waiting for translation injection...');
        // Look for data-immersive-translated attribute
        await page.waitForFunction(() => {
            return document.querySelectorAll('[data-immersive-translated]').length > 5;
        }, { timeout: 30000 });

        const count = await page.evaluate(() => document.querySelectorAll('[data-immersive-translated]').length);
        console.log(`✅ Translation injected into ${count} elements`);

        // Wait a bit for animations/rendering
        await new Promise(r => setTimeout(r, 2000));

        console.log('📸 Taking screenshot: after_translation.png');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'after_translation.png') });

        // 2. Test Options Page
        console.log('⚙️ Testing Options Page...');
        // We need the extension ID. It's tricky to get dynamically.
        // Instead, we can click "Settings" in the ball menu

        await page.evaluate(() => {
            const ballWrapper = document.querySelector('immersive-translate-ball');
            const ball = ballWrapper.shadowRoot.querySelector('.floating-ball');
            ball.click(); // Open menu
            const menu = ballWrapper.shadowRoot.querySelector('.menu-item[data-action="settings"]');
            menu.click();
        });

        // Wait for new tab
        const newTarget = await browser.waitForTarget(target => target.url().includes('options.html'));
        const optionsPage = await newTarget.page();
        await optionsPage.bringToFront();

        console.log('📸 Taking screenshot: options_page.png');
        await optionsPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'options_page.png') });

        console.log('✅ All E2E tests passed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runTest();
