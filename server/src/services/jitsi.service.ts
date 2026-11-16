import { randomBytes } from 'crypto';

export interface JitsiRoomResult { name: string; url: string; }

/** Public Jitsi rooms are created on first join, so we persist this
 * unguessable identifier before returning it to authorized participants. */
export class JitsiService {
  private readonly domain = (process.env.JITSI_DOMAIN || 'meet.jit.si').replace(/^https?:\/\//, '').replace(/\/$/, '');
  validateConfiguration(): void {
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(this.domain)) throw new Error('JITSI_DOMAIN must be a valid Jitsi host name.');
  }
  createRoom(): JitsiRoomResult {
    const name = `xprty-${randomBytes(18).toString('base64url').toLowerCase()}`;
    return { name, url: `https://${this.domain}/${name}` };
  }
  getDomain(): string { return this.domain; }
}

export const jitsiService = new JitsiService();
