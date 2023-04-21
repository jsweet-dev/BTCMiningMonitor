import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography
} from '@mui/material';
import { ReactECharts } from './ReactECharts.tsx';

const getOption = (worker) => ({
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
        entry.hashRate ,
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
      type: 'slider', // Enable data zoom slider on the bottom of the chart
      show: true, // Display the slider
      start: 0, // Initial start percentage
      end: 100, // Initial end percentage
      zoomOnMouseWheel: 'shift',
    },
    {
      type: 'inside', // Enable data zoom by clicking and dragging on the chart
      start: 0, // Initial start percentage
      end: 100, // Initial end percentage
      zoomOnMouseWheel: 'shift',
    },
  ],
  tooltip: {
    trigger: 'axis',
    formatter: (params) => {
      const date = new Date(params[0].value[0]).toLocaleString("en-US", { timeZone: 'America/Los_Angeles'});
      const hashRate = params[0].value[1].toFixed(2) + ' TH/s';
      const status = params[1].value[1] === 0 ? 'Down' : 'Up';
      return `${date}<br/>Hash Rate: ${hashRate}<br/>Status: ${status}`;
    },
  },
});

const WorkerCard = ({ worker }) => {
  const chartKey = useMemo(() => Date.now(), []);

  const option = useMemo(() => getOption(worker), [worker]);
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {worker._id}
        </Typography>
        <Typography color="text.secondary">
          {/* probably would be best to create a db function to get the last update time or store a value like lastHashRate*/}
          Last Update: {new Date(Math.max(...worker.history.map(o => o.timestamp))).toLocaleString("en-US", { timeZone: 'America/Los_Angeles'})}
        </Typography>
        <Typography color="text.secondary">
          Mining User Name: {worker.miningUserName}
        </Typography>
        <Typography color="text.secondary">
          Status: {worker.lastHashRate ? 'Up' : 'Down'}
        </Typography>
        <Typography color="text.secondary">
          Host: {worker.host}
        </Typography>
        <Typography color="text.secondary">
          Hash Rate: {worker.lastHashRate.toFixed(2)} TH/s
        </Typography>
        <Typography color="text.secondary">
          Last Share: {new Date(worker.lastShare*1000).toLocaleString("en-US", { timeZone: 'America/Los_Angeles'})}
        </Typography>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ReactECharts 
            key={chartKey} 
            option={option} 
            style={{ width: '80%', height: 400 }} 
            // initOptions={{renderer: 'svg'}} // use svg to render the chart.
            />
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerCard;

