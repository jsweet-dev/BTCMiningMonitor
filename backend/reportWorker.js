const { generateDetailedPDF, generatePDF } = require('./reportFunctions');
const { getOutages } = require('./dbFunctions');
const { logMsg } = require('./logFunctions');

const MAX_CHUNK_SIZE = 1024 * 1024; // 1 MB

process.on('message', async (data) => {
    if (data.type === 'exit') {
        logMsg((data.success ? "Successful - " : "Failed - ") + "Exiting child process for Job ID: " + data.jobId, 1);
        process.exit();
    } else {
        const { type, searchTerm, jobId } = data;
        logMsg(`Child Spawned for ${type} report. Job ID: ${jobId}`, 4);
        const startTime = new Date(searchTerm.dateRange.startDate).getTime();
        const endTime = new Date(searchTerm.dateRange.endDate).getTime();
        const outages = await getOutages(startTime, endTime);

        try {
            let pdfBlob;
            if (type === 'detailed') {
                logMsg("Generating detailed PDF", 1)
                pdfBlob = await generateDetailedPDF(outages, searchTerm);
            } else if (type === 'summary') {
                logMsg("Generating summary PDF", 1)
                pdfBlob = await generatePDF(outages, searchTerm);
            }
            logMsg("Finished generating PDF", 1);
            logMsg("Preview of PDF Blob: " + pdfBlob.slice(0, 100), 8);
            try {
                const pdfBuffer = pdfBlob; // assuming you already have the PDF as a buffer

                const totalChunks = Math.ceil(pdfBuffer.length / MAX_CHUNK_SIZE);
                logMsg(`Preparing to send ${pdfBlob.length} in  ${totalChunks} chunks`, 7);
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * MAX_CHUNK_SIZE;
                    const end = start + MAX_CHUNK_SIZE;
                    const chunk = pdfBuffer.slice(start, end);
                    const base64Chunk = chunk.toString('base64');
                    logMsg(`Sending chunk ${i+1} of ${totalChunks}`, 7);
                    process.send({
                        jobId,
                        chunk: base64Chunk,
                        chunkIndex: i,
                        totalChunksExpected: totalChunks,
                    });
                    logMsg(`Chunk ${i} of ${totalChunks} has been sent`, 7);
                }
            } catch (error) {
                process.send({ jobId, error });
            }
        } catch (error) {
            logMsg("Error generating PDF", 1);
            process.send({ jobId, error });
        }
    }
});
