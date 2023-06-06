import React, { useState, useEffect } from 'react';
import './App.css';
import WorkerGrid from './components/WorkerGrid';
import ReportPage from './components/ReportPage';
import OutageDetail from './components/OutageDetail';
import { BrowserRouter as Router, Link, Navigate } from 'react-router-dom';
import { Routes, Route } from 'react-router';
import { Button } from '@mui/material';
import AdminPage from './components/adminPage';


const MemoizedWorkerGrid = React.memo(WorkerGrid);
const MemoizedReportPage = React.memo(ReportPage);
const MemoizedOutageDetail = React.memo(OutageDetail);

function App() {
  const [displayedWorkers, setDisplayedWorkers] = useState([]);
  // const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState(86400000);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    // console.log("Searchterm: ",searchTerm);
    // console.log("Timeframe: ",timeframe);

    async function fetchWorkers() {
      setIsLoading(true);
      const { host, workerName, status, miningUserName } = searchTerm;

      let startTime = timeframe;
      let endTime = null;

      const query = {};
      if (workerName) {
        query.workerName = workerName;
      }
      if (status) {
        console.log("Status: ", status)
        query.status = status === 'true' ? 'up' : 'down';
      }
      if (miningUserName) {
        query.miningUserName = miningUserName;
      }
      if (host) {
        query.host = host;
      }
      const currentTime = Date.now();
      // Use startTime if provided, otherwise default to 24 hours ago
      const start = startTime ? currentTime - parseInt(startTime) : currentTime - 24 * 60 * 60 * 1000;
      // Use endTime if provided, otherwise default to the current time
      const end = endTime ? currentTime - parseInt(endTime) : currentTime;

      query.startTime = start;
      query.endTime = end;

      const workerData = await fetch(process.env.REACT_APP_API_HOST + '/api/workers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      }).then((data) => data.json());

      setDisplayedWorkers(workerData);
      setIsLoading(false);
    }

    fetchWorkers();

    // Refresh the data every 10 minutes
    const refreshInterval = setInterval(() => {
      console.log('Refreshing data...' + new Date().toLocaleTimeString());
      fetchWorkers();
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    // Clear the interval when the component is unmounted
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [searchTerm, timeframe]);


  function handleTimeframeChange(newTimeframe) {
    setTimeframe(newTimeframe);
  }

  function handleSearch(searchTerm) {
    const lowerCaseSearchTerm = {
      miningUserName: searchTerm.miningUserName.toLowerCase(),
      workerName: searchTerm.workerName.toLowerCase(),
      status: searchTerm.status.toString().toLowerCase(),
      host: searchTerm.host.toLowerCase(),
    };
    setSearchTerm({ ...searchTerm, ...lowerCaseSearchTerm });
  }


  return (
    <div className="App">
      <Router>
        <nav className="no-print" style={{ display: "flex", justifyContent: "center", gridGap: "2rem", alignContent: "center", borderBottom: 'solid 5px black', padding: '5px' }}>
          <Link to="/workers">
            <Button style={{ margin: '5px' }} variant="contained" color="primary">
              Workers
            </Button>
          </Link>
          <Link to="/reports">
            <Button style={{ margin: '5px' }} variant="contained" color="primary">
              Reports
            </Button>
          </Link>
          <Link to="/admin">
            <Button style={{ margin: '5px' }} variant="contained" color="primary">
              Admin
            </Button>
          </Link>
        </nav>

        <Routes>
          <Route path="/reports" element={<MemoizedReportPage />} />
          <Route
            path="/workers"
            element={
              <MemoizedWorkerGrid
                workers={displayedWorkers}
                onTimeframeChange={handleTimeframeChange}
                handleSearch={handleSearch}
                isLoading={isLoading}
              />
            }
          />
          <Route path="/outageDetails/:uniqueKey" element={<MemoizedOutageDetail />} />
          <Route path="/" element={<Navigate to="/workers" replace />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
