const express = require('express');
const router = express.Router();
const { getMinerStatistics, getOutages } = require('./dbFunctions');
const { generateDetailedPDF, generatePDF } = require('./reportFunctions');

// api.js
router.post('/workers', async (req, res) => {
  try {
    // console.log("Post to /workers")
    const { host, status, startTime, endTime, workerName, miningUserName } = req.body;
    // console.log(`Received: host: ${host}  status: ${status}, startTime: ${startTime}, endTime: ${endTime}, workerName: ${workerName}, miningUserName: ${miningUserName}`)
    const workers = await getMinerStatistics(host, workerName, status, startTime, endTime, miningUserName);
    //console.log(workers);
    res.json(workers);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving workers', error: error });
  }
});

router.post('/outages', async (req, res) => {
  try {
    // console.log("Post to /outages")
    const { startTime, endTime } = req.body;
    // console.log(`Received: startTime: ${startTime}, endTime: ${endTime}`)
    const outages = await getOutages(startTime, endTime);
    // console.log(outages);
    res.json(outages);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving outages', error: error });
  }
});

router.post('/reports/detailed', async (req, res) => {
  try {
    console.log("Post to /reports/detailed")
    const { searchTerm } = req.body;
    const startTime = new Date(searchTerm.dateRange.startDate).getTime();
    const endTime = new Date(searchTerm.dateRange.endDate).getTime();

    const outages = await getOutages(startTime, endTime);
    const pdfBlob = await generateDetailedPDF(outages, searchTerm);
    console.log("Finished generating PDF");
    res.send(pdfBlob);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving detailed report', error: error });
  }
});

router.post('/reports/summary', async (req, res) => {
  try {
    console.log("Post to /reports/summary")
    const { searchTerm } = req.body;
    const startTime = new Date(searchTerm.dateRange.startDate).getTime();
    const endTime = new Date(searchTerm.dateRange.endDate).getTime();

    const outages = await getOutages(startTime, endTime);
    const pdfBlob = await generatePDF(outages, searchTerm);
    console.log("Finished generating PDF");
    res.send(pdfBlob);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving detailed report', error: error });
  }
});

// router.post('/worker/:workerId/stats', async (req, res) => {
//   try {
//     const { workerId } = req.params;
//     const stats = await dbFunctions.getWorkerStats(workerId);
//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ message: 'Error retrieving worker stats' });
//   }
// });

module.exports = router;