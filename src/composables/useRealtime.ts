import { ref, onUnmounted } from 'vue'
import * as Ably from 'ably'
import type { RealtimeEvent } from '@/types/game'

const EVENT = 'cb'

/**
 * Ably realtime wrapper. One channel per room code.
 *
 * The room host is authoritative: it owns the room state and broadcasts
 * `room-state` events. Players send `join` / `guess` / `leave` events and
 * render whatever room state the host sends back. Presence is used so the
 * host notices when a player's tab disconnects.
 */
export function useRealtime(code: string, clientId: string) {
  const connected = ref(false)
  const error = ref<string | null>(null)

  const ably = new Ably.Realtime({
    key: import.meta.env.VITE_ABLY_PUBLIC_KEY,
    clientId,
  })

  const channel = ably.channels.get(`game-${code.toUpperCase()}`)

  ably.connection.on('connected', () => {
    connected.value = true
  })
  ably.connection.on('failed', () => {
    error.value = 'Failed to connect to realtime service'
    connected.value = false
  })

  function publish(event: RealtimeEvent) {
    channel.publish(EVENT, event)
  }

  function onMessage(handler: (event: RealtimeEvent) => void) {
    channel.subscribe(EVENT, (msg) => handler(msg.data as RealtimeEvent))
  }

  async function enterPresence() {
    try {
      await channel.presence.enter()
    } catch {
      /* ignore presence failures — room still works without it */
    }
  }

  function onPresenceLeave(handler: (clientId: string) => void) {
    channel.presence.subscribe('leave', (msg) => {
      if (msg.clientId) handler(msg.clientId)
    })
    channel.presence.subscribe('absent', (msg) => {
      if (msg.clientId) handler(msg.clientId)
    })
  }

  function close() {
    channel.unsubscribe()
    channel.presence.unsubscribe()
    ably.close()
  }

  onUnmounted(close)

  return {
    connected,
    error,
    channel,
    publish,
    onMessage,
    enterPresence,
    onPresenceLeave,
    close,
  }
}
