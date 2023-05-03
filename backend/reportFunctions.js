//TODO: Remove unused imports once function cleanup is complete
const echarts = require('echarts');
const { getMinerStatistics } = require('./dbFunctions');
const { JSDOM } = require('jsdom');
const { Canvas, createCanvas } = require('canvas');
const canvg = require('canvg');
const { DOMParser } = require('xmldom');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const blobStream = require('blob-stream');
const PdfTable = require('pdfkit-table');
const { PassThrough } = require('stream');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const generatePdfWrapper = async (data, searchTerm) => {
    const { jsPDF } = await import('jspdf/dist/jspdf.node.js');
    await import('jspdf-autotable');

    return generatePDF(data, searchTerm, jsPDF);
};

const generateDetailedPdfWrapper = async (data, searchTerm) => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    return generateDetailedPDF(data, searchTerm, jsPDF);
};

const aggregateDataByWorker = (data) => {
    // console.log("Aggregating data by worker", data);
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
    // console.log("Aggregated data", aggregatedData);
    return Object.values(aggregatedData).map((worker) => { return { ...worker, total_downtime: worker.total_downtime.toFixed(2) } });
};

//TODO: Update this to use pdfmake, update frontend to offload pdf generation to backend
const generatePDF = async (data, searchTerm, jsPDF) => {
    // console.log("Generating PDF");
    // console.log(`Received: searchTerm: ${JSON.stringify(searchTerm)} and ${data.length} outages`);
    const doc = new jsPDF('p', 'pt');
    // console.log("Created PDF object");
    const currentTime = new Date();
    const reportPeriodStart = new Date(searchTerm.dateRange.startDate)
        .toLocaleDateString("en-US", { short: "numeric", timeZone: "America/los_angeles" })
        .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, (match, month, day, year) => {
            return `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        });
    const reportPeriodEnd = new Date(searchTerm.dateRange.endDate)
        .toLocaleDateString("en-US", { short: "numeric", timeZone: "America/los_angeles" })
        .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, (match, month, day, year) => {
            return `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        })
    const reportGeneratedAt = currentTime.toLocaleString("en-US", { timeZone: "America/los_angeles" })
        .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}:\d{1,2}:\d{1,2}) (AM|PM)/, (match, month, day, year, time, ampm) => {
            return `${month.padStart(2, '0')}-${day.padStart(2, '0')}-${year} ${time} ${ampm}`;
        });

    // Set PDF metadata
    // console.log("Setting PDF metadata");
    doc.setProperties({
        title: 'Outage Details',
        subject: `Outage Details ${reportPeriodStart} to ${reportPeriodEnd} as of ${reportGeneratedAt}`,
    });

    // Add a title to the PDF
    doc.setFontSize(22);
    doc.text(`Outages`, 40, 50);
    doc.setFontSize(14);
    doc.text(`${reportPeriodStart} to ${reportPeriodEnd}`, 40, 70);
    doc.text(`Generated at ${reportGeneratedAt}`, 40, 90);

    // Define the table columns
    const columns = [
        { header: 'Worker Name', dataKey: 'worker_name' },
        { header: 'Outage Start', dataKey: 'outage_start_datetime' },
        { header: 'Outage End', dataKey: 'outage_end_datetime' },
        { header: 'Outage Length', dataKey: 'outage_length' },
    ];

    const aggregatedColumns = [
        { header: 'Worker Name', dataKey: 'worker_name' },
        { header: 'Outages', dataKey: 'outages' },
        { header: 'Total Downtime', dataKey: 'total_downtime' },
    ];

    // Format the data for the table
    const tableData = data.map((entry) => ({
        worker_name: entry.worker_name,
        outage_start_datetime: new Date(entry.outage_start_datetime).toLocaleString(),
        outage_end_datetime: entry.outage_end_datetime ? new Date(entry.outage_end_datetime).toLocaleString() : 'Ongoing',
        outage_length: entry.outage_length ? (entry.outage_length / 3600000).toFixed(2) : ((currentTime.getTime() - entry.outage_start_datetime) / 3600000).toFixed(2),
    }));

    // Calculate totals
    const outageCount = tableData.length;
    const totalOutageLength = tableData.reduce((acc, curr) => {
        let outageLength = parseFloat(curr.outage_length);
        if (outageLength) {
            return acc + outageLength;
        } else {
            return acc;
        }
    }, 0);

    const aggregatedTableData = aggregateDataByWorker(tableData);

    console.log("Adding tables to PDF");

    doc.autoTable({
        startY: 100,
        columns: aggregatedColumns,
        body: aggregatedTableData,
        didParseCell: (data) => {
            if (data.row.index === aggregatedTableData.length - 1) {
                data.row.pageBreak = 'avoid'; // Keep the last row on the same page
            }
        },
        didDrawCell: (data) => {
            if (data.row.index === aggregatedTableData.length - 1 && data.cell.section === 'body') {
                // Footer: totals
                doc.setFontSize(12);
                doc.text(`Total Outages: ${outageCount} \t\tTotal Outage Length: ${totalOutageLength.toFixed(2)} hours`, data.settings.margin.left, data.cell.y + data.cell.height + 15);
            }
        },
    });

    const newStartY = doc.autoTable.previous.finalY + 60;

    doc.text(`Outage Details`, 40, newStartY);

    // Add the table to the PDF
    doc.autoTable({
        startY: newStartY + 10,
        columns,
        body: tableData,
        didParseCell: (data) => {
            if (data.row.index === tableData.length - 1) {
                data.row.pageBreak = 'avoid'; // Keep the last row on the same page
            }
        },
        didDrawCell: (data) => {
            if (data.row.index === tableData.length - 1 && data.cell.section === 'body') {
                // Footer: totals
                doc.setFontSize(12);
                doc.text(`Total Outages: ${outageCount}`, data.settings.margin.left, data.cell.y + data.cell.height + 15);
                doc.text(`Total Outage Length: ${totalOutageLength.toFixed(2)} hours`, data.settings.margin.left, data.cell.y + data.cell.height + 30);
            }
        },
        // didDrawPage: (data) => {
        //     if (doc.internal.getNumberOfPages() === data.pageNumber) {
        //         console.log(`The current page is ${data.pageNumber} and the total number of pages is ${doc.internal.getNumberOfPages()} `);
        //         // Footer: totals
        //         doc.setFontSize(12);
        //         doc.text(`Total Outages: ${outageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 30);
        //         doc.text(`Total Outage Length: ${totalOutageLength.toFixed(2)} hours`, data.settings.margin.left, doc.internal.pageSize.height - 15);
        //     }
        // },
    });

    // Save the PDF
    console.log("Saving PDF");
    return doc.output('datauristring');
};

