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

  if (!fs.existsSync(process.env.SCREENSHOT_PATH)) {
      fs.mkdirSync(process.env.SCREENSHOT_PATH);
  }

  const outagesSection = await page.$(
    'body > div.layout-content.status.status-index.starter > div.container > div.unresolved-incidents'
  );
  const boundingBox = await outagesSection.boundingBox();
  boundingBox.height += 100;

  const watermarkText = `Captured on ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' })}`;
  await page.evaluate((text) => {
    const watermark = document.createElement('div');
    watermark.style.position = 'relative';
    watermark.style.top = '10px';
    watermark.style.right = '10px';
    watermark.style.fontSize = '18px';
    watermark.style.color = 'black';
    watermark.style.fontWeight = 'bold';
    watermark.style.zIndex = '9999';
    watermark.style.backgroundColor = 'rgba(220,220,220, 0.7)';
    watermark.style.padding = '4px';
    watermark.style.margin = '10px';
    watermark.textContent = text;
    document.querySelector('body > div.layout-content.status.status-index.starter > div.container > div.unresolved-incidents').prepend(watermark);
  }, watermarkText);

  const timestamp = Date.now();
  const imagePath = `${process.env.SCREENSHOT_PATH}/${timestamp}.png`;
  await page.screenshot({ path: imagePath, clip: boundingBox });
  
  console.log('Screenshot saved:', imagePath);
  await browser.close();
  console.log('Browser closed.')
}


module.exports = {
  checkOutagePage,
};
