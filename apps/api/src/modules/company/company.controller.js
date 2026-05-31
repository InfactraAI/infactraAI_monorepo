const XLSX = require('xlsx');
const fs = require('fs');
const Company = require('../../models/Company');

exports.getCompany = async (_req, res, next) => {
  try {
    let company = await Company.findOne();
    if (!company) company = await Company.create({ name: 'Demo Company' });
    res.json(company);
  } catch (err) {
    next(err);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const { name, logo } = req.body;
    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({ name, logo });
    } else {
      if (name) company.name = name;
      if (logo) company.logo = logo;
      await company.save();
    }
    res.json({ message: 'Company updated', company });
  } catch (err) {
    next(err);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    // Build URL from env so it works in any environment
    const base = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const fileUrl = `${base}/uploads/${req.file.filename}`;

    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({ logo: fileUrl });
    } else {
      company.logo = fileUrl;
      await company.save();
    }
    res.json({ message: 'Logo uploaded', logo: fileUrl });
  } catch (err) {
    next(err);
  }
};

exports.uploadExcelData = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const formatted = data.map((item) => ({ name: item.name || 'Demo Company', logo: item.logo || '' }));

    await Company.insertMany(formatted);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ message: 'Data imported', count: formatted.length });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
};
