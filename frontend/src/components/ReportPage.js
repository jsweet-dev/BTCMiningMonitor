import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import './print.css'
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';


const MemoizedSearchBar = React.memo(SearchBar);

const filterOutages = (outages, searchTerm) => {
    console.log(`Filtering outages with searchTerm: ${JSON.stringify(searchTerm)}`);
    if (!searchTerm) return outages;

    return outages.filter(outage => {
        let matches = true;
        if (searchTerm.workerName) {
            if(searchTerm.workerName.includes('*')) searchTerm.workerName = searchTerm.workerName.replace(/\*/g, '.*');
            const regex = new RegExp(searchTerm.workerName, 'i');
            matches = matches && regex.test(outage.worker_name);
        }
        if (searchTerm.dateRange.startDate) {
            const startDate = new Date(searchTerm.dateRange.startDate).getTime();
            const endDate = new Date(searchTerm.dateRange.endDate).getTime();
            matches = matches && outage.outage_start_datetime >= startDate && outage.outage_start_datetime <= endDate;
        }
        if (searchTerm.miningUserName) {
            if(searchTerm.miningUserName.includes('*')) searchTerm.miningUserName = searchTerm.miningUserName.replace(/\*/g, '.*');
            const regex = new RegExp(searchTerm.miningUserName, 'i');
            matches = matches && regex.test(outage.mining_user_name);
        }
        return matches;
    });
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

    return Object.values(aggregatedData).map((worker) => { return { ...worker, total_downtime: worker.total_downtime.toFixed(2) }});
};

const generatePDF = (data, searchTerm) => {
    // console.log("Generating PDF", JSON.stringify(data));
    const doc = new jsPDF('p', 'pt');
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
        startY: newStartY+10,
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
    doc.save('Outage Report ' + currentTime.toLocaleDateString("en-US") + '.pdf');
};

const currentTime = Date.now();
const initialSearchTerm = {
    dateRange: {
        startDate: currentTime - 30 * 24 * 60 * 60 * 1000,
        endDate: currentTime
    },
    searchSubmitted: currentTime
}

const ReportPage = () => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [outages, setOutages] = useState([]);
    const [filteredOutages, setFilteredOutages] = useState(outages);
    const [uniqueMiners, setUniqueMiners] = useState([]);

    const handleSearch = useCallback((term) => {
        const searchSubmitted = Date.now();
        term = { ...term, searchSubmitted }
        setSearchTerm(term);
    }, []);


    useEffect(() => {
        async function fetchOutages() {
            let { startDate, endDate } = searchTerm.dateRange;
            const query = {};
            query.startTime = new Date(startDate).getTime();
            query.endTime = new Date(endDate).getTime();

            const outageData = await fetch(process.env.REACT_APP_API_HOST + '/api/outages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            }).then((data) => data.json());
            // console.log("Here's what we got back: ",outageData);

            setOutages(outageData);
        }

        fetchOutages();

    }, [searchTerm.dateRange, searchTerm.searchSubmitted]);

    useEffect(() => {
        if (searchTerm.workerName) {
            const minerSet = new Set(filteredOutages.map(outage => outage.worker_name));
            setUniqueMiners(Array.from(minerSet));
        } else {
            setUniqueMiners([]);
        }
    }, [outages, searchTerm, filteredOutages]);

    useEffect(() => {
        const filteredOutages = filterOutages(outages, searchTerm);
        setFilteredOutages(filteredOutages);
    }, [outages, searchTerm]);


    const outageCount = filteredOutages.length;

    const totalOutageLength = filteredOutages.reduce((total, outage) => {
        return total + (outage.outage_length || (currentTime - outage.outage_start_datetime)) / 3600000;
    }, 0);

    const formattedTotalOutageLength = (totalOutageLength).toFixed(3);

    const TableHeader = ({ dateRange, selectedMiners }) => {
        const formatDate = (date) => new Date(date).toLocaleString("en-US");
        const title = `Miner Outages for ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
        const subtitle = selectedMiners.length > 0 ? `Limited to miners: ${selectedMiners.join(', ')}` : '';

        return (
            <div>
                <h2>{title}</h2>
                {subtitle && <h3>{subtitle}</h3>}
            </div>
        );
    };


    return (
        <>
            <span className="no-print">
                <MemoizedSearchBar
                    filterCriteria={[
                        { workerName: ['string'] },
                        { dateRange: ['dateRange'] },
                        { miningUserName: ['string'] },
                    ]}
                    onSearch={handleSearch}
                />
            </span>
            <div>
                <TableHeader dateRange={searchTerm.dateRange} selectedMiners={uniqueMiners} />
                <TableContainer component={Paper} elevation={12} sx={{ margin: '20px,20px,20px,20px', maxHeight: '60vh', width: 'calc(100% - 25px)' }} id="outagesTable">
                    <Table stickyHeader aria-label="outages table">
                        <TableHead sx={{ fontSize: '1.875rem' }}>
                            <TableRow sx={{ fontSize: '1.875rem' }}>
                                <TableCell sx={{ fontSize: '1.5rem', width: '20%' }}>Worker Name</TableCell>
                                <TableCell sx={{ fontSize: '1.5rem', width: '20%' }}>Outage Start</TableCell>
                                <TableCell sx={{ fontSize: '1.5rem', width: '20%' }}>Outage End</TableCell>
                                <TableCell sx={{ fontSize: '1.5rem', width: '20%' }}>Outage Length</TableCell>
                                <TableCell sx={{ fontSize: '1.5rem', width: '20%' }}></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredOutages.map((outage) => (
                                <TableRow key={outage._id}>
                                    <TableCell >{outage.worker_name}</TableCell>
                                    <TableCell >{new Date(outage.outage_start_datetime).toLocaleString()}</TableCell>
                                    <TableCell >{outage.outage_end_datetime ? new Date(outage.outage_end_datetime).toLocaleString() : 'Ongoing'}</TableCell>
                                    <TableCell >{outage.outage_length ? `${(outage.outage_length / 3600000).toFixed(3)} hours` : `${((currentTime - outage.outage_start_datetime) / 3600000).toFixed(3)} hours`}</TableCell>
                                    <TableCell>
                                        <Link
                                            className='outage-details-link'
                                            key={outage._id}
                                            to={`/outageDetails/${outage._id}`}
                                            state={{ outageInfo: outage, outageId: outage._id }}
                                        >
                                            <Button variant="contained" color="primary">
                                                Details
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TableContainer component={Paper} elevation={12} sx={{ maxHeight: '6vh', width: 'calc(100% - 25px)' }} id="outagesTotals">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell sx={{ fontSize: '1.3rem', width: '20%' }}>Total Outages: {outageCount}</TableCell>
                                <TableCell sx={{ fontSize: '1.3rem', width: '20%' }}></TableCell>
                                <TableCell sx={{ fontSize: '1.3rem', width: '20%' }} align='right'>Total Outage Length:</TableCell>
                                <TableCell sx={{ fontSize: '1.3rem', width: '20%' }}> {formattedTotalOutageLength} hours</TableCell>
                                <TableCell sx={{ fontSize: '1.3rem', width: '20%' }}></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </div>
            <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={() => generatePDF(filteredOutages, searchTerm)}>
                Generate Summary PDF
            </Button>
            <Button
                className="no-print"
                style={{ margin: "10px" }}
                variant="contained"
                color="primary"
                onClick={() => window.print()}
            >
                Print Summary
            </Button>
            <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={() => ""}>
                Generate Detailed PDF
            </Button>
        </>
    );
};

export default ReportPage;
