import { Router } from 'express';
import { signup, login } from '../services/authService';

const router = Router();

// Route for User/Shop sign up
router.post('/signup', signup);

// Route for User/Shop login
router.post('/login', login);

export default router;