const getOption = (worker) => {
    worker = worker[0];
    // console.log("worker= ", JSON.stringify(worker))
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
    // console.log("Fetching worker data");
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
    // console.log("workerData= ", JSON.stringify(workerData))

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

const formatDateTime = (date, dateOnly = true) => {
    // console.log(`formatDateTime received date: ${date} and dateOnly: ${dateOnly}`);
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
    // console.log(`formatDateTime returning: ${retVal}`)
    return retVal;
};

//This is the currently used report
//TODO: cleanup and rename once confirmed that this is final
const generateDetailedPDF2 = async (data, searchTerm) => {
    try {
        console.log("Generating PDF");

        const reportPeriodStart = formatDateTime(searchTerm.dateRange.startDate);
        const reportPeriodEnd = formatDateTime(searchTerm.dateRange.endDate);
        const reportGeneratedAt = formatDateTime(Date.now(), false);

        const tableData = data.map((entry) => ({
            worker_name: entry.worker_name,
            outage_start_datetime: entry.outage_start_datetime,
            outage_end_datetime: entry.outage_end_datetime,
            outage_length: entry.outage_length ? (entry.outage_length / 3600000).toFixed(2) : (((new Date).getTime() - entry.outage_start_datetime) / 3600000).toFixed(2),
            screenshots: entry.screenshots,
        }));

        // Calculate totals
        const outageCount = tableData.length;

        const totalOutageLength = tableData.reduce((acc, curr) => {
            let outageLength = parseFloat(curr.outage_length);
            if (outageLength) {
                return acc + outageLength;
            } else {
                return acc;
            }
        }, 0);

        const aggregatedTableData = aggregateDataByWorker(tableData);
        console.log(aggregatedTableData);

        const content = [
            {
                text: `Outages\n${reportPeriodStart} to ${reportPeriodEnd}\nGenerated at ${reportGeneratedAt}`,
                style: 'header'
            },
            {
                table: {
                    headerRows: 1,
                    widths: ['auto', 'auto', 'auto'],
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
                    ]
                }
            },
            `Total Outages: ${outageCount}\nTotal Downtime: ${totalOutageLength.toFixed(2)} hours`,
        ];

        const chartPromises = tableData.map(async (outage, index) => {
            // console.log(`Outage = ${JSON.stringify(outage)} and index = ${index}`);
            const chartImg = await generateChart(outage); // Replace with an appropriate implementation

            const outagePageContent = [
                // { text: 'Outage Details', fontSize: 16, margin: [40, 40, 0, 0], pageBreak: index === 0 ? 'after' : 'before' },
                {
                    pageBreak: 'before',
                    style: 'tableExample',
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
                    layout: 'lightHorizontalLines',
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
            outagePageContent.push({
                columns: screenshotColumns,
            });
        
            return outagePageContent;
        });

        const outageDetailsPages = await Promise.all(chartPromises);
        content.push(...outageDetailsPages.flat());

        const docDefinition = {
            content: content,
            footer: function (currentPage, pageCount) {
                return [
                    { text: currentPage.toString() + ' of ' + pageCount, alignment: (currentPage % 2) ? 'left' : 'right' }
                ]
            },
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10]
                },
                footer: {
                    fontSize: 10,
                    margin: [5, 0, 5, 10],
                },
                subheader: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 10, 0, 5]
                },
                tableHeader: {
                    bold: true,
                    fontSize: 13,
                    fillColor: '#b3d9ff'
                }
            }
        };

        // console.log("docDefinition",docDefinition)
        const pdfDoc = pdfMake.createPdf(docDefinition);
        const pdfDataUrl = await new Promise((resolve) => {
            pdfDoc.getDataUrl((dataUrl) => {
                resolve(dataUrl);
            });
        });

        return pdfDataUrl;
    } catch (error) {
        console.log(error);
    }
};

