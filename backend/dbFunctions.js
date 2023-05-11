const { connectDb, getDb, Worker, Outage, MinerStatus } = require('./db');
const fs = require('fs');
const path = require('path');

const logMsg = (msg) => {
  console.log(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " " + msg);
}

async function saveMinerStatus(minerStatus) {
  await connectDb('saveMinerStatus');
  const db = getDb();
  await db.collection('minerStatus').insertOne(minerStatus);
}

async function getMinerStatistics(host, workerName, status, startTime, endTime, miningUserName) {
  await connectDb('getMinerStatistics');
  const db = getDb();
  const matchStage = {
    $match: {},
  };
  
  if (workerName) {
    matchStage.$match.worker_name = { $regex: new RegExp(workerName), $options: 'i' };
  }
  if (status) {
    matchStage.$match['miner_status.status'] = status;
  }
  if (miningUserName) {
    matchStage.$match.mining_user_name = { $regex: new RegExp(miningUserName), $options: 'i' };
  }
  if (host) {
    matchStage.$match.host = { $regex: new RegExp(host), $options: 'i' };
  }
  const currentTime = Date.now();
  // Use startTime if provided, otherwise default to 24 hours ago
  const start = startTime ? parseInt(startTime) : currentTime - 24 * 60 * 60 * 1000;
  // Use endTime if provided, otherwise default to the current time
  const end = endTime ? parseInt(endTime) : currentTime;
  
  matchStage.$match.timestamp = { $gte: start, $lte: end };
  
  const pipeline = [
    {
      $lookup: {
        from: 'minerStatus',
        localField: 'worker_name',
        foreignField: 'worker_name',
        as: 'miner_status',
      },
    },
    {
      $unwind: {
        path: '$miner_status',
        preserveNullAndEmptyArrays: true,
      },
    },
    matchStage,
    {
      $addFields: {
        custom_sort_order: {
          $switch: {
            branches: [
              { case: { $eq: ['$miner_status.status', 'down'] }, then: 1 },
              { case: { $eq: ['$miner_status.status', 'degraded'] }, then: 2 },
              { case: { $eq: ['$miner_status.status', 'up'] }, then: 3 },
            ],
            default: 4,
          },
        },
      },
    },
    {
      $sort: {
        worker_name: 1,
        timestamp: -1,
      }
    },
    {
      $group: {
        workerName: '$worker_name',
        miningUserName: { $first: '$mining_user_name' },
        host: { $first: '$host' },
        lastShare: { $max: '$last_share_at' },
        custom_sort_order: { $first: '$custom_sort_order' },
        lastHashRate: { $first: { $divide: ['$hash_rate', 1000000000000] } },
        status: { $first: '$miner_status.status' },
        history: {
          $push: {
            timestamp: '$timestamp',
            hashRate: { $divide: ['$hash_rate', 1000000000000] },
            status: { $cond: { if: { $eq: ['$status', 0] }, then: 1, else: 0 } }
          }
        }
      }
    },
    {
      $sort: {
        custom_sort_order: 1,
        _id: 1,
      },
    },
    {
      $project: {
        custom_sort_order: 0,
      },
    },
  ];

  const statistics = await db.collection('workers').aggregate(pipeline).toArray();
  return statistics;
}

async function getOutages(startTime, endTime) {
  //logMsg("Getting outages");
  await connectDb('getOutages');
  const db = getDb();
  //logMsg("Connected to DB for outages");
  const query = { };
  if(startTime) {
    query.outage_start_datetime = { $gte: startTime };
  }
  if(endTime) {
    query.$or = [
      {
        outage_end_datetime: { $lte: endTime}
      }, 
      {
        outage_end_datetime: null
      }
    ];
  }
  // logMsg("Query: ", JSON.stringify(query));

  const pipeline = [
    {
      $match: query
    },
    {
      $addFields: {
        is_end_date_null: { $eq: ['$outage_end_datetime', null] }
      }
    },
    {
      $sort: {
        is_end_date_null: -1,
        outage_start_datetime: -1,
      }
    },
    {
      $project: {
        is_end_date_null: 0
      }
    }
  ];

  const outages = await db.collection('outages')
    .aggregate(pipeline)
    .toArray();

  const screenshotsDir = '/app/screenshots/'
  const screenshotFiles = fs.readdirSync(screenshotsDir);
  // logMsg("screenshot files: ", screenshotFiles);

// Add screenshot filenames to each outage object
  for (const outage of outages) {
    // logMsg("processing screenshots for outage: ", outage.outage_start_datetime);
    const outageStart = outage.outage_start_datetime;
    const outageEnd = outage.outage_end_datetime ? outage.outage_end_datetime : new Date().getTime();
    // logMsg(`outageStart: ${outageStart}, outageEnd: ${outageEnd}`);
    const outageScreenshots = screenshotFiles.filter(file => {
      const timestamp = parseInt(path.basename(file, '.png'));
      return timestamp >= outageStart && timestamp <= outageEnd;
    });
    // logMsg("outageScreenshots: ", outageScreenshots);
    outage.screenshots = outageScreenshots;
  }

  // logMsg("Outages: ", outages);
  return outages;
}

