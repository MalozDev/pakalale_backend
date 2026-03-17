import { Router } from 'express';
import { getNotifications, markAsRead } from '../services/notificationService';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Notifications are always private
router.use(protect);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);

export default router;
