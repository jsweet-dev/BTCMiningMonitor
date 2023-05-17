const { generateDetailedPDF, generatePDF } = require('./reportFunctions');
const { getOutages, logMsg } = require('./dbFunctions');

const MAX_CHUNK_SIZE = 1024 * 1024; // 1 MB

process.on('message', async (data) => {
    if (data.type === 'exit') {
        logMsg((data.success ? "Successful - " : "Failed - ") + "Exiting child process for Job ID: " + data.jobId);
        process.exit();
    } else {
        const { type, searchTerm, jobId } = data;
        logMsg(`Child Spawned for ${type} report. Job ID: ${jobId}`);
        const startTime = new Date(searchTerm.dateRange.startDate).getTime();
        const endTime = new Date(searchTerm.dateRange.endDate).getTime();
        const outages = await getOutages(startTime, endTime);

        try {
            let pdfBlob;
            if (type === 'detailed') {
                logMsg("Generating detailed PDF")
                pdfBlob = await generateDetailedPDF(outages, searchTerm);
            } else if (type === 'summary') {
                pdfBlob = await generatePDF(outages, searchTerm);
            }
            logMsg("Finished generating PDF");
            // logMsg("Preview of PDF Blob: " + pdfBlob.slice(0, 100));
            // process.send({ jobId, pdfBlob });
            try {
                const pdfBuffer = pdfBlob; // assuming you already have the PDF as a buffer

                const totalChunks = Math.ceil(pdfBuffer.length / MAX_CHUNK_SIZE);
                logMsg(`Preparing to send ${pdfBlob.length} in  ${totalChunks} chunks`);
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * MAX_CHUNK_SIZE;
                    const end = start + MAX_CHUNK_SIZE;
                    const chunk = pdfBuffer.slice(start, end);
                    const base64Chunk = chunk.toString('base64');
                    logMsg(`Sending chunk ${i+1} of ${totalChunks}`);
                    process.send({
                        jobId,
                        chunk: base64Chunk,
                        chunkIndex: i,
                        totalChunksExpected: totalChunks,
                    });
                    logMsg(`Chunk ${i} of ${totalChunks} has been sent`);
                }
            } catch (error) {
                process.send({ jobId, error });
            }
        } catch (error) {
            logMsg("Error generating PDF");
            process.send({ jobId, error });
        }
    }
});
