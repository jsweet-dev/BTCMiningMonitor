const express = require('express');
const router = express.Router();
const { getMinerStatistics, getOutages } = require('./dbFunctions');
const { logMsg, setDebugLevel } = require('./logFunctions');
const { v4: uuidv4 } = require('uuid');
const { fork } = require('child_process');
const reportWorkerPath = require.resolve('./reportWorker.js');

const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:172.19.0.1']; // Add any other IPs you wish to allow
const secureRoute = (req, res, next) => {
    const clientIP = req.connection.remoteAddress;
    if (!allowedIPs.includes(clientIP)) {
        res.status(403).json({message: 'Access Forbidden for ' + clientIP});
    } else {
        next();
    }
};

router.put('/debugLevel', secureRoute, async (req, res) => {
  try {
    logMsg("Put to /debugLevel", 4)
    const { debugLevel } = req.body;
    setDebugLevel(debugLevel);
    logMsg(`Sending response confirming debugLevel ${debugLevel}`, 4);
    res.json({ debugLevel });
  } catch (error) {
    logMsg(`Sending 500 repsonse for put to /debugLevel: ${error.message}`, 1);
    res.status(500).json({ message: 'Error setting debugLevel', error: error.message });
  }
});

router.post('/workers', async (req, res) => {
  try {
    logMsg("Post to /workers",4)
    const { host, status, startTime, endTime, workerName, miningUserName } = req.body;
    const workers = await getMinerStatistics(host, workerName, status, startTime, endTime, miningUserName);
    logMsg(`Sending response with ${workers.length} workers`, 4);
    res.json(workers);
  } catch (error) {
    logMsg(`Sending 500 repsonse for post to /workers: ${error.message}`, 1);
    res.status(500).json({ message: 'Error retrieving workers', error: error.message });
  }
});

router.post('/outages', async (req, res) => {
  try {
    logMsg("Post to /outages",4);
    const { startTime, endTime } = req.body;
    const outages = await getOutages(startTime, endTime);
    logMsg(`Sending response with ${outages.length} outages`, 1);
    res.json(outages);
  } catch (error) {
    logMsg(`Sending 500 repsonse for post to /outages: ${error.message}`, 1);
    res.status(500).json({ message: 'Error retrieving outages', error: error });
  }
});

const jobs = new Map(); //Track background report generation jobs

const handleChildProcess = (child, jobId) => {
  logMsg("Handling child process Job ID: " + jobId, 7)

  const handleChildMessage = (message) => {
    logMsg("Received message from child process", 7)// + JSON.stringify(message));
    const { jobId, chunk, chunkIndex, totalChunksExpected, error } = message;
    logMsg("Job ID: " + jobId + " Chunk: " + Boolean(chunk) + " Chunk Index: " + chunkIndex + " Total Chunks Expected: " + totalChunksExpected + " Error: " + error, 7);
    const jobDetails = jobs.get(jobId);
    let { pdfChunks, totalChunks } = jobDetails;
    logMsg("pdfChunks length: " + pdfChunks.length + " totalChunks: " + totalChunks, 7);
    if (chunk) {
      logMsg("Chunk received for Job ID: " + jobId, 7);
      pdfChunks[chunkIndex] = Buffer.from(chunk, 'base64');
      totalChunks++;

      if (pdfChunks.length === totalChunksExpected) {
        logMsg("All chunks received for Job ID: " + jobId, 7);
        const pdfBlob = Buffer.concat(pdfChunks);
        jobs.set(jobId, { ...jobDetails, status: 'completed', pdfBlob });
        child.send({ type: 'exit', jobId, success: true });
      } else {
        logMsg("Adding chunk to job details for Job ID: " + jobId, 7);
        jobs.set(jobId, { ...jobDetails, pdfChunks, totalChunks });
      }
    } else if (error) {
      logMsg("Error received for Job ID: " + jobId + " Error: " + error, 1);
      jobs.set(jobId, { ...jobDetails, status: 'error', error });
      child.send({ type: 'exit' });
    }
  };

  child.on('message', handleChildMessage);

  child.once('exit', () => {
    if(jobs.get(jobId) && (jobs.get(jobId)?.status !== 'completed' && jobs.get(jobId)?.status !== 'error')) {
      logMsg("Child process exited unexpectedly", 1);
      jobs.set(jobId, { status: 'error', error: 'Child process exited unexpectedly' });
    }
    child.removeListener('message', handleChildMessage);
  });
};

