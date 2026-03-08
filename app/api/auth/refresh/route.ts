import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, createAccessToken, createRefreshToken } from '@/lib/auth';
import { handleApiError, badRequest } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return badRequest('Refresh token is required');
    }

    const decoded = verifyToken(refreshToken);

    if (!decoded.userId) {
      return badRequest('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return badRequest('User not found');
    }

    const newAccessToken = createAccessToken({
      userId: user.id,
      username: user.username,
    });

    const newRefreshToken = createRefreshToken({
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
