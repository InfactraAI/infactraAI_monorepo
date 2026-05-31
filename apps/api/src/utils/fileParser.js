const axios = require('axios');
const XLSX = require('xlsx');

exports.parseExcelFromUrl = async (downloadUrl) => {
  const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  const workbook = XLSX.read(response.data, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
};
