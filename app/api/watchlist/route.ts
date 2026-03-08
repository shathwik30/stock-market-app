import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromToken } from '@/lib/auth';
import {
  handleApiError,
  badRequest,
  notFound,
  successResponse,
} from '@/lib/api-response';
import {
  validateRequest,
  addStockSchema,
  removeStockSchema,
} from '@/lib/validations';

export async function GET() {
  try {
    const userId = await getUserIdFromToken();

    let watchlist = await prisma.watchlist.findUnique({
      where: { userId },
      include: { stocks: true },
    });

    if (!watchlist) {
      watchlist = await prisma.watchlist.create({
        data: { userId },
        include: { stocks: true },
      });
    }

    return successResponse({ watchlist });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromToken();

    const stockData = await validateRequest(request, addStockSchema);

    let watchlist = await prisma.watchlist.findUnique({
      where: { userId },
      include: { stocks: true },
    });

    if (!watchlist) {
      watchlist = await prisma.watchlist.create({
        data: {
          userId,
          stocks: {
            create: { ...stockData, addedAt: new Date() },
          },
        },
        include: { stocks: true },
      });
    } else {
      const exists = watchlist.stocks.some(
        (stock: { tradingSymbol: string; category: string }) =>
          stock.tradingSymbol === stockData.tradingSymbol &&
          stock.category === stockData.category
      );

      if (exists) {
        return badRequest('Stock already in this watchlist category');
      }

      await prisma.watchlistStock.create({
        data: {
          watchlistId: watchlist.id,
          ...stockData,
          addedAt: new Date(),
        },
      });

      watchlist = await prisma.watchlist.findUnique({
        where: { userId },
        include: { stocks: true },
      });
    }

    return successResponse({ watchlist }, { message: 'Stock added to watchlist' });
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

    const { stockId } = await validateRequest(request, removeStockSchema);

    const watchlist = await prisma.watchlist.findUnique({
      where: { userId },
      include: { stocks: true },
    });

    if (!watchlist) {
      return notFound('Watchlist not found');
    }

    const stock = watchlist.stocks.find((s: { id: string }) => s.id === stockId);

    if (!stock) {
      return notFound('Stock not found in watchlist');
    }

    await prisma.watchlistStock.delete({ where: { id: stockId } });

    const updatedWatchlist = await prisma.watchlist.findUnique({
      where: { userId },
      include: { stocks: true },
    });

    return successResponse({ watchlist: updatedWatchlist }, { message: 'Stock removed from watchlist' });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return handleApiError(error);
  }
}
