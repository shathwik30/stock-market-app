import { MarketCondition } from './generated/prisma/client';

const displayMap: Record<MarketCondition, string> = {
  BullMarket: 'Bull Market',
  BullishToBearish: 'Bullish to Bearish',
  SideWaysMarket: 'Side Ways Market',
  BearMarket: 'Bear Market',
  BearishToBullish: 'Bearish to Bullish',
};

const reverseMap = Object.fromEntries(
  Object.entries(displayMap).map(([k, v]) => [v, k])
) as Record<string, MarketCondition>;

export function toDisplayString(mc: MarketCondition): string {
  return displayMap[mc];
}

export function fromDisplayString(s: string): MarketCondition {
  const result = reverseMap[s];
  if (!result) throw new Error(`Unknown market condition: ${s}`);
  return result;
}