//This is not being used
//TODO: clean up once confirmed
const generateDetailedPDF = async (data, searchTerm, jsPDF) => {
    try {
        console.log("Generating PDF");
        const doc = new jsPDF('p', 'pt');

        const reportPeriodStart = formatDateTime(searchTerm.dateRange.startDate);
        const reportPeriodEnd = formatDateTime(searchTerm.dateRange.endDate);
        const reportGeneratedAt = formatDateTime(Date.now(), false)

        // Set PDF metadata
        doc.setProperties({
            title: 'Outage Details',
            subject: `Outage Details ${reportPeriodStart} to ${reportPeriodEnd} as of ${reportGeneratedAt}`,
        });

        // Add a title to the PDF
        doc.setFontSize(22);
        doc.text(`Outages`, 40, 50);
        doc.setFontSize(14);
        doc.text(`${reportPeriodStart} to ${reportPeriodEnd}`, 40, 70);
        doc.text(`Generated at ${reportGeneratedAt}`, 40, 90);

        // Format the data for the table
        const tableData = data.map((entry) => ({
            worker_name: entry.worker_name,
            outage_start_datetime: new Date(entry.outage_start_datetime).toLocaleString(),
            outage_end_datetime: entry.outage_end_datetime ? new Date(entry.outage_end_datetime).toLocaleString() : 'Ongoing',
            outage_length: entry.outage_length ? (entry.outage_length / 3600000).toFixed(2) : ((currentTime.getTime() - entry.outage_start_datetime) / 3600000).toFixed(2),
        }));

        const columns = [
            { header: 'Worker Name', dataKey: 'worker_name' },
            { header: 'Outage Start', dataKey: 'outage_start_datetime' },
            { header: 'Outage End', dataKey: 'outage_end_datetime' },
            { header: 'Outage Length', dataKey: 'outage_length' },
        ];

        const aggregatedColumns = [
            { header: 'Worker Name', dataKey: 'worker_name' },
            { header: 'Outages', dataKey: 'outages' },
            { header: 'Total Downtime', dataKey: 'total_downtime' },
        ];

        // Calculate totals
        const outageCount = tableData.length;

        const totalOutageLength = tableData.reduce((acc, curr) => {
            let outageLength = parseFloat(curr.outage_length);
            if (outageLength) {
                return acc + outageLength;
            } else {
                return acc;
            }
        }, 0);
        const aggregatedTableData = aggregateDataByWorker(tableData);

        // Add summary table to first page
        doc.autoTable({
            startY: 100,
            columns: aggregatedColumns,
            body: aggregatedTableData,
            didParseCell: (data) => {
                if (data.row.index === aggregatedTableData.length - 1) {
                    data.row.pageBreak = 'avoid'; // Keep the last row on the same page
                }
            },
            didDrawCell: (data) => {
                if (data.row.index === aggregatedTableData.length - 1 && data.cell.section === 'body') {
                    // Footer: totals
                    doc.setFontSize(12);
                    doc.text(`Total Outages: ${outageCount} \t\tTotal Outage Length: ${totalOutageLength.toFixed(2)} hours`, data.settings.margin.left, data.cell.y + data.cell.height + 15);
                }
            },
        });

        for (const [index, entry] of data.entries()) {
            if (index < data.length) {
                doc.addPage();
            }
            const tableData = {
                worker_name: entry.worker_name,
                outage_start_datetime: new Date(entry.outage_start_datetime).toLocaleString(),
                outage_end_datetime: entry.outage_end_datetime ? new Date(entry.outage_end_datetime).toLocaleString() : 'Ongoing',
                outage_length: entry.outage_length ? (entry.outage_length / 3600000).toFixed(2) : ((currentTime.getTime() - entry.outage_start_datetime) / 3600000).toFixed(2),
            };
            doc.autoTable({
                startY: 20,
                columns,
                body: [tableData],
            });

            const chartImg = await generateChart(entry);
            await doc.addImage(chartImg, 50, doc.autoTable.previous.finalY + 20, 500, 250);

            let yOffset = 0;
            let xOffset = 50;

            for (const [index, screenshot] of entry.screenshots.entries()) {
                // console.log(`Screenshot: ${screenshot} at index ${index}`);
                if (index === 0) {
                    yOffset = doc.autoTable.previous.finalY + 10
                } else {
                    yOffset += 95;
                    xOffset = xOffset === 410 ? 50 : xOffset + 120;
                }
                const screenshotPath = `${process.env.SCREENSHOT_PATH}/${screenshot}`;
                const screenshotFile = fs.readFileSync(screenshotPath);
                doc.addImage(screenshotFile, xOffset, yOffset, 110, 85);
            }
        }

        return doc.output('datauristring');
    } catch (error) {
        console.log(error);
    }
};

module.exports = {
    generatePdfWrapper,
    generateDetailedPdfWrapper,
    generateDetailedPDF2
};
