/**
 * Typed Ably wrapper: token auth, room channel pub/sub, and presence.
 *
 * The real Ably key never touches the client — we authenticate via the
 * /api/auth-ably serverless endpoint (authUrl pattern).
 */
import * as Ably from 'ably';
import type { GameEvent, Player } from '@/types/game';

const EVENT_NAME = 'game-event';

export type GameEventHandler = (event: GameEvent) => void;
export type PresenceHandler = (
  action: 'enter' | 'leave' | 'update' | 'present',
  member: Ably.PresenceMessage,
) => void;

export class AblyService {
  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;
  private roomCode = '';
  private clientId = '';

  get connected(): boolean {
    return this.client?.connection.state === 'connected';
  }

  get id(): string {
    return this.clientId;
  }

  /** Connect to Ably using serverless token auth and attach to the room. */
  async connect(clientId: string, roomCode: string): Promise<void> {
    this.clientId = clientId;
    this.roomCode = roomCode;

    // Use authCallback so we can POST a JSON body ({ clientId, roomCode })
    // to our serverless token endpoint — authUrl doesn't support JSON bodies.
    this.client = new Ably.Realtime({
      clientId,
      authCallback: async (_params, callback) => {
        try {
          const res = await fetch('/api/auth-ably', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, roomCode: this.roomCode }),
          });
          if (!res.ok) throw new Error(`auth-ably ${res.status}`);
          const tokenRequest = (await res.json()) as Ably.TokenRequest;
          callback(null, tokenRequest);
        } catch (err) {
          callback((err as Error).message, null);
        }
      },
    });

    await this.waitForConnection();
    this.channel = this.client.channels.get(`cb:room:${roomCode}`);
    await this.channel.attach();
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error('No Ably client'));
      this.client.connection.once('connected', () => resolve());
      this.client.connection.once('failed', (stateChange) =>
        reject(new Error(stateChange.reason?.message ?? 'Ably connection failed')),
      );
    });
  }

  /** Broadcast a typed game event to the room. */
  async publish(event: GameEvent): Promise<void> {
    if (!this.channel) throw new Error('Not attached to a channel');
    await this.channel.publish(EVENT_NAME, event);
  }

  /** Subscribe to typed game events. Returns an unsubscribe function. */
  onEvent(handler: GameEventHandler): () => void {
    if (!this.channel) throw new Error('Not attached to a channel');
    const listener = (msg: Ably.Message) => handler(msg.data as GameEvent);
    void this.channel.subscribe(EVENT_NAME, listener);
    return () => this.channel?.unsubscribe(EVENT_NAME, listener);
  }

  // ---- Presence ----

  async enterPresence(player: Player): Promise<void> {
    if (!this.channel) throw new Error('Not attached to a channel');
    await this.channel.presence.enter(player);
  }

  async updatePresence(player: Player): Promise<void> {
    if (!this.channel) throw new Error('Not attached to a channel');
    await this.channel.presence.update(player);
  }

  async leavePresence(): Promise<void> {
    await this.channel?.presence.leave();
  }

  onPresence(handler: PresenceHandler): () => void {
    if (!this.channel) throw new Error('Not attached to a channel');
    const listener = (msg: Ably.PresenceMessage) =>
      handler(msg.action as 'enter' | 'leave' | 'update' | 'present', msg);
    void this.channel.presence.subscribe(listener);
    return () => this.channel?.presence.unsubscribe(listener);
  }

  async getPresentMembers(): Promise<Player[]> {
    if (!this.channel) return [];
    const members = await this.channel.presence.get();
    return members.map((m) => m.data as Player);
  }

  async disconnect(): Promise<void> {
    try {
      await this.leavePresence();
    } catch {
      /* ignore */
    }
    this.client?.close();
    this.client = null;
    this.channel = null;
  }
}

export const ablyService = new AblyService();
