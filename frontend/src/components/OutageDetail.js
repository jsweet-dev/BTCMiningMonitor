import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ReactECharts } from './ReactECharts.tsx';
import { TableCell, TableRow, Paper, Table, TableHead, TableBody, TableContainer, Box } from '@mui/material';
import './outageDetail.css'

const getOption = (worker, outageInfo) => {
    worker = worker[0];
    return ({
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
        dataZoom: [
            {
                type: 'slider',
                show: true,
                start: 0,
                end: 100,
                zoomOnMouseWheel: 'shift',
            },
            {
                type: 'inside',
                start: 0,
                end: 100,
                zoomOnMouseWheel: 'shift',
            },
        ],
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                const date = new Date(params[0].value[0]).toLocaleString("en-US", { timeZone: 'America/Los_Angeles' });
                const hashRate = params[0].value[1].toFixed(2) + ' TH/s';
                const status = params[1].value[1] === 0 ? 'Down' : 'Up';
                return `${date}<br/>Hash Rate: ${hashRate}<br/>Status: ${status}`;
            },
        },
    });
};

const OutageDetail = ({ outageId }) => {
    const location = useLocation();
    const outageInfo = location.state?.outageInfo || null;
    const [worker, setWorker] = React.useState(null);
    const [option, setOption] = React.useState(null);


    useEffect(() => {
        async function fetchWorkers() {
            const startTime = outageInfo.outage_start_datetime - (outageInfo.outage_start_datetime * 0.000001);
            const endTime = outageInfo.outage_end_datetime + (outageInfo.outage_end_datetime * 0.000001);
            const workerName = outageInfo.worker_name;
            const query = {};

            query.startTime = startTime;
            query.endTime = endTime;
            query.workerName = workerName;
            const workerData = await fetch(process.env.REACT_APP_API_HOST + '/api/workers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            }).then((data) => data.json());
            setWorker(workerData);
        }
        fetchWorkers();
    }, [outageInfo]);


    useEffect(() => {
        if (!worker) return;
        setOption(getOption(worker, outageInfo));
    }, [worker, outageInfo]);


    return (
        <div>
            <h2 id="pageTitle">
                Outage of <span className='emphasizeRed'>{outageInfo.worker_name} {`
                `}</span> on <span className='emphasizeRed'>{new Date(outageInfo.outage_start_datetime).toLocaleString("en-US")}</span>
            </h2>
            <TableContainer component={Paper}>
                <Table aria-label="outage table" id="outageTable">
                    <TableHead>
                        <TableRow>
                            <TableCell>Worker Name</TableCell>
                            <TableCell>Outage Start</TableCell>
                            <TableCell>Outage End</TableCell>
                            <TableCell>Outage Length</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow key={outageInfo._id}>
                            <TableCell>{outageInfo.worker_name}</TableCell>
                            <TableCell>{new Date(outageInfo.outage_start_datetime).toLocaleString()}</TableCell>
                            <TableCell>{outageInfo.outage_end_datetime ? new Date(outageInfo.outage_end_datetime).toLocaleString() : 'Ongoing'}</TableCell>
                            <TableCell>{outageInfo.outage_length ? `${(outageInfo.outage_length / 3600000).toFixed(2)} hours` : 'Ongoing'}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
            {option && (
                <Paper elevation={12} className='chartContainer'>
                    <ReactECharts
                        option={option}
                        initOptions={{ renderer: 'svg' }}
                        className='chart'
                    />
                </Paper>
            )}
            <div>
                        <Box className='screenshotsBox'>
                            {outageInfo.screenshots.map((screenshot, index) => (
                                <Paper
                                    elevation={4}
                                    key={screenshot}
                                >
                                    <a href={process.env.REACT_APP_API_HOST + `/screenshots/${screenshot}`} target="_blank" rel="noopener noreferrer">
                                        <img
                                            key={index}
                                            src={process.env.REACT_APP_API_HOST + `/screenshots/${screenshot}`}
                                            alt={`Screenshot ${index}`}
                                        />
                                    </a>
                                </Paper>
                            ))
                            }
                        </Box>
            </div>
        </div>
    );
};

export default OutageDetail;
