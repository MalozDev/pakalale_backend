import 'dotenv/config';
import http from 'http';
import app from './app'; // Needs '.js' extension depending on ts/esm setup or bundler, keeping standard ts imports

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize WebSockets
import { initSocket } from './events/socket';
initSocket(server);

// Start listening for Kafka Background Events
import { startEventSubscriber } from './events/eventSubscriber';
startEventSubscriber();

server.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle generic unhandled rejections to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: Graceful shutdown
  // server.close(() => process.exit(1));
});
