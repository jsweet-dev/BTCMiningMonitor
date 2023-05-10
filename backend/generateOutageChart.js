require('dotenv').config()
const { connectDb, getDb } = require('./db');
const echarts = require('echarts');
const { getMinerStatistics } = require('./dbFunctions');
const sharp = require('sharp');

async function getOutages(startTime, endTime) {
    //logMsg("Getting outages");
    await connectDb('getOutages2');
    const db = getDb();
    //logMsg("Connected to DB for outages");
    const query = {};
    if (startTime) {
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
    return outages;
}

const testOutage = {
    "_id": "6458f46100eebf943ea31d75",
    "worker_name": "sm2",
    "outage_start_datetime": 1683551329848,
    "outage_end_datetime": 1683552410079,
    "outage_length": 1080231,
    "mining_user_name": "et3eo7m00nfi",
    "__v": 0,
    "screenshots": ["1683551570407.png", "1683551870286.png", "1683552170287.png"]
};


const getOption = (worker) => {
    worker = worker[0];
    // logMsg("worker= ", JSON.stringify(worker))
    return ({
        title: {
            text: `${worker._id}`,
            left: 'center',
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
    const startTime = outageInfo.outage_start_datetime - (outageInfo.outage_start_datetime * 0.000001);
    const endTime = outageInfo.outage_end_datetime + (outageInfo.outage_end_datetime * 0.000001);
    const workerName = outageInfo.worker_name;

    const workerData = await getMinerStatistics("", workerName, "", startTime, endTime, "");

    return workerData;
};

//svg way:
async function saveChartToFile(outage) {
    const workerData = await getWorkerData(outage);
    // logMsg("workerData= ", JSON.stringify(workerData))

    const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: 600,
        height: 200,
    });

    const options = getOption(workerData);
    options.backgroundColor = '#FFFFFF';
    chart.setOption(options);

    const svg = chart.renderToSVGString();

    sharp(Buffer.from(svg), { density: 200 }).toFile(`./outage_charts/${outage._id}.png`);

    console.log(`Chart saved to ${outage._id}.png`);
};

let count = 0;
async function generateCharts() {
    const outages = await getOutages();
    console.log("outages= ", outages.length)
    for (let outage of outages) {
        count++;
        console.log("Generating charts: ", count)
        await saveChartToFile(outage);
    }
    console.log("Done generating charts")
}

generateCharts();


// for (let outage of outages) {
//     saveChartToFile(outage);
// }

// module.exports = saveChartToFile;