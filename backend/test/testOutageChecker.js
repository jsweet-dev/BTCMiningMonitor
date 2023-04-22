const puppeteer = require('puppeteer');
const fs = require('fs');

const chromiumArgs = [
  '--no-sandbox',
   '--single-process',
   '--no-zygote',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--no-first-run',
  //`--window-size=${options.width || 1280},${options.height || 800}`,
  '--window-position=0,0',
  '--ignore-certificate-errors',
  '--ignore-certificate-errors-skip-list',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-notifications',
  '--disable-extensions',
  '--force-color-profile=srgb',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-component-extensions-with-background-pages',
  '--disable-features=TranslateUI,BlinkGenPropertyTrees,IsolateOrigins,site-per-process',
  '--disable-ipc-flooding-protection',
  '--disable-renderer-backgrounding',
  '--enable-features=NetworkService,NetworkServiceInProcess'
]

async function checkOutagePage() {
  console.log('Checking outage page...');
  const browser = await puppeteer.launch({
    headless: true,
    args: chromiumArgs,
  });
  try {
    try {
      const page = await browser.newPage();
      await page.goto('https://status.compassmining.io/');
      console.log('Page loaded.');
      const incidents = await page.$$eval(
        'body > div.layout-content.status.status-index.starter > div.container > div.unresolved-incidents > div.unresolved-incident',
        (elements) => elements.map((element) => element.outerHTML)
      );
      console.log('Incidents found:', incidents.length);
    
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
      const imagePath = `./${timestamp}.png`;
      await page.screenshot({ path: imagePath, clip: boundingBox });
      
      console.log('Screenshot saved:', imagePath);
      await page.close();
    } catch (error) {
      if(!!page) await page.close();
      console.error(error);
    }
  } finally {
    await browser.close();
    browser.disconnect();
    console.log('Browser closed.')
  }
}



checkOutagePage();