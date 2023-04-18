import React from 'react';
import WorkerCard from './WorkerCard';
import SearchBar from './SearchBar';
import {
  Button,
  ButtonGroup,
  Grid
} from '@mui/material';

const MemoizedSearchBar = React.memo(SearchBar);
const timeFrames = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  twoMonths: 60 * 24 * 60 * 60 * 1000,
};
const WorkerGrid = ({ workers, onTimeframeChange, handleSearch }) => {
  function handleTimeframeChange(newTimeframe) {
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
            <Button onClick={() => handleTimeframeChange(timeFrames.daily)}>Daily</Button>
            <Button onClick={() => handleTimeframeChange(timeFrames.weekly)}>Weekly</Button>
            <Button onClick={() => handleTimeframeChange(timeFrames.monthly)}>Monthly</Button>
            <Button onClick={() => handleTimeframeChange(timeFrames.twoMonths)}>2 Months</Button>
          </ButtonGroup>
        </Grid>
        {workers.map((worker, index) => (
          <Grid key={index} item xs={12} sm={6} xl={4}>
            <WorkerCard worker={worker} onTimeframeChange={onTimeframeChange}/>
          </Grid>
        ))}
      </Grid>
    
    </>
  );
};

export default WorkerGrid;
