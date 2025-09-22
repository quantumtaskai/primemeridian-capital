const puppeteer = require('puppeteer');
const path = require('path');

async function generateOGImage() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport to exact OG image dimensions
    await page.setViewport({
        width: 1200,
        height: 630,
        deviceScaleFactor: 2 // Higher resolution for crisp image
    });

    // Load the HTML template
    const htmlPath = path.join(__dirname, 'og-image-template.html');
    await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0'
    });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Take screenshot
    await page.screenshot({
        path: 'prime-meridian-og.png',
        type: 'png',
        fullPage: false,
        omitBackground: false
    });

    console.log('OG image generated successfully: prime-meridian-og.png');

    await browser.close();
}

generateOGImage().catch(console.error);