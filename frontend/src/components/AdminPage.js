import React, { useState, useEffect, useCallback } from 'react';
import {
    Button,
    CircularProgress,
    Tooltip,
    Slider,
} from '@mui/material';
import { Link } from 'react-router-dom';

const updateDebugLevel = (event, value) => {
    const requestOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debugLevel: value })
    };
    fetch(process.env.REACT_APP_API_HOST + '/api/debugLevel', requestOptions)
        .then(response => response.json())
        .then(data => console.log(data));
}

const AdminPage = () => {
    return (
        <>
            <h1>Admin Page</h1>
            <div style={{width:'100%', position: 'fixed', margin:'auto 0'}} >
                Debug Level:<br/> <Slider onChangeCommitted={updateDebugLevel} style={{width: '30%'}} aria-label='Debug Level' defaultValue={4} valueLabelDisplay='auto' step={1} marks min={1} max={8} />
            </div>
        </>
    );
};

export default AdminPage;