import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { signToken } from '../utils/token';
import { AppError } from '../middleware/errorHandler';

// Service functions to handle core business logic

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // 1. Hash the password before saving for security
    const hashedPassword = await bcrypt.hash(password, 12);

    // 2. Create the user in the database
    // We restrict the data sent to the DB to avoid injection
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: role || 'CUSTOMER', // Default to CUSTOMER if no role is provided
      },
    });

    // 3. Generate a JWT token for the new user
    const token = signToken(newUser.id);

    // 4. Send response
    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Prisma duplicate field error code (e.g. Email already exists)
      return next(new AppError('Email already in use!', 400));
    }
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // 1. Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    // 2. Check if user exists & password is correct
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3. If everything is ok, send token to client
    const token = signToken(user.id);

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
