-- CreateEnum
CREATE TYPE "WatchlistCategory" AS ENUM ('intraday', 'fno', 'swing', 'positional', 'multibagger');

-- CreateEnum
CREATE TYPE "NoteColor" AS ENUM ('slate', 'zinc', 'stone', 'neutral', 'gray', 'dark');

-- CreateEnum
CREATE TYPE "MarketCondition" AS ENUM ('Bull Market', 'Bullish to Bearish', 'Side Ways Market', 'Bear Market', 'Bearish to Bullish');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Watchlist',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistStock" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "sNo" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFrom" TEXT NOT NULL,
    "segments" TEXT NOT NULL,
    "tradingSymbol" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "ltp" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "redFlags" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "category" "WatchlistCategory" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "color" "NoteColor" NOT NULL DEFAULT 'slate',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketCondition" "MarketCondition" NOT NULL,
    "totalCapital" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocationRupees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedFunds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unusedFunds" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceNote" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "positive" TEXT NOT NULL DEFAULT '',
    "negative" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ExperienceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMaster" (
    "id" TEXT NOT NULL,
    "securityId" INTEGER NOT NULL,
    "tradingSymbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "exchangeSegment" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT '',
    "instrumentType" TEXT NOT NULL DEFAULT 'ES',
    "isin" TEXT NOT NULL DEFAULT '',
    "faceValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalPrice" (
    "id" TEXT NOT NULL,
    "securityId" INTEGER NOT NULL,
    "exchangeSegment" TEXT NOT NULL,
    "closes" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "timestamps" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "lastDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "prices" JSONB NOT NULL,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_key" ON "Watchlist"("userId");

-- CreateIndex
CREATE INDEX "Note_userId_isPinned_updatedAt_idx" ON "Note"("userId", "isPinned", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_marketCondition_key" ON "Portfolio"("userId", "marketCondition");

-- CreateIndex
CREATE INDEX "StockMaster_exchange_idx" ON "StockMaster"("exchange");

-- CreateIndex
CREATE INDEX "StockMaster_isin_idx" ON "StockMaster"("isin");

-- CreateIndex
CREATE UNIQUE INDEX "StockMaster_securityId_exchange_key" ON "StockMaster"("securityId", "exchange");

-- CreateIndex
CREATE INDEX "HistoricalPrice_exchangeSegment_idx" ON "HistoricalPrice"("exchangeSegment");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPrice_securityId_exchangeSegment_key" ON "HistoricalPrice"("securityId", "exchangeSegment");

-- CreateIndex
CREATE INDEX "PriceSnapshot_timestamp_idx" ON "PriceSnapshot"("timestamp");

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistStock" ADD CONSTRAINT "WatchlistStock_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceNote" ADD CONSTRAINT "ExperienceNote_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
