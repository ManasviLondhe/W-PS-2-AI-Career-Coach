import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

export async function connectDatabase() {
  const uri = env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    try {
      console.log('Connecting to specified MongoDB URI...');
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('Successfully connected to MongoDB.');
      return mongoose.connection;
    } catch (err) {
      console.warn(`Connection to configured MONGODB_URI failed (${err.message}). Falling back to in-memory database...`);
    }
  }

  // Fallback to MongoMemoryServer for standalone zero-config reliability
  try {
    console.log('Starting in-memory MongoDB server for local development/testing...');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    await mongoose.connect(memUri);
    console.log('Successfully connected to in-memory MongoDB instance.');
    return mongoose.connection;
  } catch (memErr) {
    console.error('Failed to initialize in-memory MongoDB:', memErr.message);
    throw memErr;
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop();
    }
    console.log('Database disconnected successfully.');
  } catch (err) {
    console.error('Error during database disconnection:', err.message);
  }
}
