import mongoose, { Schema, models, Document } from 'mongoose';

export interface IStrategy {
  name: string;
  allocationPercent: number;
  allocationRupees: number;
  usedFunds: number;
  unusedFunds: number;
}

export interface IExperienceNote {
  positive: string;
  negative: string;
}

export interface IPortfolio extends Document {
  userId: mongoose.Types.ObjectId;
  marketCondition: 'Bull Market' | 'Bullish to Bearish' | 'Side Ways Market' | 'Bear Market' | 'Bearish to Bullish';
  totalCapital: number;
  strategies: IStrategy[];
  experienceNotes: IExperienceNote[];
  createdAt: Date;
  updatedAt: Date;
}

const StrategySchema = new Schema<IStrategy>({
  name: { type: String, required: true },
  allocationPercent: { type: Number, default: 0 },
  allocationRupees: { type: Number, default: 0 },
  usedFunds: { type: Number, default: 0 },
  unusedFunds: { type: Number, default: 0 },
});

const PortfolioSchema = new Schema<IPortfolio>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    marketCondition: {
      type: String,
      required: true,
      enum: ['Bull Market', 'Bullish to Bearish', 'Side Ways Market', 'Bear Market', 'Bearish to Bullish'],
    },
    totalCapital: { type: Number, default: 100000 },
    strategies: [StrategySchema],
    experienceNotes: [{
      positive: { type: String, default: '' },
      negative: { type: String, default: '' },
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one portfolio per market condition per user
PortfolioSchema.index({ userId: 1, marketCondition: 1 }, { unique: true });

// Force re-register model with current schema on every module load (dev HMR safe)
const modelCache = mongoose.models as Record<string, unknown>;
if (modelCache.Portfolio) {
  delete modelCache.Portfolio;
}
const connModelCache = mongoose.connection?.models as Record<string, unknown> | undefined;
if (connModelCache?.Portfolio) {
  delete connModelCache.Portfolio;
}

const Portfolio = mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);

export default Portfolio;
