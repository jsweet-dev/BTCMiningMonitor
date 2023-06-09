const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  mining_user_name: {type: String, index: true},
  worker_name: {type: String, index: true},
  last_share_at: Number,
  status: {type: Number, index: true},
  host: {type: String, index: true},
  hash_rate: Number,
  timestamp: {type: Number, index: true}, // store the timestamp of when the data was fetched
});

const Worker = mongoose.model('Worker', workerSchema);

const minerStatusSchema = new mongoose.Schema({
  worker_name: {type: String, index: true},
  status: String,
});

const MinerStatus = mongoose.model('MinerStatus', minerStatusSchema, 'minerStatus');

const outageSchema = new mongoose.Schema({
  worker_name: {type: String, index: true},
  outage_start_datetime: Number,
  outage_end_datetime: Number,
  outage_length: Number,
  mining_user_name: {type: String, index: true},
  chart_exists: {type: Boolean, index: true},
});

const Outage = mongoose.model('Outage', outageSchema);



const connectDb = async (caller = '') => {
  // console.log(`Attempting connection to MongoDB ${caller !== '' ? "for " + caller : ''}...`);
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    // console.log('MongoDB connected');
    // console.log('');
    return conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

module.exports = {
  connectDb,
  getDb: () => mongoose.connection,
  Worker,
  MinerStatus,
  Outage,
  ObjectId: mongoose.Types.ObjectId,
};
