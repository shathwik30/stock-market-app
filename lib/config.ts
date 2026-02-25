// Centralized configuration with environment validation

const getEnvVar = (name: string, required = true): string => {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
};

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
  mongodb: {
    get uri(): string {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        throw new Error(
          'MONGODB_URI environment variable is required. Please set it in your .env.local file.'
        );
      }
      return uri;
    },
  },
} as const;
