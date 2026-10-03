import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

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

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reprova';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
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
    // If index already exists with compatible options, continue safely
    console.warn('MongoDB index initialization note:', error);
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

export default clientPromise;
