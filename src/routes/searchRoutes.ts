import { Router } from 'express';
import { searchPlatform } from '../services/searchService';

const router = Router();

// Publicly available search endpoint
// Example: GET /api/v1/search?q=sneakers
router.get('/', searchPlatform);

export default router;
