# BTCMiningMonitor

This is a collection of applications, a system, that will allow you to monitor your bitcoin miners that are connected to f2pool. You will be able to collect and store hashrate, up/down status and any outage details with by-the-minute accuracy. Built-in report generation capabilities allows you to reconcile downtime against any contractual SLAs you have in place with miner hosting facilities. Being able to run these reports will highlight any discrepancies between your actual downtime and the amount your being charged for hosting or the dollar amount of downtime credits you've received.

The system is implemented using multiple docker containers including mongo database, backend polling and api server, and the frontend/user application. 

The system can be run locally on Windows WSL2 on a computer that is always on and connected to the Internet, or you could deploy it to the cloud for higher reliability and easier access from multiple locations.

To start monitoring your workers you will need to generate a READ ONLY v2 api key that includes only the `mining_user/list` and `hash_rate/worker/list` permissions. These are used in the f2pool API calls found in `backend/polling.js` Your API key and some other local variables (such as file paths) will need to be added to .env files specific to your environment. 

Detailed instructions on deploying the system locally on WSL2 and to the cloud are coming soon.

To get started right away in WSL2, you could take a look at and use the dockerScript.sh to get docker installed in WSL2.
