import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';

const SearchBar = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState({
    mining_user_name: '',
    worker_name: '',
    status: '',
    host: '',
  });

  const handleChange = (event) => {
    setSearchQuery({ ...searchQuery, [event.target.name]: event.target.value });
  };

  const handleSubmit = () => {
    onSearch(searchQuery);
  };

  return (
    <Box my={4}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Mining User Name"
            name="mining_user_name"
            value={searchQuery.mining_user_name}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Worker Name"
            name="worker_name"
            value={searchQuery.worker_name}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={searchQuery.status}
              onChange={handleChange}
              label="Status"
            >
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              <MenuItem value="0">Up</MenuItem>
              <MenuItem value="1">Down</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Host"
            name="host"
            value={searchQuery.host}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Search
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SearchBar;
