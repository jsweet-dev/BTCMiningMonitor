import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import jsPDF from "jspdf";
import domtoimage from 'dom-to-image';


const MemoizedSearchBar = React.memo(SearchBar);

const filterOutages = (outages, searchTerm) => {
    // console.log(`Filtering outages with searchTerm: ${JSON.stringify(searchTerm)}`);
    if (!searchTerm) return outages;

    return outages.filter(outage => {
        let matches = true;
        if (searchTerm.workerName) {
            searchTerm.workerName.includes('*') ? searchTerm.workerName = searchTerm.workerName.replace(/\*/g, '.*') : searchTerm.workerName = searchTerm.workerName;
            const regex = new RegExp(searchTerm.workerName, 'i');
            matches = matches && regex.test(outage.worker_name);
        }
        if (searchTerm.dateRange.startDate) {
            const startDate = new Date(searchTerm.dateRange.startDate).getTime();
            const endDate = new Date(searchTerm.dateRange.endDate).getTime();
            matches = matches && outage.outage_start_datetime >= startDate && outage.outage_start_datetime <= endDate;
        }
        return matches;
    });
};

const exportToPDF = () => {
    const table = document.getElementById('outagesTable');
    const scale = 2; // Increase scale for better quality

    domtoimage.toPng(table, { bgcolor: '#FFFFFF', width: table.clientWidth * scale, height: table.clientHeight * scale, style: { transform: `scale(${scale})`, transformOrigin: 'top left' } })
        .then((imgData) => {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('table.pdf');
        })
        .catch((error) => {
            console.error('Error generating PDF:', error);
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

            const outageData = await fetch('http://localhost:3001/api/outages', {
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

    }, [searchTerm.dateRange.startDate, searchTerm.dateRange.endDate, searchTerm.searchSubmitted]);

    useEffect(() => {
        if (searchTerm.workerName) {
            const minerSet = new Set(filteredOutages.map(outage => outage.worker_name));
            setUniqueMiners(Array.from(minerSet));
        } else {
            setUniqueMiners([]);
        }
        setFilteredOutages(filterOutages(outages, searchTerm));
    }, [outages, searchTerm]);

    const outageCount = filteredOutages.length;

    const totalOutageLength = filteredOutages.reduce((total, outage) => {
        return total + (outage.outage_length || 0);
    }, 0);

    const formattedTotalOutageLength = (totalOutageLength / 3600000).toFixed(2);

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
            <MemoizedSearchBar
                filterCriteria={[
                    { workerName: ['string'] },
                    { dateRange: ['dateRange'] },
                ]}
                onSearch={handleSearch}
            />
            <div>
            <TableHeader dateRange={searchTerm.dateRange} selectedMiners={uniqueMiners} />
            <TableContainer component={Paper} elevation={12} sx={{ maxHeight: '60vh' }} id="outagesTable">
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
                                <TableCell sx={{ fontSize: '1rem' }}>{outage.worker_name}</TableCell>
                                <TableCell sx={{ fontSize: '1rem' }}>{new Date(outage.outage_start_datetime).toLocaleString()}</TableCell>
                                <TableCell sx={{ fontSize: '1rem' }}>{outage.outage_end_datetime ? new Date(outage.outage_end_datetime).toLocaleString() : 'Ongoing'}</TableCell>
                                <TableCell sx={{ fontSize: '1rem' }}>{outage.outage_length ? `${(outage.outage_length / 3600000).toFixed(2)} hours` : 'Ongoing'}</TableCell>
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
            <TableContainer component={Paper} elevation={12} sx={{ maxHeight: '6vh', width:'calc(100% - 25px)' }} id="outagesTotals">
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
            <Button style={{ margin: '10px' }} variant="contained" color="primary" onClick={exportToPDF}>
                Export to PDF
            </Button>
        </>
    );
};

export default ReportPage;
