import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromToken } from '@/lib/auth';
import {
  handleApiError,
  notFound,
  created,
  successResponse,
} from '@/lib/api-response';
import {
  validateRequest,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
} from '@/lib/validations';

export async function GET() {
  try {
    const userId = await getUserIdFromToken();

    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    return successResponse({ notes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromToken();

    const { title, content, color, tags } = await validateRequest(
      request,
      createNoteSchema
    );

    const note = await prisma.note.create({
      data: {
        userId,
        title,
        content,
        color,
        tags,
        isPinned: false,
      },
    });

    return created({ note }, 'Note created');
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getUserIdFromToken();

    const { id, title, content, color, isPinned, tags } = await validateRequest(
      request,
      updateNoteSchema
    );

    const existing = await prisma.note.findFirst({ where: { id, userId } });

    if (!existing) {
      return notFound('Note not found');
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(color !== undefined && { color }),
        ...(isPinned !== undefined && { isPinned }),
        ...(tags !== undefined && { tags }),
      },
    });

    return successResponse({ note }, { message: 'Note updated' });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getUserIdFromToken();

    const { id } = await validateRequest(request, deleteNoteSchema);

    const result = await prisma.note.deleteMany({ where: { id, userId } });

    if (result.count === 0) {
      return notFound('Note not found');
    }

    return successResponse(null, { message: 'Note deleted' });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
