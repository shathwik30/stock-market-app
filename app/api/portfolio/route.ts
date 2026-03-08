import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma/client';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/api-response';
import {
  validateRequest,
  validateQuery,
  getPortfolioSchema,
  updatePortfolioSchema,
} from '@/lib/validations';
import { fromDisplayString, toDisplayString } from '@/lib/market-condition';

export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromToken();

    const { searchParams } = new URL(request.url);
    const { marketCondition } = validateQuery(searchParams, getPortfolioSchema);

    const mc = fromDisplayString(marketCondition);

    const portfolio = await prisma.portfolio.findFirst({
      where: { userId, marketCondition: mc },
      include: { strategies: true, experienceNotes: true },
    });

    if (!portfolio) {
      return successResponse({ portfolio: null });
    }

    // Map enum back to display string for frontend compatibility
    return successResponse({
      portfolio: {
        ...portfolio,
        marketCondition: toDisplayString(portfolio.marketCondition),
      },
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
    const userId = await getUserIdFromToken();

    const { marketCondition, totalCapital, strategies, experienceNotes } = await validateRequest(
      request,
      updatePortfolioSchema
    );

    const mc = fromDisplayString(marketCondition);

    const portfolio = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Upsert the portfolio
      const p = await tx.portfolio.upsert({
        where: { userId_marketCondition: { userId, marketCondition: mc } },
        create: {
          userId,
          marketCondition: mc,
          totalCapital,
        },
        update: {
          totalCapital,
        },
      });

      // Replace strategies: delete old, create new
      await tx.strategy.deleteMany({ where: { portfolioId: p.id } });
      if (strategies.length > 0) {
        await tx.strategy.createMany({
          data: strategies.map((s) => ({
            portfolioId: p.id,
            name: s.name,
            allocationPercent: s.allocationPercent,
            allocationRupees: s.allocationRupees,
            usedFunds: s.usedFunds,
            unusedFunds: s.unusedFunds,
          })),
        });
      }

      // Replace experience notes: delete old, create new
      await tx.experienceNote.deleteMany({ where: { portfolioId: p.id } });
      if (experienceNotes && experienceNotes.length > 0) {
        await tx.experienceNote.createMany({
          data: experienceNotes.map((n) => ({
            portfolioId: p.id,
            positive: n.positive,
            negative: n.negative,
          })),
        });
      }

      // Return full portfolio with relations
      return tx.portfolio.findUnique({
        where: { id: p.id },
        include: { strategies: true, experienceNotes: true },
      });
    });

    return successResponse(
      {
        portfolio: portfolio
          ? { ...portfolio, marketCondition: toDisplayString(portfolio.marketCondition) }
          : null,
      },
      { message: 'Portfolio updated' }
    );
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
