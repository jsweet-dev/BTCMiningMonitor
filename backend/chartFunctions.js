require('dotenv').config()
const echarts = require('echarts');
const fs = require('fs');
const { getMinerStatistics, getOutages, updateOneOutage } = require('./dbFunctions');
const { logMsg } = require('./logFunctions');
const sharp = require('sharp');
const path = require('path');

const getChartFilePath = (outageId) => `${process.env.CHARTS_PATH}/${outageId}.png`;

const getOption = (worker, outage = {}) => {
    let outageStartDate = null;
    let outageEndDate = null;

    if (!!outage) {
        outageStartDate = new Date(outage.outage_start_datetime);
        outageEndDate = outage.outage_end_datetime ? new Date(outage.outage_end_datetime) : 'Ongoing';
    }

    worker = worker[0];
    logMsg(`worker= ${JSON.stringify(worker)}`, 8);
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
    logMsg("Fetching worker data", 6);
    const startTime = outageInfo.outage_start_datetime - (1200000);
    const endTime = (outageInfo.outage_end_datetime || (new Date()).getTime()) + (1200000);
    const workerName = outageInfo.worker_name;

    const workerData = await getMinerStatistics(null, workerName, null, startTime, endTime, null);
    logMsg(`Worker data received: ${JSON.stringify(workerData)}`, 8);
    return workerData;
};

async function saveChartToFile(outage = null, outageId = null) {
    logMsg(`Running saveChartToFile`, 4);
    if (!outageId && !outage) {
        logMsg("No outageId provided", 6);
        return;
    }
    if (!outage) {
        logMsg(`Didn't get outage info, fetching from DB for outageId: ${outageId}`, 6);
        outage = await getOutages(null, null, outageId);
    }
    logMsg(`Outage info received: ${JSON.stringify(outage)}`, 8);
    if (chartExists(outage._id)) {
        logMsg(`Chart already exists for outage: ${outage._id}. Returning existing chart path.`, 1);
        return getChartFilePath(outage._id);
    }

    logMsg(`Fetching worker data for outage: ${outage._id}`);
    const workerData = await getWorkerData(outage);
    if (!workerData || workerData.length === 0) {
        logMsg(`No worker data found for outage: ${outage._id}. Aborting chart generation and returning placeholder.`, 1);
        return getChartFilePath('placeholder.png');
    }
    logMsg(`Received workerData`, 7); //: ${JSON.stringify(workerData)}`, 8)
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
    const chartPath = getChartFilePath(outage._id);
    try {
        logMsg(`Saving chart to ${chartPath}`, 6);
        await sharp(Buffer.from(svg), { density: 200 }).toFile(chartPath);
        return { path: chartPath, error: null };
    } catch (err) {
        logMsg(err, 1);
        const placeholderPath = getChartFilePath('placeholder.png');

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
                logMsg(`Error generating placeholder chart: ${err}`, 1);
            }
        } else {
            return { path: placeholderPath, error: err.message };
        }
        return { path: null, error: err.message };
    }
};

async function chartExists(outageId) {
    logMsg(`Running chartExists for outageId: ${outageId}`, 7);
    const outage = await getOutages(null, null, outageId);
    logMsg(`Outage info received: ${JSON.stringify(outage)}`, 7);
    const exists = outage.chart_exists;
    logMsg(`Chart exists: ${exists}`, 7);
    return exists;
}

async function chartGenerationCycle() {
    logMsg("chartGenerationCycle - Starting...", 4);
    const endTime = (new Date()).getTime() - (20 * 60 * 1000);
    const outages = await getOutages(null, endTime, null, null, null, false);
    if (!outages) {
        logMsg("No outages found", 4);
        return;
    }

    logMsg(`chartGenerationCycle - Outages: ${JSON.stringify(outages)}`, 8);
    logMsg(`chartGenerationCycle - got ${outages.length} outages`, 7)
    let updateCount = 0;
    for (let outage of outages) {
        if (outage.outage_end_datetime !== null) {
            updateCount++;
            logMsg(`chartGenerationCycle - Generating chart for outage: ${outage._id}`, 7);
            await saveChartToFile(outage)
                .then((retVal) => {
                    if(!retVal.error){
                        logMsg(`chartGenerationCycle - Chart created successfully for outage: ${outage._id}, updating chart_exists in DB`, 6);
                        updateOneOutage(outage._id, { chart_exists: true });
                    }
                });
        }
    }
    logMsg(`chartGenerationCycle - ` + (outages.length === 0 ? "No outages need charts" : updateCount + " outages updated, " + (outages.length - updateCount) + " did not qualify for chart generation"), 6);
    logMsg(`chartGenerationCycle - Finished`, 4);
}

const placeholderImagePath = path.join(__dirname, 'placeholder.png');

const fetchChart = async (outage) => {
    logMsg(`fetchChart called for outage ${outage._id}`, 6);
    logMsg(`Outage Details: ${JSON.stringify(outage)}`, 8);
    const chartFilePath = getChartFilePath(outage._id);

    if (chartExists(outage._id)) {
        logMsg(`Chart file exists, reading chart for outage ${outage._id} from filesystem`, 6);
        const chartData = fs.readFileSync(chartFilePath, 'base64');
        return `data:image/png;base64,${chartData}`;
    } else {
        try {
            logMsg(`Chart file does not exist. Starting chart creation for outage ${outage._id}`, 6);
            const chartPath = await saveChartToFile(outage);
            if (chartPath.path) {
                logMsg(`Chart created at ${chartPath.path}`, 6);
                // Got a chart or placeholder
                const chartData = fs.readFileSync(chartPath.path, 'base64');
                return `data:image/png;base64,${chartData}`;
            } else {
                //empty 5x5 png to prevent error from pdfMake
                return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC`;
            }
        } catch (error) {
            logMsg(`Could not fetch, create or substitute chart with placeholder. Error: ${error.message}`, 1);
        }
    }
};

let count = 0;
// This only needs to be used once to generate charts for past outages, 
// new outage charts will be scheduled to generate using saveChartToFile by the polling.js script
async function generateAllCharts() {
    const outages = await getOutages();
    logMsg(`outages length = ${outages.length}`, 7)
    logMsg(`outage 1 = ${outages[0]}`, 8);
    for (let outage of outages.slice(0, 10)) {
        count++;
        logMsg(`Generating chart: ${count}`, 7);
        await saveChartToFile(outage)
            .then((retVal) => {
                console.log("retVal= ", retVal);
            })
    }
    console.log("Done generating charts")
}

module.exports = {
    saveChartToFile,
    generateAllCharts,
    chartGenerationCycle,
    chartExists,
    fetchChart
} 
