const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch {}
}

const rootScript = path.join(__dirname, '..', 'test-db.js');
if (fs.existsSync(rootScript)) {
  require(rootScript);
}
