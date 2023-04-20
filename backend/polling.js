require('dotenv').config();
const axios = require('axios');
const { checkOutagePage } = require('./StatusScraper/outageChecker.js');
const { saveWorkerData, updateStatus, updateOutages } = require('./dbFunctions.js');

const F2POOL_API_KEY = process.env.F2POOL_API_KEY;
console.log('Starting polling at', new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
async function fetchData() {
  try {
    // Fetch mining user list
    const userListResponse = await axios.post(
      'https://api.f2pool.com/v2/mining_user/list',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'F2P-API-SECRET': F2POOL_API_KEY,
        },
      }
    );

    // console.log(userListResponse.data);

    const miningUserList = userListResponse.data.mining_user_list;

    // Fetch worker list for each mining user
    const userWorkerData = await Promise.all(
      miningUserList.map(async (user) => {
        const workerListResponse = await axios.post(
          'https://api.f2pool.com/v2/hash_rate/worker/list',
          { mining_user_name: user.mining_user_name,
            currency: 'bitcoin' },
          {
            headers: {
              'Content-Type': 'application/json',
              'F2P-API-SECRET': F2POOL_API_KEY,
            },
          }
        );

        return {
          mining_user_name: user.mining_user_name,
          workers: workerListResponse.data.workers,
        };
      })
    );

    // console.log("userWorkerData", userWorkerData);
    // console.log('Saving worker data...');
    await saveWorkerData(userWorkerData);
    // console.log('Saving status data...');
    await updateStatus(userWorkerData);
    // console.log('Saving outages data...');
    await updateOutages(userWorkerData);
    console.log('Complete. Waiting 60 seconds...');
    console.log("");

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

console.log('Checking for outages...');
checkOutagePage();
setInterval(checkOutagePage, 5 * 60 * 1000);

fetchData();
setInterval(fetchData, 60 * 1000); // Poll every minute

console.log('Finished loading polling.js');