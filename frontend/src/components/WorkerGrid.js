import React from 'react';
import WorkerCard from './WorkerCard';
import SearchBar from './SearchBar';
import {
  Button,
  ButtonGroup,
  CircularProgress,
  Grid
} from '@mui/material';

const MemoizedSearchBar = React.memo(SearchBar);
const timeFrames = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  twoMonths: 60 * 24 * 60 * 60 * 1000,
};
const WorkerGrid = ({ workers, onTimeframeChange, handleSearch, isLoading }) => {
  const [selectedTimeframe, setSelectedTimeframe] = React.useState(timeFrames.daily);
  function handleTimeframeChange(newTimeframe) {
    setSelectedTimeframe(newTimeframe);
    onTimeframeChange(newTimeframe);
  }
  
  return (
    <>
      <MemoizedSearchBar
        filterCriteria={[
          { miningUserName: ['string'] },
          { workerName: ['string'] },
          { status: ['bool', { true: 'Up', false: 'Down' }] },
          { host: ['string'] },
        ]}
        onSearch={handleSearch}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} lg={12}>
        <ButtonGroup size="small" aria-label="timeframe button group">
            <Button variant={selectedTimeframe === timeFrames.daily ? 'contained' : 'outlined'} id='dailyTfBtn' onClick={() => handleTimeframeChange(timeFrames.daily)}>Daily</Button>
            <Button variant={selectedTimeframe === timeFrames.weekly ? 'contained' : 'outlined'} id='weeklyTfBtn' onClick={() => handleTimeframeChange(timeFrames.weekly)}>Weekly</Button>
            <Button variant={selectedTimeframe === timeFrames.monthly ? 'contained' : 'outlined'} id='monthlyTfBtn' onClick={() => handleTimeframeChange(timeFrames.monthly)}>Monthly</Button>
            <Button variant={selectedTimeframe === timeFrames.twoMonths ? 'contained' : 'outlined'} id='monthly2TfBtn' onClick={() => handleTimeframeChange(timeFrames.twoMonths)}>2 Months</Button>
          </ButtonGroup>
        </Grid>
        {
        isLoading
        ? <Grid item xs={12} lg={12}><CircularProgress size={300}></CircularProgress></Grid> 
        : workers.map((worker, index) => (
          <Grid key={index} item xs={12} sm={6} xl={4}>
            <WorkerCard worker={worker} onTimeframeChange={onTimeframeChange}/>
          </Grid>
        ))
      }
      </Grid>
    
    </>
  );
};

export default WorkerGrid;
