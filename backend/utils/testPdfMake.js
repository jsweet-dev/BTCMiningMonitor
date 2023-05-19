
var http = require('http');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;


var app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false }));

const getTableLayouts = () => {
    return {
        summaryTable: {
            fillColor: function (rowIndex, node, columnIndex) {
                return (rowIndex % 2 === 0) ? '#CCCCCC' : null;
            },
            hLineWidth: function (i, node) {
                return (i === 0 || i === node.table.headerRows || i === node.table.body.length) ? 2 : 0;
            },
            vLineWidth: function (i) {
                return 0;
            },
            hLineColor: function (i) {
                return i === 1 ? 'black' : '#aaa';
            },
            paddingLeft: function (i) {
                return 5
            },
            paddingTop: function (i) {
                return 5
            },
            paddingBottom: function (i) {
                return 5
            },
            paddingRight: function (i) {
                return 5
            },
        }
    };
};

async function createPdfBinary(pdfDoc) {
    try{
        pdfMake.tableLayouts = getTableLayouts();
        console.log(`docDefinition = ${JSON.stringify(pdfDoc)}`)
        const doc = pdfMake.createPdf(pdfDoc);
    
        const pdfBlob = await new Promise((resolve, reject) => {
            doc.getBuffer((buffer) => {
    
                resolve(buffer);
            });
        });
        return pdfBlob;
    } catch (err) {
        console.log(`Error creating PDF: ${err}`);
        return "No PDF for you!";
    }
}

app.post('/pdf', function (req, res) {
	const {dd} = req.body;
	createPdfBinary(dd).then((pdfBlob) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
        res.send(pdfBlob.toString('base64'));
    });
});

var server = http.createServer(app);
var port = process.env.PORT || 1234;
server.listen(port);

console.log('http server listening on %d', port);