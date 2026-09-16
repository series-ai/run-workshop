import type { KinetixSessionConfigSchema } from '@series-inc/rundot-syncplay/core/authoring';
import { MAX_PLAYERS } from './constants';

export const SESSION_CONFIG_SCHEMA: KinetixSessionConfigSchema = {
  id: 'wreck-yard.session.v1',
  version: 1,
  maxBytes: 64,
  fields: {
    playerCount: { type: 'integer', min: 1, max: MAX_PLAYERS },
  },
};

export interface YardSessionConfig {
  readonly playerCount: number;
}
