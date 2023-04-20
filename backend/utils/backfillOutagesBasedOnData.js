const mongoose = require('mongoose');

const dbName = 'miner_monitoring';

async function backfillOutages() {
  const client = await mongoose.connect('mongodb://root:rootpassword@localhost:27017/miner_monitoring?authSource=admin');
  try {
    const db = mongoose.connection;
    console.log("Connected to MongoDB");
    const workers = await db.collection('workers').find().toArray();

    const workerOutageMap = new Map();

    for (const worker of workers) {
      console.log("Building map: ", worker.worker_name);
      const workerName = worker.worker_name;
      const hashRate = worker.hash_rate;
      const timestamp = worker.timestamp;

      if (!workerOutageMap.has(workerName)) {
        workerOutageMap.set(workerName, []);
      }

      workerOutageMap.get(workerName).push({ hashRate, timestamp });
    }

    for (const [workerName, records] of workerOutageMap.entries()) {
      console.log("Processing worker: ", workerName);
      let ongoingOutage = null;

      for (const record of records) {
        const currentStatus = record.hashRate === 0 ? 'down' : 'up';
        const currentTime = record.timestamp;

        if (currentStatus === 'down' && !ongoingOutage) {
          ongoingOutage = {
            worker_name: workerName,
            outage_start_datetime: currentTime,
            outage_end_datetime: null,
            outage_length: null,
          };
        } else if (currentStatus === 'up' && ongoingOutage) {
          const outageLength = currentTime - ongoingOutage.outage_start_datetime;
          ongoingOutage.outage_end_datetime = currentTime;
          ongoingOutage.outage_length = outageLength;

          const existingOutage = await db.collection('outages').findOne({
            worker_name: workerName,
            outage_start_datetime: ongoingOutage.outage_start_datetime,
          });

          if (!existingOutage) {
            await db.collection('outages').insertOne(ongoingOutage);
          }

          ongoingOutage = null;
        }
      }
      console.log("finished for loop: ", workerName);

      if (ongoingOutage) {
        const existingOutage = await db.collection('outages').findOne({
          worker_name: workerName,
          outage_start_datetime: ongoingOutage.outage_start_datetime,
        });

        if (!existingOutage) {
          await db.collection('outages').insertOne(ongoingOutage);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

backfillOutages();
