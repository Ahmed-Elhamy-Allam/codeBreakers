import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/host/:pin',
      name: 'host',
      component: () => import('@/pages/HostLobby.vue'),
    },
    {
      path: '/join',
      name: 'join',
      component: () => import('@/pages/PlayerJoin.vue'),
    },
    {
      path: '/lobby/:pin',
      name: 'lobby',
      component: () => import('@/pages/PlayerLobby.vue'),
    },
  ],
})

export default router
