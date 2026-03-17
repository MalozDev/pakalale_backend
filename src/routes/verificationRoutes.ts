import { Router } from 'express';
import { submitVerification, reviewVerification } from '../services/verificationService';
import { protect, restrictTo } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// All verification routes require authentication
router.use(protect);

// Shop Owner submitting documents
router.post('/', submitVerification);

// Admins reviewing documents
router.patch('/:id/review', restrictTo('ADMIN'), reviewVerification);

export default router;
