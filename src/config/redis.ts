import { createClient } from 'redis';

// Create a Redis client.
// This will be used for feed caching and fast geo queries.
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect automatically on initialization
(async () => {
  try {
    await redisClient.connect();
    console.log('Redis successfully connected');
  } catch (err) {
    console.error('Failed to connect to Redis', err);
  }
})();

export default redisClient;
