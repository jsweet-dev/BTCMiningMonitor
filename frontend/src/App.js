import React, { useState, useEffect } from 'react';
import WorkerGrid from './components/WorkerGrid';
import SearchBar from './components/SearchBar';
import { Container, Box, Typography } from '@mui/material';

const App = () => {
  const [workersData, setWorkersData] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);

  useEffect(() => {
    // Fetch workers data from API and store it in workersData
    const fetchData = async () => {
      const data = [
        // Your fetched data goes here
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x137", "last_share_at" : 1680933812, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 107898741072418.14, "timestamp" : 1680933961552, "__v" : 0 },
        { "mining_user_name" : "et3eo7m00nfi", "worker_name" : "sm1", "last_share_at" : 1680933826, "status" : 0, "host" : "24.149.9.218", "hash_rate" : 111026240813647.64, "timestamp" : 1680933961553, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x129x151", "last_share_at" : 1680933795, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 103207491460573.86, "timestamp" : 1680933961552, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x121", "last_share_at" : 1680933807, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 112589990684262.4, "timestamp" : 1680933961552, "__v" : 0 },
        { "mining_user_name" : "et3eo7m00nfi", "worker_name" : "sm2", "last_share_at" : 1680933839, "status" : 0, "host" : "24.149.9.218", "hash_rate" : 111026240813647.64, "timestamp" : 1680933961553, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x113x188", "last_share_at" : 1680933783, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 112589990684262.4, "timestamp" : 1680933961550, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x95x213", "last_share_at" : 1680933834, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 104771241331188.62, "timestamp" : 1680933961551, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "49x19x10x103", "last_share_at" : 1680933834, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 132918739002254.22, "timestamp" : 1680933961547, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "5x188x105", "last_share_at" : 1680933793, "status" : 0, "host" : "24.223.108.20", "hash_rate" : 71932494048278.75, "timestamp" : 1680933961551, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "ttxogzylflbrg2x", "last_share_at" : 1680933763, "status" : 0, "host" : "24.41.38.2", "hash_rate" : 98516241848729.6, "timestamp" : 1680933961551, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "50x29x4x129ls1", "last_share_at" : 1680933823, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 90697492495655.83, "timestamp" : 1680933961551, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x230", "last_share_at" : 1680933836, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 114153740554877.16, "timestamp" : 1680933961550, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "50x34x11x101ls2", "last_share_at" : 1680933838, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 103207491460573.86, "timestamp" : 1680933961552, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x230", "last_share_at" : 1680933957, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 116920374941349.42, "timestamp" : 1680934040458, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x95x213", "last_share_at" : 1680933932, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 105372683589117.38, "timestamp" : 1680934040459, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "ttxogzylflbrg2x", "last_share_at" : 1680933959, "status" : 0, "host" : "24.41.38.2", "hash_rate" : 96711915074943.34, "timestamp" : 1680934040459, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "50x34x11x101ls2", "last_share_at" : 1680933949, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 106816145008146.38, "timestamp" : 1680934040459, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x121", "last_share_at" : 1680933926, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 109703067846204.39, "timestamp" : 1680934040455, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x113x188", "last_share_at" : 1680933947, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 116920374941349.42, "timestamp" : 1680934040460, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x129x151", "last_share_at" : 1680933958, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 102485760751059.36, "timestamp" : 1680934040460, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "5x188x105", "last_share_at" : 1680933947, "status" : 0, "host" : "24.223.108.20", "hash_rate" : 76503455208537.27, "timestamp" : 1680934040460, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x137", "last_share_at" : 1680933934, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 106816145008146.38, "timestamp" : 1680934040458, "__v" : 0 },
        { "mining_user_name" : "et3eo7m00nfi", "worker_name" : "sm1", "last_share_at" : 1680933949, "status" : 0, "host" : "24.149.9.218", "hash_rate" : 115476913522320.4, "timestamp" : 1680934040460, "__v" : 0 },
        { "mining_user_name" : "et3eo7m00nfi", "worker_name" : "sm2", "last_share_at" : 1680933927, "status" : 0, "host" : "24.149.9.218", "hash_rate" : 108259606427175.39, "timestamp" : 1680934040461, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "50x29x4x129ls1", "last_share_at" : 1680933934, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 95268453655914.34, "timestamp" : 1680934040459, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "49x19x10x103", "last_share_at" : 1680933873, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 131354989131639.47, "timestamp" : 1680934040460, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x137", "last_share_at" : 1680934179, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 123848989752688.64, "timestamp" : 1680934291694, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "ttxogzylflbrg2x", "last_share_at" : 1680934117, "status" : 0, "host" : "24.41.38.2", "hash_rate" : 90071992547409.92, "timestamp" : 1680934291694, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "50x29x4x129ls1", "last_share_at" : 1680934197, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 93824992236885.33, "timestamp" : 1680934291695, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "50x34x11x101ls2", "last_share_at" : 1680934156, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 112589990684262.4, "timestamp" : 1680934291695, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "49x19x10x103", "last_share_at" : 1680934190, "status" : 0, "host" : "65.65.154.50", "hash_rate" : 138860988510590.3, "timestamp" : 1680934291691, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x121", "last_share_at" : 1680934167, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 99454491771098.45, "timestamp" : 1680934291695, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x78x230", "last_share_at" : 1680934170, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 123848989752688.64, "timestamp" : 1680934291696, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x95x213", "last_share_at" : 1680934157, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 110713490839524.69, "timestamp" : 1680934291696, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x113x188", "last_share_at" : 1680934120, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 112589990684262.4, "timestamp" : 1680934291694, "__v" : 0 },
        { "mining_user_name" : "et3eo7m00nfi", "worker_name" : "sm1", "last_share_at" : 1680934181, "status" : 0, "host" : "24.149.9.218", "hash_rate" : 106960491150049.28, "timestamp" : 1680934291696, "__v" : 0 },
        { "mining_user_name" : "et3eo7m00nfi", "worker_name" : "sm2", "last_share_at" : 1680934196, "status" : 0, "host" : "24.149.9.218", "hash_rate" : 97577991926360.75, "timestamp" : 1680934291696, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x129x151", "last_share_at" : 1680934183, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 95701492081623.05, "timestamp" : 1680934291695, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "5x188x105", "last_share_at" : 1680934179, "status" : 0, "host" : "24.223.108.20", "hash_rate" : 61924494876344.32, "timestamp" : 1680934291696, "__v" : 0 },
        { "mining_user_name" : "mobi2018x66d", "worker_name" : "57x10x113x188", "last_share_at" : 1680934228, "status" : 0, "host" : "12.7.62.233", "hash_rate" : 107472263834977.75, "timestamp" : 1680934351283, "__v" : 0 },
      ];
      setWorkersData(data);
      setFilteredWorkers(data);
    };
    fetchData();
  }, []);

  const handleSearch = (searchQuery) => {
    const filtered = workersData.filter((worker) => {
      return Object.keys(searchQuery).every((key) => {
        return String(worker[key]).toLowerCase().includes(searchQuery[key].toLowerCase());
      });
    });
    setFilteredWorkers(filtered);
  };

  return (
    <Container maxWidth="lg">
      <Box my={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Mining Workers Monitor 0.1
        </Typography>
        <SearchBar onSearch={handleSearch} />
        <WorkerGrid workers={filteredWorkers} />
      </Box>
    </Container>
  );
};

export default App;