const processUsingChild = (type, searchTerm) => {
  const jobId = uuidv4();
  const processingJobs = Array.from(jobs.values()).filter((job) => job.status === 'processing');

  if (processingJobs.length >= 2) {
    return null;
  } else {
    jobs.set(jobId, { status: 'waiting', searchTerm, type, pdfChunks: [], totalChunks: 0 });
    const child = fork(reportWorkerPath, [], {
      execArgv: ['--max_old_space_size=2048'],
    });
    child.send({ type, searchTerm, jobId });
    const jobDetails = jobs.get(jobId);
    jobs.set(jobId, { ...jobDetails, status: 'processing' });
    handleChildProcess(child, jobId);
    return jobId;
  }
}

router.post('/reports/detailed', async (req, res) => {
  try {
    logMsg("Post to /reports/detailed", 4)
    const { searchTerm } = req.body;
    const jobId = processUsingChild('detailed', searchTerm);
    if (jobId === null) {
      logMsg(`Too many jobs @ /reports/detailed`, 4)
      res.status(503).json({ message: 'Too many jobs in progress' });
    } else {
      logMsg(`Sending response with jobId: ${jobId}`, 1);
      res.status(202).json({ jobId });
    }
  } catch (error) {
    logMsg(`Sending error response: ${error}`, 1);
    res.status(500).json({ message: 'Error retrieving detailed report', error: error });
  }
});

router.post('/reports/summary', async (req, res) => {
  try {
    logMsg("Post to /reports/summary", 4)
    const { searchTerm } = req.body;
    const jobId = processUsingChild('summary', searchTerm);

    if (jobId === null) {
      logMsg(`Too many jobs @ /reports/summary`, 4)
      res.status(503).json({ message: 'Too many jobs in progress' });
    } else {
      logMsg(`Sending response with jobId: ${jobId}`, 1);
      res.status(202).json({ jobId });
    }
  } catch (error) {
    logMsg(`Sending error response: ${error}`, 1);
    res.status(500).json({ message: 'Error retrieving detailed report', error: error });
  }
});

router.get('/reports/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  logMsg(`Get to /reports/status/${jobId}`, 4);
  if (jobId === 'all') {
    const replacer = (key, value) => {
      if (value instanceof Map) {
        return {
          length: value.size,
          data: Array.from(value.entries()),
        };
      } else {
        return value;
      }
    }
    res.status(200).json(JSON.stringify(jobs, replacer));
  } else {
    const job = jobs.get(jobId);
    if (!job) {
      logMsg(`Sending 404 response for jobId: ${jobId}`, 1);
      res.status(404).json({ message: 'Job not found' });
    } else if (job.status === 'completed') {
      pdfToSend = job.pdfBlob;
      logMsg("pdfToSend type: " + typeof pdfToSend + " length: " + pdfToSend.length, 7);
      logMsg("Sending PDF to client.", 1);// Preview: " + pdfToSend.slice(0, 100) + "...", 7);
      jobs.delete(jobId);
        res.status(200).json(pdfToSend);
    } else if (job.status === 'processing') {
      logMsg(`Sending 202 response for jobId: ${jobId}`, 1);
      res.status(202).json({ message: 'Report is being generated' });
    } else {
      logMsg(`Sending 500 response for jobId: ${jobId}`, 1);
      res.status(500).json({ message: 'Error generating report', error: job.error });
    }
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