/**
 * MongoDB Atlas Connection Verification & Diagnostic Script
 * Usage: node test-db.js
 */
const path = require('path');
const fs = require('fs');

// Attempt to load environment variables from frontend/.env.local or .env
const envPaths = [
  path.join(__dirname, 'frontend', '.env.local'),
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env'),
  path.join(__dirname, 'frontend', '.env'),
];

const dotenv = (() => {
  try {
    return require('dotenv');
  } catch {
    try {
      return require(path.join(__dirname, 'frontend', 'node_modules', 'dotenv'));
    } catch {
      return null;
    }
  }
})();

let loadedEnvFile = null;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    if (dotenv) {
      dotenv.config({ path: envPath });
      loadedEnvFile = envPath;
      break;
    } else {
      // Fallback simple line parser if dotenv is not present
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
      });
      loadedEnvFile = envPath;
      break;
    }
  }
}

const { MongoClient } = require(path.join(__dirname, 'frontend', 'node_modules', 'mongodb'));

function maskUri(uri) {
  try {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1****$3');
  } catch {
    return 'mongodb+srv://****:****@****';
  }
}

function diagnoseError(err) {
  const msg = err.message || String(err);
  if (/bad auth|Authentication failed/i.test(msg)) {
    return {
      type: 'AUTHENTICATION_FAILED',
      title: 'Invalid Username or Password',
      advice: 'The credentials in MONGODB_URI did not match MongoDB Atlas. Verify username and password in Atlas > Database Access.',
    };
  }
  if (/querySrv ENOTFOUND|ENOTFOUND/i.test(msg)) {
    return {
      type: 'DNS_RESOLUTION_FAILED',
      title: 'Cluster Hostname Unreachable',
      advice: 'DNS could not resolve the cluster hostname. Check the cluster address in MONGODB_URI (e.g. cluster0.vzdgwhc.mongodb.net).',
    };
  }
  if (/timed out|ETIMEDOUT|ServerSelectionTimeout/i.test(msg)) {
    return {
      type: 'IP_NOT_WHITELISTED_OR_TIMEOUT',
      title: 'Network Timeout / IP Blocked',
      advice: 'Connection timed out. In MongoDB Atlas > Network Access, add IP address 0.0.0.0/0 (Allow access from anywhere).',
    };
  }
  if (/MongoParseError/i.test(msg)) {
    return {
      type: 'URI_PARSE_ERROR',
      title: 'Invalid Connection String Format',
      advice: 'The URI structure is malformed. Ensure any special characters (@, #, :, /, etc.) in password are URL-encoded.',
    };
  }
  return {
    type: 'UNKNOWN_ERROR',
    title: 'Unexpected Connection Error',
    advice: msg,
  };
}

async function runTest() {
  console.log('='.repeat(70));
  console.log('  REPROVA — MongoDB Atlas Connection Diagnostic Audit');
  console.log('='.repeat(70));

  if (loadedEnvFile) {
    console.log(`[Config] Loaded environment variables from: ${loadedEnvFile}`);
  } else {
    console.log('[Config] Reading directly from process.env');
  }

  const rawUri = process.env.MONGODB_URI;

  if (!rawUri) {
    console.error('\n❌ ERROR: MONGODB_URI environment variable is NOT set!');
    console.error('Please define MONGODB_URI in frontend/.env.local or your environment.\n');
    process.exit(1);
  }

  console.log(`[Config] Target URI: ${maskUri(rawUri)}`);

  // URI validation checks
  const isSrv = rawUri.startsWith('mongodb+srv://');
  const isStandard = rawUri.startsWith('mongodb://');
  if (!isSrv && !isStandard) {
    console.warn('⚠️  Warning: URI does not start with mongodb+srv:// or mongodb://');
  } else {
    console.log(`[Validation] Protocol: ${isSrv ? 'mongodb+srv:// (Atlas DNS Seedlist)' : 'mongodb://'}`);
  }

  const dbMatch = rawUri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  const dbName = dbMatch ? dbMatch[1] : null;
  if (!dbName) {
    console.warn('⚠️  Warning: Database name not detected before "?" in connection string. Defaulting to "reprova".');
  } else {
    console.log(`[Validation] Configured Database: "${dbName}"`);
  }

  console.log('\n[Connecting] Initiating connection to MongoDB Atlas...');
  const startTime = Date.now();

  const client = new MongoClient(rawUri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });

  try {
    await client.connect();
    const duration = Date.now() - startTime;
    console.log(`✅ [Connected] Successfully connected to Atlas cluster (${duration}ms)!`);

    // Ping test
    console.log('[Ping] Sending admin ping command...');
    const pingStart = Date.now();
    const pingResult = await client.db('admin').command({ ping: 1 });
    const pingDuration = Date.now() - pingStart;

    if (pingResult && pingResult.ok === 1) {
      console.log(`✅ [Ping OK] Cluster responded with ok: 1 (${pingDuration}ms)`);
    } else {
      console.warn(`⚠️ [Ping Warning] Unexpected ping response:`, pingResult);
    }

    // Database and Collection inspection
    const targetDb = client.db(dbName || 'reprova');
    const collections = await targetDb.listCollections().toArray();
    const colNames = collections.map((c) => c.name);
    console.log(`[Database] Database "${targetDb.databaseName}" available.`);
    console.log(`[Collections] Found ${collections.length} collection(s): ${colNames.length > 0 ? colNames.join(', ') : '(empty, ready for users)'}`);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 AUDIT STATUS: SUCCESS — MongoDB Atlas is 100% operational!');
    console.log('='.repeat(70) + '\n');
    await client.close();
    process.exit(0);
  } catch (err) {
    const duration = Date.now() - startTime;
    const diagnosis = diagnoseError(err);

    console.error(`\n❌ [Connection FAILED after ${duration}ms]`);
    console.error(`Error: ${err.message}`);
    console.error(`Category: ${diagnosis.type}`);
    console.error(`Issue: ${diagnosis.title}`);
    console.error(`Actionable Fix: ${diagnosis.advice}\n`);

    try {
      await client.close();
    } catch {
      // Ignore close error
    }
    process.exit(1);
  }
}

runTest();
