import path from 'node:path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/api/**/*.spec.ts', 'tests/libs/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@catan/api-interfaces': path.join(workspaceRoot, 'libs/api-interfaces/src/index.ts'),
      '@catan/shared-game-field': path.join(
        workspaceRoot,
        'libs/shared/game-field/src/index.ts',
      ),
      '@catan/client': path.join(workspaceRoot, 'apps/catan-client/src'),
      '@catan/api-app': path.join(workspaceRoot, 'apps/catan-api/src'),
      '@catan/tests': path.join(workspaceRoot, 'tests'),
    },
  },
});
