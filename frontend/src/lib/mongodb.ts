import { MongoClient, Db, Collection, ObjectId, MongoClientOptions } from 'mongodb';

export interface UserDocument {
  _id?: ObjectId;
  username: string; // unique, 3-24 chars, [a-zA-Z0-9_]
  email: string; // unique, lowercase, validated
  passwordHash: string | null; // null for Google-only accounts
  image: string | null;
  provider: 'credentials' | 'google';
  createdAt: Date;
  lastLoginAt: Date;
}

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    'Missing MONGODB_URI environment variable. Please define MONGODB_URI in frontend/.env.local or in your hosting environment settings (e.g. Vercel).'
  );
}

// Recommended production pool options for MongoDB Node.js driver v6
const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
};

/**
 * Safely masks credentials in MongoDB URI for logging purposes.
 */
export function maskMongoUri(connectionUri: string): string {
  try {
    return connectionUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1****$3');
  } catch {
    return 'mongodb+srv://****:****@****';
  }
}

/**
 * Diagnoses common MongoDB connection errors and provides actionable advice.
 */
export function diagnoseMongoError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/bad auth|Authentication failed/i.test(msg)) {
    return 'Authentication failed: Database username or password in MONGODB_URI is incorrect. Verify credentials in MongoDB Atlas > Database Access.';
  }
  if (/querySrv ENOTFOUND|ENOTFOUND/i.test(msg)) {
    return 'DNS lookup failed: The cluster hostname in MONGODB_URI could not be resolved. Verify the cluster address.';
  }
  if (/timed out|ETIMEDOUT|ServerSelectionTimeout/i.test(msg)) {
    return 'Connection timed out: MongoDB Atlas is unreachable. Ensure IP address 0.0.0.0/0 (Allow access from anywhere) is whitelisted in Atlas > Network Access.';
  }
  if (/MongoParseError/i.test(msg)) {
    return 'URI parsing failed: MONGODB_URI format is invalid. Ensure special characters in password are URL-encoded and it starts with mongodb+srv://.';
  }
  return 'Connection failed due to unexpected database error.';
}

let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function connectClient(mongoUri: string, mongoOptions: MongoClientOptions): Promise<MongoClient> {
  const clientInstance = new MongoClient(mongoUri, mongoOptions);
  const masked = maskMongoUri(mongoUri);

  return clientInstance
    .connect()
    .then((connected) => {
      console.log(`[MongoDB] Connected successfully to ${masked}`);
      return connected;
    })
    .catch((err) => {
      const diagnosis = diagnoseMongoError(err);
      console.error(`[MongoDB] Connection Failed to ${masked}`);
      console.error(`[MongoDB] Details: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`[MongoDB] Diagnosis: ${diagnosis}`);
      throw err;
    });
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve connection across HMR.
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = connectClient(uri, options);
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, connect per standard runtime lifecycle.
  clientPromise = connectClient(uri, options);
}

let indexesCreated = false;

/**
 * Ensures unique indexes on `email` and `username` exist idempotently.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  if (indexesCreated) return;
  try {
    const users = db.collection<UserDocument>('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ username: 1 }, { unique: true });
    indexesCreated = true;
  } catch (error) {
    console.warn('[MongoDB] Index initialization note:', error);
  }
}

/**
 * Helper to obtain the database instance with indexes ensured.
 */
export async function getDb(dbName = 'reprova'): Promise<Db> {
  const connectedClient = await clientPromise;
  const db = connectedClient.db(dbName);
  await ensureIndexes(db);
  return db;
}

/**
 * Helper to obtain the `users` collection.
 */
export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const db = await getDb();
  return db.collection<UserDocument>('users');
}

/**
 * Diagnostic ping helper to verify database connectivity.
 */
export async function pingDatabase(): Promise<{ ok: boolean; message: string; pingResult?: any }> {
  try {
    const connectedClient = await clientPromise;
    const adminDb = connectedClient.db().admin();
    const result = await adminDb.ping();
    return { ok: true, message: 'Ping successful', pingResult: result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export default clientPromise;
