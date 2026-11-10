import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/lobby', name: 'lobby', component: () => import('@/views/LobbyView.vue') },
  { path: '/game', name: 'game', component: () => import('@/views/GameRoom.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
