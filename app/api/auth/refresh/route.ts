import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken, createAccessToken, createRefreshToken, AuthError } from '@/lib/auth';
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

    await connectDB();

    const user = await User.findById(decoded.userId);
    if (!user) {
      return badRequest('User not found');
    }

    const newAccessToken = createAccessToken({
      userId: user._id.toString(),
      username: user.username,
    });

    const newRefreshToken = createRefreshToken({
      userId: user._id.toString(),
    });

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id.toString(),
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: 'Refresh token expired. Please login again.' },
        { status: 401 }
      );
    }
    return handleApiError(error);
  }
}
