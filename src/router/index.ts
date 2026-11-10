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
      path: '/play',
      name: 'play',
      component: () => import('@/pages/PlayPage.vue'),
    },
    {
      path: '/results',
      name: 'results',
      component: () => import('@/pages/ResultsPage.vue'),
    },
  ],
})

export default router
