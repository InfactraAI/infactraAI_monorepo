const Organization = require('../../models/Organization');

/**
 * Company endpoints now read and write the caller's own Organization, rather
 * than a single global row shared by the whole install. Route paths are
 * unchanged so the frontend's LogoService keeps working.
 */

const publicOrg = (org) => ({
  _id: org._id,
  name: org.name,
  logo: org.logo,
  createdAt: org.createdAt,
  updatedAt: org.updatedAt,
});

exports.getCompany = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    res.json(publicOrg(org));
  } catch (err) {
    next(err);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const { name, logo } = req.body;

    const update = {};
    if (name) update.name = name;
    if (logo !== undefined) update.logo = logo;

    const org = await Organization.findByIdAndUpdate(req.orgId, { $set: update }, { returnDocument: 'after' });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });

    res.json({ message: 'Organisation updated', company: publicOrg(org) });
  } catch (err) {
    next(err);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const base = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const fileUrl = `${base}/uploads/${req.file.filename}`;

    const org = await Organization.findByIdAndUpdate(
      req.orgId,
      { $set: { logo: fileUrl } },
      { returnDocument: 'after' }
    );
    if (!org) return res.status(404).json({ message: 'Organisation not found' });

    res.json({ message: 'Logo uploaded', logo: fileUrl });
  } catch (err) {
    next(err);
  }
};
