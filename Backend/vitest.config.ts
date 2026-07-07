import { defineConfig } from 'vitest/config';
import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';

dotenvConfig({ path: join(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', "./src/routes/**"],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    }
  },
});
