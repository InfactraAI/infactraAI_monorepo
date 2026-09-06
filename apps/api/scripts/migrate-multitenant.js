/**
 * Backfills the single-tenant database into the organisation model.
 *
 *   node scripts/migrate-multitenant.js [--dry-run] [--org-name "Acme Ltd"]
 *
 * Every existing user, dataset and connection is folded into one default
 * organisation built from the old singleton Company row. Safe to re-run:
 * documents that already carry an orgId are left alone.
 */
require('dotenv').config();

const mongoose = require('mongoose');

const Organization = require('../src/models/Organization');
const User = require('../src/models/User');
const FileData = require('../src/models/FileData');
const UserToken = require('../src/models/UserToken');
const GoogleConnection = require('../src/models/GoogleConnection');

const DRY = process.argv.includes('--dry-run');
const nameFlag = process.argv.indexOf('--org-name');
const ORG_NAME_OVERRIDE = nameFlag > -1 ? process.argv[nameFlag + 1] : null;
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/infactra_db';

const log = (...a) => console.log(...a);

/** Stale indexes from the single-tenant schema that block the new ones. */
const STALE_INDEXES = [
  ['filedatas', 'fileName_1'],       // was globally unique
  ['usertokens', 'userId_1'],        // now keyed by orgId
  ['googleconnections', 'userId_1'], // now keyed by orgId
];

async function dropStaleIndexes(db) {
  for (const [collName, indexName] of STALE_INDEXES) {
    const exists = await db.listCollections({ name: collName }).hasNext();
    if (!exists) continue;

    const indexes = await db.collection(collName).indexes();
    if (!indexes.some((i) => i.name === indexName)) continue;

    log(`  drop index ${collName}.${indexName}`);
    if (!DRY) await db.collection(collName).dropIndex(indexName);
  }
}

async function resolveDefaultOrg(db) {
  const existing = await Organization.findOne().sort({ createdAt: 1 });
  if (existing) {
    log(`  reusing organisation "${existing.name}"`);
    return existing;
  }

  // The old Company singleton held the install's name and logo.
  const hasCompanies = await db.listCollections({ name: 'companies' }).hasNext();
  const company = hasCompanies ? await db.collection('companies').findOne({}) : null;

  const name = ORG_NAME_OVERRIDE || company?.name || 'Default Organisation';
  const logo = company?.logo || '';

  log(`  create organisation "${name}"${company ? ' (from Company row)' : ''}`);
  if (DRY) return { _id: new mongoose.Types.ObjectId(), name, logo };

  return Organization.create({ name, logo });
}

async function backfill(Model, label, orgId) {
  const filter = { $or: [{ orgId: { $exists: false } }, { orgId: null }] };
  const count = await Model.countDocuments(filter);

  if (!count) {
    log(`  ${label}: nothing to backfill`);
    return;
  }

  log(`  ${label}: ${count} document(s) → orgId ${orgId}`);
  if (!DRY) await Model.updateMany(filter, { $set: { orgId } });
}

async function run() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;
  log(`Connected to ${MONGO}`);
  if (DRY) log('\n*** DRY RUN — no writes ***');

  log('\nIndexes');
  await dropStaleIndexes(db);

  log('\nOrganisation');
  const org = await resolveDefaultOrg(db);

  log('\nBackfill');
  await backfill(User, 'users', org._id);
  await backfill(FileData, 'filedata', org._id);
  await backfill(UserToken, 'usertokens', org._id);
  await backfill(GoogleConnection, 'googleconnections', org._id);

  // The first admin becomes the organisation owner.
  if (!DRY && !org.ownerId) {
    const owner =
      (await User.findOne({ orgId: org._id, role: 'ADMIN' }).sort({ createdAt: 1 })) ||
      (await User.findOne({ orgId: org._id }).sort({ createdAt: 1 }));

    if (owner) {
      org.ownerId = owner._id;
      await org.save();
      log(`\n  owner set to ${owner.email}`);
    }
  }

  // usertokens was unique per user and is now unique per org. If an install
  // had several users each holding OneDrive tokens, they collide — report it
  // rather than silently dropping someone's connection.
  const tokenDocs = await UserToken.countDocuments({ orgId: org._id });
  if (tokenDocs > 1) {
    log(
      `\n  ⚠ ${tokenDocs} OneDrive token documents now share one organisation.\n` +
      '    The unique index on orgId will reject all but one. Merge their\n' +
      '    oneDrives arrays manually, or delete the duplicates and reconnect.'
    );
  }

  log('\nCollections no longer used by the app: sessions, tokens, azureconfigs.');
  log('Left in place — drop them yourself once you have confirmed the migration.');

  log(DRY ? '\nDry run complete.' : '\n✅ Migration complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('❌ Migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
