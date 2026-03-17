import { Router } from 'express';
import { createReview, getShopReviews } from '../services/reviewService';
import { protect } from '../middleware/authMiddleware';

// Important: Note that we mount this router inside ShopRoutes in `app.ts` conceptually 
// e.g. /api/v1/shops/:shopId/reviews so we can access `req.params.shopId`
// For that to work, express Router needs mergeParams: true
const router = Router({ mergeParams: true });

// Public: Anyone can see shop reviews
router.get('/', getShopReviews);

// Protected: Only logged in users can leave a review
router.use(protect);
router.post('/', createReview);

export default router;
