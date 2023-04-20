const puppeteer = require('puppeteer');
const fs = require('fs');

async function checkOutagePage() {
  console.log('Checking outage page...');
  const browser = await puppeteer.launch({
    args: ['--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.goto('https://status.compassmining.io/');
  console.log('Page loaded.');
  const incidents = await page.$$eval(
    'body > div.layout-content.status.status-index.starter > div.container > div.unresolved-incidents > div.unresolved-incident',
    (elements) => elements.map((element) => element.outerHTML)
  );
  console.log('Incidents found:', incidents.length);
  const SCREENSHOTS_DIR = '/app/screenshots';

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR);
  }

  const outagesSection = await page.$(
    'body > div.layout-content.status.status-index.starter > div.container > div.unresolved-incidents'
  );
  const boundingBox = await outagesSection.boundingBox();

  const watermarkText = `Captured on ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`;
  await page.evaluate((text) => {
    const watermark = document.createElement('div');
    watermark.style.position = 'fixed';
    watermark.style.bottom = '10px';
    watermark.style.right = '10px';
    watermark.style.fontSize = '16px';
    watermark.style.color = 'black';
    watermark.style.fontWeight = 'bold';
    watermark.style.zIndex = '9999';
    watermark.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    watermark.style.padding = '4px';
    watermark.textContent = text;
    document.body.appendChild(watermark);
  }, watermarkText);

  const timestamp = Date.now();
  const imagePath = `${SCREENSHOTS_DIR}/${timestamp}.png`;
  await page.screenshot({ path: imagePath, clip: boundingBox });
  
  console.log('Screenshot saved:', imagePath);
  await browser.close();
  console.log('Browser closed.')
}


module.exports = {
  checkOutagePage,
};
