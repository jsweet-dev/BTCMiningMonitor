require('dotenv').config()
const echarts = require('echarts');
const fs = require('fs');
const { getMinerStatistics, getOutages, logMsg } = require('./dbFunctions');
const sharp = require('sharp');


const getOption = (worker, outage = {}) => {
    let outageStartDate = null;
    let outageEndDate = null;

    if (!!outage) {
        outageStartDate = new Date(outage.outage_start_datetime);
        outageEndDate = outage.outage_end_datetime ? new Date(outage.outage_end_datetime) : 'Ongoing';
    }

    worker = worker[0];
    // logMsg("worker= ", JSON.stringify(worker))
    return ({
        title: {
            text: `${worker._id}` +
                `${outage
                    ? ` on ${outageStartDate.toLocaleDateString("en-US")}` +
                    `${(outageEndDate.getDate ? outageEndDate.getDate() : outageEndDate) === outageStartDate.getDate()
                        ? ''
                        : ` - ${outageEndDate.toLocaleDateString ? outageEndDate.toLocaleDateString("en-US") : outageEndDate}`}`
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
    logMsg("Fetching worker data");
    const startTime = outageInfo.outage_start_datetime - (1200000);
    const endTime = (outageInfo.outage_end_datetime||(new Date()).getTime()) + (1200000);
    const workerName = outageInfo.worker_name;

    const workerData = await getMinerStatistics(null, workerName, null, startTime, endTime, null);
    logMsg(`Got worker data: ${JSON.stringify(workerData)}`);
    return workerData;
};

async function saveChartToFile(outage = null, outageId = null) {
    logMsg(`Running saveChartToFile`);
    if (!outageId && !outage) {
        logMsg("No outageId provided");
        return;
    }
    if (!outage) {
        logMsg(`Didn't get outage info, fetching from DB for outageId: ${outageId}`);
        outage = await getOutages(null, null, outageId);
    }
    // logMsg(`Got outage info: ${JSON.stringify(outage)}`);
    const workerData = await getWorkerData(outage);
    // logMsg(`workerData: ${JSON.stringify(workerData)}`)
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
    const chartPath = `${process.env.CHARTS_DIR}/${outage._id}.png`;
    try {
        logMsg(`Saving chart to ${chartPath}`);
        await sharp(Buffer.from(svg), { density: 200 }).toFile(chartPath);
        return { path: chartPath, error: null };
    } catch (err) {
        logMsg(err);
        const placeholderPath = `${process.env.CHARTS_DIR}/placeholder.png`;
        if (!fs.existsSync(placeholderPath)) {
            try {
                placeholderSvg = `<svg width="800" height="350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                version="1.1" baseProfile="full" viewBox="0 0 800 350" style="border:1px solid black">
                <rect width="800" height="350" x="0" y="0" id="0" fill="#FFFFFF"></rect>
                <text dominant-baseline="central" text-anchor="middle"
                style="font-size:20px;font-family:sans-serif;font-weight:bold;" y="20" transform="translate(400 5)"
                fill="#464646">Chart could not be generated</text>
            </svg>`
                await sharp(Buffer.from(placeholderSvg), { density: 200 }).toFile(placeholderPath);
                return { path: placeholderPath, error: err.message };
            } catch (err) {
                console.log("Error generating placeholder chart: ", err);
            }
        } else {
            return { path: placeholderPath, error: err.message };
        }
        return { path: null, error: err.message };
    }
};

let count = 0;
// This only needs to be used once to generate charts for past outages, 
// new outage charts will be scheduled to generate using saveChartToFile by the polling.js script
async function generateCharts() {
    const outages = await getOutages();
    console.log("outages= ", outages.length)
    // console.log("outage 1= ", outages[0]);
    for (let outage of outages.slice(0, 10)) {
        count++;
        console.log("Generating chart: ", count)
        await saveChartToFile(outage)
            .then((retVal) => {
                console.log("retVal= ", retVal);
            })
    }
    console.log("Done generating charts")
}

module.exports = {
    saveChartToFile,
    generateCharts
} 
