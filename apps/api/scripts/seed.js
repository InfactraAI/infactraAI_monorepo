require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const Organization = require('../src/models/Organization');
const User         = require('../src/models/User');

const FRESH = process.argv.includes('--fresh');
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/infactra_db';

// Two organisations, so tenant isolation is visible the moment you sign in
// as each and see entirely separate data.
const ORGS = [
  {
    name: 'Acme Exports Pvt Ltd',
    users: [
      { name: 'Acme Admin', email: 'admin@acme.test', password: 'Admin@123', mobile: '9000000001', role: 'ADMIN', address: 'HQ, Mumbai' },
      { name: 'Acme Analyst', email: 'analyst@acme.test', password: 'User@123', mobile: '9000000002', role: 'USER', address: 'Branch, Delhi' },
    ],
  },
  {
    name: 'Northwind Traders',
    users: [
      { name: 'Northwind Admin', email: 'admin@northwind.test', password: 'Admin@123', mobile: '9000000003', role: 'ADMIN', address: 'HQ, Pune' },
    ],
  },
];

async function seed() {
  await mongoose.connect(MONGO);
  console.log('✅ MongoDB connected');

  if (FRESH) {
    await Promise.all([User.deleteMany({}), Organization.deleteMany({})]);
    console.log('🗑  Cleared users and organisations');
  }

  for (const spec of ORGS) {
    let org = await Organization.findOne({ name: spec.name });
    if (!org) {
      org = await Organization.create({ name: spec.name });
      console.log(`🏢 Created organisation: ${spec.name}`);
    } else {
      console.log(`⏭  Organisation exists: ${spec.name}`);
    }

    for (const u of spec.users) {
      if (await User.findOne({ email: u.email })) {
        console.log(`   ⏭  ${u.email}`);
        continue;
      }
      const user = await User.create({
        ...u,
        orgId: org._id,
        password: await bcrypt.hash(u.password, 12),
      });
      if (u.role === 'ADMIN' && !org.ownerId) {
        org.ownerId = user._id;
        await org.save();
      }
      console.log(`   👤 ${u.role.padEnd(5)} ${u.email}  /  ${u.password}`);
    }
  }

  console.log('\n🎉 Seed complete — sign in as each org to confirm they see different data.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
