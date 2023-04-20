const puppeteer = require('puppeteer');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { saveOutageLog, getDownWorkers } = require('../dbFunctions.js');

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
  // Save a screenshot of the page
  const SCREENSHOTS_DIR = '/home/pptruser/screenshots';

  // Create the screenshots directory if it doesn't exist
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR);
  }

  const outagesSection = await page.$(
    'body > div.layout-content.status.status-index.starter > div.container > div.unresolved-incidents'
  );
  const boundingBox = await outagesSection.boundingBox();

  const watermarkText = `Captured on ${new Date().toLocaleString()}`;
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
  // Process incidents and save the data
  
  console.log('Processing incidents...');
  const facilityCodeRegex = /\((\d+)x\)/;

  const downWorkers = await getDownWorkers();

  for (const incidentHtml of incidents) {
    const incidentDOM = new JSDOM(incidentHtml);
    const incidentTitle = incidentDOM.window.document.querySelector('.incident-title > a.actual-title');
    const facilityCodeMatch = incidentTitle.textContent.match(facilityCodeRegex);
    console.log('facilityCodeMatch', facilityCodeMatch);
    if (!facilityCodeMatch) continue;

    const facilityCode = parseInt(facilityCodeMatch[1]);
    const updates = Array.from(incidentDOM.window.document.querySelectorAll('.updates .update'));
    console.log('updates', updates)
    const latestUpdate = updates[updates.length - 1];
    const latestUpdateTimestamp = parseInt(latestUpdate.querySelector('.ago').dataset.datetimeUnix);
    
    // Check if the facility code matches any workers in a down status
    const matchingWorkers = downWorkers.filter((worker) => worker.facilityCode === facilityCode);    if (matchingWorkers.length > 0) {
      // Save the log to the database
      const outageLog = {
        timestamp,
        imagePath,
        facilityCode,
        incidentHtml,
      };
      console.log('Saving outage log:', outageLog);
      await saveOutageLog(outageLog);
    }
  }
  console.log('Finished processing incidents.');
}

module.exports = {
  checkOutagePage,
};
