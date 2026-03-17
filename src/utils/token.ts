import jwt from 'jsonwebtoken';

// Helper function to sign JWT tokens
// Takes the user's ID and signs it with the secret key from environment variables
export const signToken = (id: string): string => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'fallback_secret', 
    {
      expiresIn: (process.env.JWT_EXPIRES_IN || '90d') as any,
    }
  );
};
