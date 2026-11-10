import { ref, onUnmounted } from 'vue'
import * as Ably from 'ably'

/**
 * Minimal Ably realtime wrapper. One channel per game PIN.
 * Host and players subscribe to the same channel and exchange events.
 *
 * Extend by adding more `subscribe`/`publish` calls for your game's events.
 */
export function useRealtime(gamePin: string) {
  const connected = ref(false)
  const error = ref<string | null>(null)

  const ably = new Ably.Realtime({
    key: import.meta.env.VITE_ABLY_PUBLIC_KEY,
    clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  })

  const channel = ably.channels.get(`game-${gamePin}`)

  ably.connection.on('connected', () => {
    connected.value = true
  })
  ably.connection.on('failed', () => {
    error.value = 'Failed to connect to realtime service'
    connected.value = false
  })

  function publish(event: string, data: Record<string, unknown> = {}) {
    channel.publish(event, data)
  }

  function subscribe(event: string, handler: (data: any) => void) {
    channel.subscribe(event, (msg) => handler(msg.data))
  }

  onUnmounted(() => {
    channel.unsubscribe()
    ably.close()
  })

  return { connected, error, channel, publish, subscribe }
}
