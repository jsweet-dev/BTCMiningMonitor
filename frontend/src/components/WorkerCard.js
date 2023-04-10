import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

const WorkerCard = ({ worker }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {worker.worker_name}
        </Typography>
        <Typography color="text.secondary">
          Mining User Name: {worker.mining_user_name}
        </Typography>
        <Typography color="text.secondary">
          Last Share At: {new Date(worker.last_share_at * 1000).toLocaleString()}
        </Typography>
        <Typography color="text.secondary">
          Status: {worker.status === 0 ? 'Up' : 'Down'}
        </Typography>
        <Typography color="text.secondary">
          Host: {worker.host}
        </Typography>
        <Typography color="text.secondary">
          Hash Rate: {worker.hash_rate.toFixed(2)}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default WorkerCard;
