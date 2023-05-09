const echarts = require('echarts');
const { getMinerStatistics, logMsg } = require('./dbFunctions');
const { JSDOM } = require('jsdom');
const { createCanvas } = require('canvas');
const fs = require('fs');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const formatDateTime = (date, dateOnly = true) => {
    // logMsg(`formatDateTime received date: ${date} and dateOnly: ${dateOnly}`);
    let retVal = "";

    retVal = new Date(date)
        .toLocaleString("en-US", { short: "numeric", timeZone: "America/los_angeles" })
    retVal = dateOnly
        ? retVal.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}:\d{1,2}:\d{1,2}) (AM|PM)/, (match, month, day, year, time, ampm) => {
            return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
        })
        : retVal.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}:\d{1,2}:\d{1,2}) (AM|PM)/, (match, month, day, year, time, ampm) => {
            return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year} ${time} ${ampm}`;
        });
    // logMsg(`formatDateTime returning: ${retVal}`)
    return retVal;
};

const aggregateDataByWorker = (data) => {
    // logMsg("Aggregating data by worker", data);
    const aggregatedData = data.reduce((acc, curr) => {
        if (!acc[curr.worker_name]) {
            acc[curr.worker_name] = {
                worker_name: curr.worker_name,
                outages: 0,
                total_downtime: 0,
            };
        }
        acc[curr.worker_name].outages += 1;
        acc[curr.worker_name].total_downtime += parseFloat(curr.outage_length);
        return acc;
    }, {});
    // logMsg("Aggregated data", aggregatedData);
    return Object.values(aggregatedData).map((worker) => { return { ...worker, total_downtime: worker.total_downtime.toFixed(2) } });
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

async function generateChart(outage) {
    // Create a virtual DOM environment for jspdf.addSvgAsImage
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        pretendToBeVisual: true, // Required for canvas
    });

    const workerData = await getWorkerData(outage);
    // logMsg("workerData= ", JSON.stringify(workerData))

    echarts.setPlatformAPI({ canvas: createCanvas });
    const canvas = createCanvas(500, 250);
    const chart = echarts.init(canvas);


    const options = getOption(workerData);
    options.backgroundColor = '#FFFFFF';
    chart.setOption(options);
    let chartImg = canvas.toDataURL();

    // Clean up globalThis variables
    echarts.dispose(chart);

    return chartImg;
};

const getTableData = (data) => {
    return data.map((entry) => ({
        worker_name: entry.worker_name,
        outage_start_datetime: entry.outage_start_datetime,
        outage_end_datetime: entry.outage_end_datetime,
        outage_length: entry.outage_length ? (entry.outage_length / 3600000).toFixed(2) : (((new Date).getTime() - entry.outage_start_datetime) / 3600000).toFixed(2),
        screenshots: entry.screenshots,
    }));
};

const getReportDates = (searchTerm) => {
    const reportPeriodStart = formatDateTime(searchTerm.dateRange.startDate);
    const reportPeriodEnd = formatDateTime(searchTerm.dateRange.endDate);
    const reportGeneratedAt = formatDateTime(Date.now(), false);

    return { reportPeriodStart, reportPeriodEnd, reportGeneratedAt };
};

const getOutageStats = (tableData) => {
    const outageCount = tableData.length;

    const totalOutageLength = tableData.reduce((acc, curr) => {
        let outageLength = parseFloat(curr.outage_length);
        if (outageLength) {
            return acc + outageLength;
        } else {
            return acc;
        }
    }, 0);

    return { outageCount, totalOutageLength };
};

const getTableLayouts = () => {
    return {
        summaryTable: {
            fillColor: function (rowIndex, node, columnIndex) {
                return (rowIndex % 2 === 0) ? '#CCCCCC' : null;
            },
            hLineWidth: function (i, node) {
                return (i === 0 || i === node.table.headerRows || i === node.table.body.length) ? 2 : 0;
            },
            vLineWidth: function (i) {
                return 0;
            },
            hLineColor: function (i) {
                return i === 1 ? 'black' : '#aaa';
            },
            paddingLeft: function (i) {
                return 5
            },
            paddingTop: function (i) {
                return 5
            },
            paddingBottom: function (i) {
                return 5
            },
            paddingRight: function (i) {
                return 5
            },
        }
    };
};

const generateFirstPage = (tableData, searchTerm) => {
    const { reportPeriodStart, reportPeriodEnd, reportGeneratedAt } = getReportDates(searchTerm);
    const aggregatedTableData = aggregateDataByWorker(tableData);
    const { outageCount, totalOutageLength } = getOutageStats(tableData);
    return(
    [
        {
            text: `Outages`,
            style: 'header'
        },
        {
            text: `${reportPeriodStart} to ${reportPeriodEnd}\nGenerated at ${reportGeneratedAt}`,
            style: 'header2'
        },
        {
            table: {
                style: 'summaryTable',
                headerRows: 1,
                widths: ['33%', '33%', '33%'],
                body: [
                    [
                        { text: 'Worker Name', style: 'tableHeader' },
                        { text: 'Outages', style: 'tableHeader' },
                        { text: 'Total Downtime', style: 'tableHeader' },
                    ],
                    ...aggregatedTableData.map((entry) => ([
                        entry.worker_name,
                        entry.outages,
                        entry.total_downtime,
                    ])),
                    ["Totals", ` ${outageCount}`, `${totalOutageLength.toFixed(2)} hrs`]
                ]
            },
            layout: 'summaryTable',
        },
    ]
    );
};

const createDD = (content) => {
    return ({
        content: content,
        footer: function (currentPage, pageCount) {
            return [
                { 
                    style: 'footer',
                    text: currentPage.toString() + ' of ' + pageCount, alignment: (currentPage % 2) ? 'left' : 'right' 
                }
            ]
        },
        styles: {
            header: {
                fontSize: 22,
                bold: true,
                margin: [0, 0, 0, 10]
            },
            header2: {
                fontSize: 14,
                bold: false,
                margin: [0, 0, 0, 10]
            },
            footer: {
                fontSize: 8,
                margin: [10, 0, 10, 8],
            },
            subheader: {
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5]
            },
            summaryTable: {
                margin: [0, 5, 0, 15],
                fontSize: 12,
            },
            tableHeader: {
                bold: true,
                fontSize: 13,
                color: '#fff',
                fillColor: '#2980ba'
            }
        }
    });
};

const generatePDF = async (data, searchTerm) => {
    try {
        const tableData = getTableData(data);
        const tableLayouts = getTableLayouts();
        
        const content = generateFirstPage(tableData, searchTerm);
        content.push([
            {
                pageBreak: 'before',
                style: 'summaryTable',
                table: {
                    headerRows: 1,
                    body: [
                        // Table headers
                        [
                            { text: 'Worker Name', style: 'tableHeader' },
                            { text: 'Outage Start', style: 'tableHeader' },
                            { text: 'Outage End', style: 'tableHeader' },
                            { text: 'Outage Length', style: 'tableHeader' },
                        ],
                        // Table data
                        ...tableData.map((outage) => ([
                            outage.worker_name,
                            formatDateTime(outage.outage_start_datetime, false),
                            formatDateTime(outage.outage_end_datetime, false),
                            outage.outage_length,
                        ])),
                    ]
                },
                layout: 'summaryTable',
            }
        ]);
        

        const docDefinition = createDD(content);

        pdfMake.tableLayouts = tableLayouts;
        const pdfDoc = pdfMake.createPdf(docDefinition);

        const pdfBlob = await new Promise((resolve, reject) => {
            pdfDoc.getBuffer((buffer) => {
                
                resolve(buffer);
            });
        });
        return pdfBlob;
        
    } catch (error) {
        logMsg(error);
    }
};

const generateDetailedPDF = async (data, searchTerm) => {
    try {
        const tableData = getTableData(data);
        const tableLayouts = getTableLayouts();
        
        const content = generateFirstPage(tableData, searchTerm);
        const chartPromises = tableData.map(async (outage, index) => {
            // logMsg(`Outage = ${JSON.stringify(outage)} and index = ${index}`);
            const chartImg = await generateChart(outage); // Replace with an appropriate implementation
            
            const outagePageContent = [
                // { text: 'Outage Details', fontSize: 16, margin: [40, 40, 0, 0], pageBreak: index === 0 ? 'after' : 'before' },
                {
                    pageBreak: 'before',
                    style: 'summaryTable',
                    table: {
                        headerRows: 1,
                        body: [
                            // Table headers
                            [
                                { text: 'Worker Name', style: 'tableHeader' },
                                { text: 'Outage Start', style: 'tableHeader' },
                                { text: 'Outage End', style: 'tableHeader' },
                                { text: 'Outage Length', style: 'tableHeader' },
                            ],
                            // Table data
                            [
                                outage.worker_name,
                                formatDateTime(outage.outage_start_datetime, false),
                                formatDateTime(outage.outage_end_datetime, false),
                                outage.outage_length,
                            ],
                        ],
                    },
                    layout: 'summaryTable',
                },
                {
                    text: `Worker Name: ${outage.worker_name}`,
                    style: 'subheader'
                },
                {
                    image: chartImg // If chartImg is a data URL for the chart image
                }
            ];         

            // Add screenshots
            const screenshotColumns = Array(4).fill().map(() => ({ stack: [], margin: [0, 0, 0, 10] }));
            for (const [index, screenshot] of outage.screenshots.entries()) {
                if (index < 8 || index > outage.screenshots.length - 8) { // limit # of screenshots to 8 for now
                    const screenshotPath = `${process.env.SCREENSHOT_PATH}/${screenshot}`;
                    const screenshotFile = fs.readFileSync(screenshotPath);
                    const base64Image = `data:image/png;base64,${screenshotFile.toString('base64')}`;
                    const screenshotImage = {
                        image: base64Image,
                        width: 110,
                        margin: [index % 4 === 0 ? 0 : 10, 5, 0, 0],
                    };


                    screenshotColumns[index % 4].stack.push(screenshotImage);
                }
            }
            outagePageContent.push({
                columns: screenshotColumns,
            });

            return outagePageContent;
        });
        const outageDetailsPages = await Promise.all(chartPromises);
        content.push(...outageDetailsPages.flat());

        const docDefinition = createDD(content);

        pdfMake.tableLayouts = tableLayouts;
        const pdfDoc = pdfMake.createPdf(docDefinition);
        const pdfBlob = await new Promise((resolve, reject) => {
            pdfDoc.getBuffer((buffer) => {
                
                resolve(buffer);
            });
        });
        return pdfBlob;
    } catch (error) {
        logMsg(error);
    }
};

module.exports = {
    generateDetailedPDF,
    generatePDF
};
