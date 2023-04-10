import React from 'react';
import WorkerCard from './WorkerCard';
import { Grid } from '@mui/material';

const WorkerGrid = ({ workers }) => {
  return (
    <Grid container spacing={4}>
      {workers.map((worker, index) => (
        <Grid key={index} item xs={12} sm={6} md={4}>
          <WorkerCard worker={worker} />
        </Grid>
      ))}
    </Grid>
  );
};

export default WorkerGrid;
