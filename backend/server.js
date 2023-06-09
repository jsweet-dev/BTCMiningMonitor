require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRouter = require('./api.js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const screenshotsDir = process.env.SCREENSHOT_PATH;
app.use('/screenshots', express.static(screenshotsDir));

app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
