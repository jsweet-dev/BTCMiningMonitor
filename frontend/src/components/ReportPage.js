import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import './print.css'


const MemoizedSearchBar = React.memo(SearchBar);

const filterOutages = (outages, searchTerm) => {
    console.log(`Filtering outages with searchTerm: ${JSON.stringify(searchTerm)}`);
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

    const generateDetailedPDF = useCallback(async () => {
        console.log("Generating detailed PDF", searchTerm)
        setReportStatus({ loading: true, error: false, reportUrl: '' });
        try {
            const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/reports/detailed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ searchTerm: searchTerm }),
            });
            const resJson = await response.json();
            const arrayBuffer = Uint8Array.from(resJson.data);
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const reportUrl = URL.createObjectURL(blob);
            setReportStatus({ loading: false, error: false, reportUrl });
        } catch (error) {
            setReportStatus({ loading: false, error: true, reportUrl: '' });
        }
    }, [searchTerm]);

    const generateSummaryPDF = useCallback(async () => {
        console.log("Generating summary PDF", searchTerm)
        setSummaryReportStatus({ loading: true, error: false, reportUrl: '' });
        try {
            const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/reports/summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ searchTerm: searchTerm }),
            });
            const resJson = await response.json();
            const arrayBuffer = Uint8Array.from(resJson.data);
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const reportUrl = URL.createObjectURL(blob);
            setSummaryReportStatus({ loading: false, error: false, reportUrl });
        } catch (error) {
            console.log("Error generating summary PDF: ", error)
            setSummaryReportStatus({ loading: false, error: true, reportUrl: '' });
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
            <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={generateSummaryPDF}>
                {summaryReportStatus.error ? "Retry?" : summaryReportStatus.loading ? "Loading" : "Generate Summary PDF"}
                {summaryReportStatus.loading && <CircularProgress size={20} color='warning' style={{ marginLeft: 5 }} />}
            </Button>
            {summaryReportStatus.reportUrl && (
                <div style={{ marginTop: 10 }}>
                    <a href={summaryReportStatus.reportUrl} download={`Detailed Outages Report ${new Date().toLocaleDateString("en-US")}.pdf`} target="_blank" rel="noopener noreferrer">
                        View/Download Summary Report
                    </a>
                </div>
            )}
            <Button
                className="no-print"
                style={{ margin: "10px" }}
                variant="contained"
                color="primary"
                onClick={() => window.print()}
            >
                Print Summary
            </Button>
            <Button className="no-print" style={{ margin: "10px" }} variant="contained" color="primary" onClick={generateDetailedPDF}>
                {reportStatus.error ? "Retry?" : reportStatus.loading ? "Loading" : "Generate Detailed PDF"}
                {reportStatus.loading && <CircularProgress size={20} color='warning' style={{ marginLeft: 5 }} />}
            </Button>
            {reportStatus.reportUrl && (
                <div style={{ marginTop: 10 }}>
                    <a href={reportStatus.reportUrl} download={`Detailed Outages Report ${new Date().toLocaleDateString("en-US")}.pdf`} target="_blank" rel="noopener noreferrer">
                        View/Download Detailed Report
                    </a>
                </div>
            )}
        </>
    );
};

export default ReportPage;
