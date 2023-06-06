let debugLevel = 4;

const setDebugLevel = (level) => {
  debugLevel = level;
}

const logMsg = (msg, msgLevel=7, logLevel=debugLevel) => {
  if (msgLevel <= logLevel){
    console.log(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " " + msg);
  }
}

module.exports = {
    logMsg,
    setDebugLevel
};
