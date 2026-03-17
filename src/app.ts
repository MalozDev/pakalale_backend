import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import shopRoutes from './routes/shopRoutes';
import requestRoutes from './routes/requestRoutes';
import feedRoutes from './routes/feedRoutes';
import chatRoutes from './routes/chatRoutes';
import notificationRoutes from './routes/notificationRoutes';
import searchRoutes from './routes/searchRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'tiny'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Pakalale Backend is running.' });
});

// Import and mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shops', shopRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/conversations', chatRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/search', searchRoutes);
// app.use('/api/v1/users', userRoutes);

// Error Handling Middleware
app.use(errorHandler);

export default app;
