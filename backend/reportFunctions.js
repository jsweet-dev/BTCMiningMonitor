const generatePdfWrapper = async (data, searchTerm) => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    return generatePDF(data, searchTerm, jsPDF);
};

const aggregateDataByWorker = (data) => {
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

    return Object.values(aggregatedData).map((worker) => { return { ...worker, total_downtime: worker.total_downtime.toFixed(2) } });
};

const generatePDF = async (data, searchTerm, jsPDF) => {
    console.log("Generating PDF");
    console.log(`Received: searchTerm: ${JSON.stringify(searchTerm)} and ${data.length} outages`);
    const doc = new jsPDF('p', 'pt');
    console.log("Created PDF object");
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
    console.log("Setting PDF metadata");
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

module.exports = {
    generatePdfWrapper,
};
