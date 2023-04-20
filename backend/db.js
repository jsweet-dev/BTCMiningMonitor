const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  mining_user_name: String,
  worker_name: String,
  last_share_at: Number,
  status: Number,
  host: String,
  hash_rate: Number,
  timestamp: Number, // store the timestamp of when the data was fetched
});

workerSchema.index({ timestamp: 1 });
workerSchema.index({ status: 1 });


const Worker = mongoose.model('Worker', workerSchema);

const minerStatusSchema = new mongoose.Schema({
  worker_name: String,
  status: String,
});

const MinerStatus = mongoose.model('MinerStatus', minerStatusSchema, 'minerStatus');

const outageSchema = new mongoose.Schema({
  worker_name: String,
  outage_start_datetime: Number,
  outage_end_datetime: Number,
  outage_length: Number,
});

const Outage = mongoose.model('Outage', outageSchema);

const OutageLogSchema = new mongoose.Schema({
  worker_name: String,
  outage_start_datetime: Date,
  outage_end_datetime: Date,
  outage_length: Number,
  related_status_page_incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StatusPageIncident',
  },
  snapshot_image: Buffer,
  timestamp: Date,
});

// Create the OutageLog model based on the schema
const OutageLog = mongoose.model('OutageLog', OutageLogSchema);

const connectDb = async (caller = '') => {
  console.log(`Attempting connection to MongoDB ${caller !== '' ? "for " + caller : ''}...`);
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    console.log('');
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
  OutageLog,
};
