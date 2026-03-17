import { Router } from 'express';
import { 
  createRequest, 
  getAllRequests, 
  getRequestDetails 
} from '../services/requestService';
import { 
  respondToRequest, 
  closeRequest 
} from '../services/responseService';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getAllRequests);
router.get('/:id', getRequestDetails);

// Protected routes
router.use(protect);
router.post('/', createRequest);

// Dedicated nested routes for Responses and state transitions
router.post('/:requestId/responses', respondToRequest);
router.patch('/:requestId/close', closeRequest);

export default router;
