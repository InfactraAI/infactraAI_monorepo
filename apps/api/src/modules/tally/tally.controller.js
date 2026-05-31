const axios = require('axios');
const xml2js = require('xml2js');

const LEDGER_XML = `
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC><REPORTNAME>List of Ledgers</REPORTNAME></REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

exports.connectTally = async (req, res, next) => {
  try {
    const { host, port } = req.body;
    const xmlRes = await axios.post(`http://${host}:${port}`, LEDGER_XML, {
      headers: { 'Content-Type': 'application/xml' },
    });
    const data = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(xmlRes.data);
    res.json({ success: true, data });
  } catch (err) {
    const tallyErr = new Error('Tally not reachable');
    tallyErr.status = 502;
    next(tallyErr);
  }
};
