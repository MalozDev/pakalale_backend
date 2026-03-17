import { Router } from 'express';
import { 
  createShop, 
  getAllShops, 
  getShop, 
  updateShop, 
  addProduct 
} from '../services/shopService';
import reviewRoutes from './reviewRoutes';
import verificationRoutes from './verificationRoutes';
import { protect, restrictTo } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getAllShops);
router.get('/:id', getShop);

// Attach nested routes for reviews and verifications
router.use('/:shopId/reviews', reviewRoutes);
router.use('/:shopId/verifications', verificationRoutes);

// Protected routes (Only logged in users can create a shop)
router.use(protect);

// We could restrict shop creation strictly to SHOP_OWNER role, 
// but often standard CUSTOMERS can upgrade themselves by creating a shop.
router.post('/', createShop);

// Only the owner can update the shop or add products
router.patch('/:id', updateShop);
router.post('/:shopId/products', addProduct);

export default router;
