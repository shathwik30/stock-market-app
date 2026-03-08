import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createAccessToken, createRefreshToken } from '@/lib/auth';
import { handleApiError, badRequest } from '@/lib/api-response';
import { validateRequest, loginSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const { username, password } = await validateRequest(request, loginSchema);

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return badRequest('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return badRequest('Invalid credentials');
    }

    const accessToken = createAccessToken({
      userId: user.id,
      username: user.username,
    });

    const refreshToken = createRefreshToken({
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // If it's already a NextResponse (from validation), return it
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
