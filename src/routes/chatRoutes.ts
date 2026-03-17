import { Router } from 'express';
import { 
  startConversation, 
  getConversations, 
  getMessages, 
  sendMessage 
} from '../services/chatService';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Chat requires authentication for all actions
router.use(protect);

router.post('/', startConversation);
router.get('/', getConversations);

// Message interactions inside a conversation
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/messages', sendMessage);

export default router;