async function getStatus(statusValue) {
  if (statusValue === 0) {
    return "down";
  } else if (statusValue >= 1 && statusValue <= 50) {
    return "degraded";
  } else {
    return "up";
  }
}

async function updateStatus(userWorkerData) {
  await connectDb('updateStatus');
  const db = getDb();

  for (const user of userWorkerData) {
    if(!user.workers) continue;
    for (const worker of user.workers) {
      const workerStatus = {
        worker_name: worker.hash_rate_info.name,
        status: await getStatus(worker.hash_rate_info.hash_rate),
      };
      await db.collection('minerStatus').updateOne(
        { worker_name: workerStatus.worker_name },
        { $set: workerStatus },
        { upsert: true }
      );
    }
  }
}

function getMiningUserName(worker_name) {
  if (/^\d/.test(worker_name)) {
    return process.env.MINING_USER_NAME_1; 
  } else {
    return process.env.MINING_USER_NAME_2; 
  }
}

async function updateOutages(userWorkerData) {
  await connectDb('saveWorkerData');

  for (const user of userWorkerData) {
    if (!user.workers) continue;
    for (const worker of user.workers) {
      const worker_name = worker.hash_rate_info.name;
      const currentStatus = await getStatus(worker.hash_rate_info.hash_rate);
      const currentTime = Date.now();

      if (currentStatus === 'down') {
        const existingOutage = await Outage.findOne({
          worker_name: worker_name,
          outage_end_datetime: null,
        });

        if (!existingOutage) {
          const newOutage = new Outage({
            worker_name: worker_name,
            outage_start_datetime: currentTime,
            outage_end_datetime: null,
            outage_length: null,
            mining_user_name: getMiningUserName(worker_name), //If you don't have more than one mining user, you can statically assign the string, rather than calling the function
          });
          await newOutage.save();
        }
      } else {
        const ongoingOutage = await Outage.findOne({
          worker_name: worker_name,
          outage_end_datetime: null,
        });

        if (ongoingOutage) { //miner is up now, but an ongoing outage was found and needs to be updated
          const outageLength = currentTime - ongoingOutage.outage_start_datetime;
          await Outage.updateOne(
            { _id: ongoingOutage._id },
            {
              $set: {
                outage_end_datetime: currentTime,
                outage_length: outageLength,
              },
            }
          );
        }
      }
    }
  }
}


// async function updateOutages(userWorkerData) {
//   await connectDb('updateOutages');
//   const db = getDb();

//   for (const user of userWorkerData) {
//     if(!user.workers) continue;
//     for (const worker of user.workers) {
//       const worker_name = worker.hash_rate_info.name;
//       const currentStatus = await getStatus(worker.hash_rate_info.hash_rate);
//       const currentTime = Date.now();

//       if (currentStatus === "down") {        
//         const existingOutage = await db.collection('outages').findOne({
//         worker_name: worker_name,
//         outage_end_datetime: null,
//       });

//       if (!existingOutage) {
//         const newOutage = {
//           worker_name: worker_name,
//           outage_start_datetime: currentTime,
//           outage_end_datetime: null,
//           outage_length: null,
//         };
//         await db.collection('outages').insertOne(newOutage);
//       }
//     } else {
//       const ongoingOutage = await db.collection('outages').findOne({
//         worker_name: worker_name,
//         outage_end_datetime: null,
//       });

//       if (ongoingOutage) {
//         const outageLength = currentTime - ongoingOutage.outage_start_datetime;
//         await db.collection('outages').updateOne(
//           { _id: ongoingOutage._id },
//           {
//             $set: {
//               outage_end_datetime: currentTime,
//               outage_length: outageLength,
//             },
//           }
//         );
//       }
//     }
//   }
// }
// }

async function saveWorkerData(workerData) {
  await connectDb('saveWorkerData');

  // logMsg('Saving worker data:', workerData);
    const promises = workerData.map(async (user) => {
      const { workers, ...userData } = user;
      if(!workers) return;
      return Promise.all(
          workers.map((worker) => {
            return (
                new Worker(
                  // { worker_name: worker.hash_rate_info.name },
                  {
                    mining_user_name: userData.mining_user_name,
                    worker_name: worker.hash_rate_info.name,
                    last_share_at: worker.last_share_at,
                    status: worker.status, //0 === Online, 1 === Offline, 2 === Expired
                    host: worker.host,
                    hash_rate: worker.hash_rate_info.hash_rate,
                    timestamp: Date.now(),
                  }
                ).save()
            );
          }
        )
      );
    });
    
    const event = new Date(Date.now());
    await Promise.all(promises)
    .then(logMsg("Saving worker data"))
    .catch((err) => logMsg(`Encountered an error saving worker data: ${err}`));
}

module.exports = { 
  saveMinerStatus, 
  getMinerStatistics, 
  saveWorkerData, 
  updateStatus, 
  updateOutages, 
  getOutages,
  logMsg 
};
