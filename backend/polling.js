require('dotenv').config();
const axios = require('axios');
const { checkOutagePage } = require('./outageChecker.js');
const { getOutages, saveWorkerData, updateStatus, updateOutages, logMsg } = require('./dbFunctions.js');
const { chartGenerationCycle } = require('./generateOutageChart.js');

const F2POOL_API_KEY = process.env.F2POOL_API_KEY;
console.log('Starting polling at', new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
async function fetchData() {
  logMsg('Starting fetchData', 4);
  try {
    // Fetch mining user list
    logMsg('Fetching mining user list from api...', 6);
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

    logMsg(`Response received for mining users api call: ${Boolean(userListResponse.data)}`, 6);
    logMsg(`Response received: ${userListResponse.data}`, 8);

    const miningUserList = userListResponse.data.mining_user_list;

    // Fetch worker list for each mining user
    logMsg('Fetching worker list for each mining user...', 6);
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

    logMsg(`Response received for all workers: ${Boolean(userWorkerData)}`, 6);

    logMsg('Saving worker data...', 6);
    await saveWorkerData(userWorkerData);
    logMsg('Saving status data...', 6);
    await updateStatus(userWorkerData);
    logMsg('Saving outages data...', 6);
    await updateOutages(userWorkerData);
    logMsg('Fetch data and save complete. Waiting 60 seconds...', 4);

  } catch (error) {
    logMsg(`Error fetching data: ${error.message}`, 1);
  }
}

logMsg('Setting up polling intervals...', 1);
checkOutagePage();
setInterval(checkOutagePage, 5 * 60 * 1000);

fetchData();
setInterval(fetchData, 60 * 1000); // Poll every minute

chartGenerationCycle();
setInterval(chartGenerationCycle, 20 * 60 * 1000); // run cycle every 20 minutes

logMsg('Finished loading polling.js', 1);