import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, CircularProgress } from '@mui/material';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import './print.css'


const MemoizedSearchBar = React.memo(SearchBar);

const filterOutages = (outages, searchTerm) => {
    // console.debug(`Filtering outages with searchTerm: ${JSON.stringify(searchTerm)}`);
    if (!searchTerm) return outages;

    return outages.filter(outage => {
        let matches = true;
        if (searchTerm.workerName) {
            if (searchTerm.workerName.includes('*')) searchTerm.workerName = searchTerm.workerName.replace(/\*/g, '.*');
            const regex = new RegExp(searchTerm.workerName, 'i');
            matches = matches && regex.test(outage.worker_name);
        }
        if (searchTerm.dateRange.startDate) {
            const startDate = new Date(searchTerm.dateRange.startDate).getTime();
            const endDate = new Date(searchTerm.dateRange.endDate).getTime();
            matches = matches && outage.outage_start_datetime >= startDate && outage.outage_start_datetime <= endDate;
        }
        if (searchTerm.miningUserName) {
            if (searchTerm.miningUserName.includes('*')) searchTerm.miningUserName = searchTerm.miningUserName.replace(/\*/g, '.*');
            const regex = new RegExp(searchTerm.miningUserName, 'i');
            matches = matches && regex.test(outage.mining_user_name);
        }
        return matches;
    });
};

const currentTime = Date.now();
const calculatedStartOfMonth = startOfMonth(new Date()).getTime()
const calculatedEndOfMonth = endOfMonth(new Date()).getTime()
const initialSearchTerm = {
    dateRange: {
        startDate: calculatedStartOfMonth,
        endDate: calculatedEndOfMonth
  },
    searchSubmitted: currentTime
}

// Function to periodically check the job status
function checkJobStatus(jobId, type) {
    console.debug(`Checking job status for jobId: ${jobId}`);
    return new Promise(async (resolve, reject) => {
        const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/reports/status/${jobId}`);
        const data = await response.json();

        if (response.status === 200) {
            console.debug(`Report generation complete for jobId: ${jobId}`);
            resolve(data); // The report is ready, return the data
        } else if (response.status === 202) {
            console.debug(`Report generation still in progress for jobId: ${jobId}`);
            setTimeout(() => {
                checkJobStatus(jobId) // Report generation is still in progress, check again after a delay
                    .then(resolve)
                    .catch(reject);
            }, type === 'detailed' ? 12000 : 5000); // Wait for 12 seconds before checking the status again
        } else {
            console.log(`Report generation failed for jobId: ${jobId}`);
            reject(data); // An error occurred, reject with the error message
        }
    });
}

const ReportPage = () => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [outages, setOutages] = useState([]);
    const [filteredOutages, setFilteredOutages] = useState(outages);
    const [uniqueMiners, setUniqueMiners] = useState([]);
    const [reportStatus, setReportStatus] = useState({ loading: false, error: false, reportUrl: '' });
    const [summaryReportStatus, setSummaryReportStatus] = useState({ loading: false, error: false, reportUrl: '' });

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
            // console.debug("Here's what we got back: ",outageData);

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


    const generatePDF = useCallback(async (type) => {
        // console.debug(`Generating ${type} PDF`)//, searchTerm)
        type === 'summary' 
        ? setSummaryReportStatus({ loading: true, error: false, reportUrl: '' }) 
        : setReportStatus({ loading: true, error: false, reportUrl: '' });
        
        try {
            const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/reports/${type}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ searchTerm: searchTerm }),
            });
            const resJson = await response.json();
            const jobId = resJson.jobId;

            // Check the job status until the report is ready or an error occurs
            if(!jobId) {
                throw new Error('503');
            }
            const report = await checkJobStatus(jobId, type);
            // console.debug('Report received:', report);
            const arrayBuffer = Uint8Array.from(report.data);
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const reportUrl = URL.createObjectURL(blob);
            type === 'summary'
            ? setSummaryReportStatus({ loading: false, error: false, reportUrl })
            : setReportStatus({ loading: false, error: false, reportUrl });
        } catch (error) {
            // console.debug('Error generating report:', error.message);
            type === 'summary'
            ? setSummaryReportStatus({ loading: false, error: error.message === '503' ? 503 : true, reportUrl: '' })
            : setReportStatus({ loading: false, error: error.message === '503' ? 503 : true, reportUrl: '' });
        }
    }, [searchTerm]);

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
            {/* <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={() => generatePDF(filteredOutages, searchTerm)}>
                Generate Summary PDF
            </Button> */}
            <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={() => generatePDF('summary')}>
                {summaryReportStatus.error ? summaryReportStatus.error === 503 ? "Server busy, retry?" : "Error, Retry?" : summaryReportStatus.loading ? "Loading" : "Generate Summary PDF"}
                {summaryReportStatus.loading && <CircularProgress size={20} color='warning' style={{ marginLeft: 5 }} />}
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
            <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={() => generatePDF('detailed')}>
                {reportStatus.error ? reportStatus.error === 503 ? "Server busy, retry?" : "Error, Retry?" : reportStatus.loading ? "Loading" : "Generate Detailed PDF"}
                {reportStatus.loading && <CircularProgress size={20} color='warning' style={{ marginLeft: 5 }} />}
            </Button>
            {summaryReportStatus.reportUrl && (
                <div style={{ marginTop: 10 }}>
                    <a href={summaryReportStatus.reportUrl} download={`Summary of Outages (Report Generated  ${new Date().toLocaleDateString("en-US")}.pdf`} target="_blank" rel="noopener noreferrer">
                        View/Download Summary Report
                    </a>
                </div>
            )}
            {reportStatus.reportUrl && (
                <div style={{ marginTop: 10 }}>
                    <a href={reportStatus.reportUrl} download={`Detailed Outages Report (Generated ${new Date().toLocaleDateString("en-US")}.pdf`} target="_blank" rel="noopener noreferrer">
                        View/Download Detailed Report
                    </a>
                </div>
            )}
        </>
    );
};

export default ReportPage;
