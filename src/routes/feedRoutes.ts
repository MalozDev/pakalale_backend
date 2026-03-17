import { Router } from 'express';
import { 
  createPost, 
  getFeed, 
  getPost 
} from '../services/feedService';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Public routes (anyone can scroll the feed)
router.get('/', getFeed);
router.get('/:id', getPost);

// Protected routes (must be logged in to post on the feed)
router.use(protect);
router.post('/', createPost);

export default router;
