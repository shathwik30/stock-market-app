// Centralized configuration with environment validation

export const config = {
  jwt: {
    get secret(): string {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error(
          'JWT_SECRET environment variable is required. Please set it in your .env.local file.'
        );
      }
      return secret;
    },
    accessExpiry: '30d',
    refreshExpiry: '365d',
  },
  database: {
    get url(): string {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          'DATABASE_URL environment variable is required. Please set it in your .env.local file.'
        );
      }
      return url;
    },
  },
} as const;
