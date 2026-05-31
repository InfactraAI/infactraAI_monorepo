require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const User    = require('../src/models/User');
const Company = require('../src/models/Company');

const FRESH = process.argv.includes('--fresh');
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/infactra_db';

const USERS = [
  { name: 'Super Admin', email: 'admin@infactra.ai', password: 'Admin@123', mobile: '9000000001', role: 'ADMIN', address: 'HQ, Mumbai' },
  { name: 'Demo User',   email: 'user@infactra.ai',  password: 'User@123',  mobile: '9000000002', role: 'USER',  address: 'Branch, Delhi' },
];

async function seed() {
  await mongoose.connect(MONGO);
  console.log('✅ MongoDB connected');

  if (FRESH) {
    await User.deleteMany({});
    await Company.deleteMany({});
    console.log('🗑  Cleared existing data');
  }

  for (const u of USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) { console.log(`⏭  Already exists: ${u.email}`); continue; }
    await User.create({ ...u, password: await bcrypt.hash(u.password, 12) });
    console.log(`👤 Created ${u.role}: ${u.email}  /  ${u.password}`);
  }

  if (!(await Company.findOne())) {
    await Company.create({ name: 'Infactra Technologies Pvt Ltd', logo: '' });
    console.log('🏢 Created company record');
  }

  console.log('\n🎉 Seed complete!');
  console.log('┌───────────────────────────────────────────┐');
  console.log('│  ADMIN  admin@infactra.ai  /  Admin@123   │');
  console.log('│  USER   user@infactra.ai   /  User@123    │');
  console.log('└───────────────────────────────────────────┘\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
