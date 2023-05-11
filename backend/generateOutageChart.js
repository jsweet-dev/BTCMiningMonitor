require('dotenv').config()
const { connectDb, getDb } = require('./db');
const mongoose = require('mongoose');
const echarts = require('echarts');
const { getMinerStatistics } = require('./dbFunctions');
const sharp = require('sharp');

async function getOutages(id, workerName, miningUserName, startTime, endTime) {
    //logMsg("Getting outages");
    await connectDb('getOutages (generateOutageChart.js)');
    const db = getDb();
    //logMsg("Connected to DB for outages");
    const query = {};
    if (id) {
        query._id = { $eq: new mongoose.Types.ObjectId(id) }
    }
    if (workerName) {
        matchStage.$match.worker_name = { $regex: new RegExp(workerName), $options: 'i' };
    }
    if (miningUserName) {
        matchStage.$match.mining_user_name = { $regex: new RegExp(miningUserName), $options: 'i' };
    } if (startTime) {
        query.outage_start_datetime = { $gte: startTime };
    }
    if (endTime) {
        query.$or = [
            {
                outage_end_datetime: { $lte: endTime }
            },
            {
                outage_end_datetime: null
            }
        ];
    }

    console.log("Query: ", JSON.stringify(query));

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

    if (outages.length > 1) {
        return outages;
    } else {
        return outages[0];
    }
}

const getOption = (worker, outage = {}) => {
    let outageStartDate = null;
    let outageEndDate = null;

    if (!!outage) {
        outageStartDate = new Date(outage.outage_start_datetime);
        outageEndDate = new Date(outage.outage_end_datetime);
    }

    worker = worker[0];
    // logMsg("worker= ", JSON.stringify(worker))
    return ({
        title: {
            text: `${worker._id}` + 
                    `${outage 
                        ? ` on ${outageStartDate.toLocaleDateString("en-US")}` + 
                           `${outageEndDate.getDate() === outageStartDate.getDate() 
                                ? '' 
                                : ` - ${outageEndDate.toLocaleDateString("en-US")}`}` 
                        : ''}`,
            textStyle: {
                fontSize: 18,
                lineHeight: 22,
            },
            left: 'center',
            padding: [20, 0, 0, 0],
        },
        xAxis: {
            type: 'time',
        },
        yAxis: [
            {
                type: 'value',
                name: 'Hash Rate ( TH/s )',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: {
                    fontWeight: 'bold',
                },
                axisLabel: {
                    margin: 1,
                    formatter: (value) => `${value}`,
                },
                min: 0,
                max: 160
            },
            {
                type: 'value',
                name: 'Status',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: {
                    fontWeight: 'bold',
                },
                splitLine: {
                    show: false
                },
                axisLabel: {
                    formatter: (value) => (value === 0 ? 'Down' : value === 1 ? 'Up' : ''),
                },
            },
        ],
        series: [
            {
                data: worker.history.map((entry) => [
                    entry.timestamp,
                    entry.hashRate,
                ]),
                type: 'line',
                symbol: 'none',
                name: 'Hash Rate',
                yAxisIndex: 0,
                connectNulls: false,
                large: true,
                largeThreshold: 3000,
            },
            {
                data: worker.history.map((entry) => [entry.timestamp, entry.hashRate ? 1 : 0]),
                type: 'scatter',
                name: 'Status',
                symbolSize: 10,
                itemStyle: {
                    color: (params) => {
                        return params.data[1] === 0 ? 'red' : 'green';
                    },
                },
                yAxisIndex: 1,
                connectNulls: false,
                large: true,
                largeThreshold: 3000,
            },
        ],
    });
};

const getWorkerData = async function fetchWorkers(outageInfo) {
    // logMsg("Fetching worker data");
    const startTime = outageInfo.outage_start_datetime - (1200000);
    const endTime = outageInfo.outage_end_datetime + (1200000);
    const workerName = outageInfo.worker_name;

    const workerData = await getMinerStatistics("", workerName, "", startTime, endTime, "");

    return workerData;
};

async function saveChartToFile(outageId) {
    console.log(outageId);
    const outage = await getOutages(outageId);
    const workerData = await getWorkerData(outage);
    console.log("outage= ", JSON.stringify(outage))

    const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: 800,
        height: 320,
    });

    const options = getOption(workerData, outage);
    options.backgroundColor = '#FFFFFF';
    chart.setOption(options);

    const svg = chart.renderToSVGString();
    sharp(Buffer.from(svg), { density: 200 }).toFile(`./outage_charts/${outage._id}.png`);

    console.log(`\tChart saved to ${outage._id}.png`);
};

let count = 0;
// This only needs to be used once to generate charts for past outages, 
// new outage charts will be scheduled to generate using saveChartToFile by the polling.js script
async function generateCharts() {
    const outages = await getOutages();
    console.log("outages= ", outages.length)
    // console.log("outage 1= ", outages[0]);
    for (let outage of outages) {
        count++;
        console.log("Generating chart: ", count)
        await saveChartToFile(outage);
    }
    console.log("Done generating charts")
}

saveChartToFile("6446fed0d6285be56be0ad26");

// module.exports = {
//     saveChartToFile,
//     generateCharts  
// } 
