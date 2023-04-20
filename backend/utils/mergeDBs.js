const { MongoClient } = require("mongodb");

const SRC_PORT = 27027; // Port of the source MongoDB instance
const DST_PORT = 27037; // Port of the destination MongoDB instance

const mergeCollections = async () => {
  // Connect to the source and destination MongoDB instances
  const srcClient = await MongoClient.connect(`mongodb://root:rootpassword@localhost:${SRC_PORT}?authSource=admin`);
  const dstClient = await MongoClient.connect(`mongodb://root:rootpassword@localhost:${DST_PORT}?authSource=admin`);

  // Specify the source and destination databases
  const srcDb = srcClient.db("miner_monitoring");
  const dstDb = dstClient.db("miner_monitoring");
  console.log("Connected successfully to source and destination databases");
  // Get the list of collection names from the source database
  const collectionNames = await srcDb.listCollections().toArray();
  console.log("Collection names:", collectionNames);
  // Iterate through each collection in the source database
  for (const collectionInfo of collectionNames) {
    if(collectionInfo.name !== "workers") continue;
    const collectionName = collectionInfo.name;
    console.log("Processing collection:", collectionName);
    // Find all documents in the source collection
    const srcCollection = srcDb.collection(collectionName);
    const documents = await srcCollection.find({}).toArray();
    console.log("Documents:", documents);
    if(documents.length === 0) continue;
    // Insert the documents into the destination collection
    const dstCollection = dstDb.collection(collectionName);
    await dstCollection.insertMany(documents);
  }
  console.log("Closing connections.");
  // Close the connections
  srcClient.close();
  dstClient.close();
};

// Execute the merge
mergeCollections()
  .then(() => console.log("Data merged successfully"))
  .catch((error) => console.error("Error merging data:", error));
