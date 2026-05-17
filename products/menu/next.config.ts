import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// __dirname equivalent in ESM — products/menu/.
const here = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Standalone output gera um bundle minimal com server.js — ideal para Docker
  output: 'standalone',
  // Bun workspaces monorepo: tell Next to trace files up to the workspace
  // root (two levels above this file) so the standalone build includes the
  // linked @iedora/design-system package + its CSS / fonts. Without this
  // Next emits a warning and traces only inside products/menu/.
  outputFileTracingRoot: path.join(here, '..', '..'),
  transpilePackages: ['@iedora/design-system'],
  outputFileTracingIncludes: {
    // Workaround: Turbopack standalone não rastreia drizzle-orm/postgres
    // automaticamente porque a app importa-os mas o `scripts/migrate.mjs`
    // (executado via `kamal app exec`) também precisa deles em disco.
    // Ref: vercel/next.js#88844
    '/*': [
      './node_modules/drizzle-orm/**/*',
      './node_modules/postgres/**/*',
      './drizzle/**/*',
      './scripts/migrate.mjs',
    ],
  },
  allowedDevOrigins: [
    'metamenu.733113.xyz'
  ]
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
export default withNextIntl(nextConfig)
