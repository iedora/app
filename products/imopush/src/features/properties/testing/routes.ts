import { IMOPUSH_PATHS } from '../../../url'

/**
 * Properties slice routes — single source of truth for specs.
 */
export const propertiesRoutes = {
  list: IMOPUSH_PATHS.dashboard,
  detail: (reference: string) => IMOPUSH_PATHS.property(reference),
} as const
