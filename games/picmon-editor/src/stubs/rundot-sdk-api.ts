// Minimal stand-in for `@series-inc/rundot-game-sdk/api` used only by the
// standalone editor's Play mode. The real SDK talks to the run.game host
// (platform identity, CDN, storage), none of which exists here. The ported
// overworld code touches the SDK in exactly three spots — Overworld's
// `cdn.fetchAsset`, Icon's `cdn.fetchAsset`, and adminAccess's `getProfile` —
// all of which already have static / guest fallbacks when these reject.
//
// Wired in via a Vite `resolve.alias` + a tsconfig `paths` entry, so the
// ported game files import the real specifier and resolve to this instead.

export interface RundotProfile {
  id: string;
  username?: string;
}

const RundotGameAPI = {
  /** Editor has no platform identity — behave as an anonymous guest so
   *  adminAccess resolves to non-admin in prod (in dev it short-circuits
   *  to admin via import.meta.env.DEV without ever calling this). */
  async getProfile(): Promise<RundotProfile> {
    return { id: '', username: '' };
  },
  cdn: {
    /** No CDN in the standalone editor — reject so callers fall back to
     *  their static `/public` paths (assets.ts loadCdnImage, Icon loadAtlas). */
    async fetchAsset(_relativePath: string): Promise<Blob> {
      throw new Error('editor stub: no run.game CDN');
    },
  },
};

export default RundotGameAPI;
