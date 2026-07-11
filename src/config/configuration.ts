export default () => ({
  port: parseInt(process.env.PORT || '2785', 10),

  app: {
    embedBaseUrl: process.env.EMBED_BASE_URL || 'http://localhost:5173',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  queue: {
    enabled: process.env.QUEUE_ENABLED === 'true',
  },

  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
  },

  // Single Postgres database (Supabase)
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'postgres',
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    ssl: process.env.DATABASE_SSL !== 'false', // default true for Supabase
    sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  },

  engine: {
    type: process.env.ENGINE_TYPE || 'whatsapp-web.js',
    puppeteer: {
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: (process.env.PUPPETEER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(','),
    },
    sessionDataPath: process.env.SESSION_DATA_PATH || './data/sessions',
  },

  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10),
  },

  api: {
    rateLimit: {
      shortTtl: parseInt(process.env.RATE_LIMIT_SHORT_TTL || '1000', 10),
      shortLimit: parseInt(process.env.RATE_LIMIT_SHORT_LIMIT || '10', 10),
      mediumTtl: parseInt(process.env.RATE_LIMIT_MEDIUM_TTL || '60000', 10),
      mediumLimit: parseInt(process.env.RATE_LIMIT_MEDIUM_LIMIT || '100', 10),
      longTtl: parseInt(process.env.RATE_LIMIT_LONG_TTL || '3600000', 10),
      longLimit: parseInt(process.env.RATE_LIMIT_LONG_LIMIT || '1000', 10),
    },
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  },

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtIssuer: process.env.CLERK_JWT_ISSUER, // e.g. https://your-app.clerk.accounts.dev
    webhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  },

  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './data/media',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
    },
  },
});
