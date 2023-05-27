import React, { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Popover
} from '@mui/material';
import { startOfMonth, endOfMonth } from 'date-fns';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './searchBar.css'

const SearchBar = ({ filterCriteria, onSearch }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const defaultSearchQuery = useMemo(() => {
    const calculatedStartOfMonth = startOfMonth(new Date()).getTime()
    const calculatedEndOfMonth = endOfMonth(new Date()).getTime()

    const query = {};
    filterCriteria.forEach((criteria) => {
      const key = Object.keys(criteria)[0];
      if (criteria[key][0] === 'dateRange') {
        query[key] = {
          startDate: calculatedStartOfMonth,
          endDate: calculatedEndOfMonth
        };
      } else {
        query[key] = '';
      }
    });
    return query;
  }, [filterCriteria]);

  const clearSearch = () => {
    setSearchQuery(defaultSearchQuery);
    onSearch(defaultSearchQuery);
  };

  const [searchQuery, setSearchQuery] = useState(defaultSearchQuery);

  const handleChange = (event) => {
    setSearchQuery({ ...searchQuery, [event.target.name]: event.target.value });
  };

  const handleDateChange = (key, startDate, endDate) => {
    setSearchQuery({
      ...searchQuery,
      [key]: { startDate, endDate },
    });
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const formatDate = (date) => {
    if (!date) return '';
    date = new Date(date);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSubmit = () => {
    onSearch(searchQuery);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  const getLabel = (key, customLabels) => {
    if (customLabels) {
      return customLabels[key] || key;
    }

    return key
      .split(/(?=[A-Z])/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Box my={4}>
      <Grid container spacing={2}>
        {filterCriteria.map((criteria, index) => {
          const key = Object.keys(criteria)[0];
          const [type, customLabels] = criteria[key];

          if (type === 'bool') {
            return (
              <Grid item xs={12} sm lg xl key={index}>
                <FormControl fullWidth>
                  <InputLabel>{getLabel(key, customLabels)}</InputLabel>
                  <Select
                    name={key}
                    value={searchQuery[key]}
                    onChange={handleChange}
                    onKeyPress={handleKeyPress}
                    label={getLabel(key, customLabels)}
                  >
                    <MenuItem value="">
                      <em>Any</em>
                    </MenuItem>
                    <MenuItem value="true">{getLabel('true', customLabels)}</MenuItem>
                    <MenuItem value="false">{getLabel('false', customLabels)}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            );
          } else if (type === 'dateRange') {
            const open = Boolean(anchorEl);
            const id = open ? 'simple-popover' : undefined;

            return (
              <Grid item xs={12} sm lg xl key={index}>
                <TextField
                  fullWidth={true}
                  label="Date Range"
                  onClick={handleClick}
                  value={`${formatDate(searchQuery[key].startDate)} ~ ${formatDate(searchQuery[key].endDate)}`}
                />
                <Popover
                  id={id}
                  open={open}
                  anchorEl={anchorEl}
                  onClose={handleClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                >
                  <DateRangePicker
                    onChange={(item) => {
                      handleDateChange(
                        key,
                        item.range1.startDate,
                        item.range1.endDate
                      );
                      handleClose();
                    }}
                    showSelectionPreview={true}
                    moveRangeOnFirstSelection={false}
                    months={2}
                    direction="vertical"
                    ranges={[
                      {
                        startDate: new Date(searchQuery[key].startDate),
                        endDate: new Date(searchQuery[key].endDate),
                        key: 'range1',
                      },
                    ]}
                    rangeColors={['#3f51b5']}
                  />
                </Popover>
              </Grid>
            );
          }

          else {
            return (
              <Grid item xs={12} sm lg xl key={index}>
                <TextField
                  label={getLabel(key, customLabels)}
                  name={key}
                  value={searchQuery[key]}
                  onChange={handleChange}
                  onKeyPress={handleKeyPress}
                  fullWidth
                />
              </Grid>
            );
          }
        })}
        <Grid item xs={12} sx={{ '& > button': { marginRight: '15px' } }}>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Search
          </Button>
          <Button variant="contained" color="secondary" onClick={() => clearSearch()}>
            Clear
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SearchBar;
