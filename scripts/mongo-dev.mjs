/**
 * Starts a throwaway MongoDB on 127.0.0.1:27017 for local development, so the
 * app can run on the real database without installing or dockerising anything.
 *
 *   npm run db:dev     # leave running in its own terminal
 *
 * Data lives in a temporary directory and disappears when this process stops.
 * For anything you want to keep, run a normal mongod or point MONGODB_URI at
 * MongoDB Atlas.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.MONGO_DEV_PORT ?? 27017);
const server = await MongoMemoryServer.create({
  instance: { port, dbName: process.env.MONGODB_DB ?? 'nammasahaay' },
});

console.log(`MongoDB ready at ${server.getUri()}`);
console.log('Add this to .env.local:\n');
console.log(`MONGODB_URI=mongodb://127.0.0.1:${port}`);
console.log(`MONGODB_DB=${process.env.MONGODB_DB ?? 'nammasahaay'}\n`);
console.log('Press Ctrl+C to stop. All data is discarded on exit.');

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
