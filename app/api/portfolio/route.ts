import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';
import {
  validateRequest,
  validateQuery,
  getPortfolioSchema,
  updatePortfolioSchema,
} from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await connectDB();

    const userId = await getUserIdFromToken();

    const { searchParams } = new URL(request.url);
    const { marketCondition } = validateQuery(searchParams, getPortfolioSchema);

    const portfolio = await Portfolio.findOne({ userId, marketCondition });

    console.log('[Portfolio GET]', marketCondition, 'experienceNotes:', portfolio?.experienceNotes?.length ?? 'none');

    return NextResponse.json({
      success: true,
      portfolio: portfolio || null,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB();

    const userId = await getUserIdFromToken();

    const { marketCondition, totalCapital, strategies, experienceNotes } = await validateRequest(
      request,
      updatePortfolioSchema
    );

    const portfolio = await Portfolio.findOneAndUpdate(
      { userId, marketCondition },
      { $set: { totalCapital, strategies, experienceNotes } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log('[Portfolio PUT] saved experienceNotes count:', experienceNotes?.length, 'returned:', portfolio?.experienceNotes?.length);

    return NextResponse.json({
      success: true,
      message: 'Portfolio updated',
      portfolio,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
