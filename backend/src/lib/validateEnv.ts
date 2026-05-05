const JWT_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const ALL_REQUIRED = [...JWT_SECRETS, 'DATABASE_URL'];

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string = process.env.NODE_ENV || 'development'
): void {
  const minSecretLength = nodeEnv === 'production' ? 32 : 8;

  for (const key of ALL_REQUIRED) {
    if (!env[key]) {
      throw new Error(
        `Env var ${key} is missing. ${JWT_SECRETS.includes(key) ? `Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` : ''}`
      );
    }
  }

  for (const key of JWT_SECRETS) {
    if (env[key]!.length < minSecretLength) {
      throw new Error(
        `Env var ${key} is too short (min ${minSecretLength} chars in ${nodeEnv})`
      );
    }
  }
}
