/**
 * Global chat service — connects to a shared Ably channel (`cb:global:chat`)
 * that is available everywhere, including the home screen before a player has
 * joined a room. This is independent of the per-room game channel.
 */
import * as Ably from 'ably';
import type { ChatMessage } from '@/types/game';

const GLOBAL_CHAT_CHANNEL = 'cb:global:chat';
const CHAT_EVENT = 'chat';

export type ChatHandler = (message: ChatMessage) => void;

/** Fun anonymous aliases used before a player sets their real name. */
const ADJECTIVES = [
  'Sneaky',
  'Crimson',
  'Neon',
  'Shadow',
  'Turbo',
  'Cosmic',
  'Rogue',
  'Silent',
  'Electric',
  'Phantom',
  'Lucky',
  'Vivid',
  'Cyber',
  'Quantum',
  'Midnight',
];
const NOUNS = [
  'Impostor',
  'Cipher',
  'Falcon',
  'Specter',
  'Decoder',
  'Viper',
  'Nova',
  'Glitch',
  'Rebel',
  'Oracle',
  'Byte',
  'Comet',
  'Wraith',
  'Jester',
  'Maverick',
];

export function randomAlias(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${a}${n}${num}`;
}

export class ChatService {
  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;
  private clientId = '';
  private connecting: Promise<void> | null = null;

  get connected(): boolean {
    return this.client?.connection.state === 'connected';
  }

  /** Connect once; safe to call repeatedly (reuses the in-flight/open client). */
  connect(clientId: string): Promise<void> {
    if (this.connected && this.clientId === clientId) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.clientId = clientId;
    this.connecting = new Promise<void>((resolve, reject) => {
      this.client = new Ably.Realtime({
        clientId,
        authCallback: async (_params, callback) => {
          try {
            const res = await fetch('/api/auth-ably', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // No roomCode: global chat only.
              body: JSON.stringify({ clientId }),
            });
            if (!res.ok) throw new Error(`auth-ably ${res.status}`);
            const tokenRequest = (await res.json()) as Ably.TokenRequest;
            callback(null, tokenRequest);
          } catch (err) {
            callback((err as Error).message, null);
          }
        },
      });

      this.client.connection.once('connected', () => {
        this.channel = this.client!.channels.get(GLOBAL_CHAT_CHANNEL);
        void this.channel.attach().then(() => resolve());
      });
      this.client.connection.once('failed', (sc) =>
        reject(new Error(sc.reason?.message ?? 'Chat connection failed')),
      );
    }).finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  async publish(message: ChatMessage): Promise<void> {
    if (!this.channel) return;
    await this.channel.publish(CHAT_EVENT, message);
  }

  onMessage(handler: ChatHandler): () => void {
    if (!this.channel) return () => undefined;
    const listener = (msg: Ably.Message) => handler(msg.data as ChatMessage);
    void this.channel.subscribe(CHAT_EVENT, listener);
    return () => this.channel?.unsubscribe(CHAT_EVENT, listener);
  }

  disconnect(): void {
    this.client?.close();
    this.client = null;
    this.channel = null;
    this.connecting = null;
  }
}

export const chatService = new ChatService();
