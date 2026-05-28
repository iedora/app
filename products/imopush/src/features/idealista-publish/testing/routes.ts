import { IMOPUSH_PATHS } from '../../../url'

/**
 * Idealista-publish slice routes.
 */
export const idealistaPublishRoutes = {
  detail: (reference: string) => IMOPUSH_PATHS.property(reference),
  integrator: IMOPUSH_PATHS.integrator('idealista'),
} as const
