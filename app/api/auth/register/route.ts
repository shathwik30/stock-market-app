import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { created, handleApiError, badRequest } from '@/lib/api-response';
import { validateRequest, registerSchema } from '@/lib/validations';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, email, password, firstName, lastName } = await validateRequest(
      request,
      registerSchema
    );

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return badRequest('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    return created(
      {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      'User registered successfully'
    );
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
