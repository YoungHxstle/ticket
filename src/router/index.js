import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const routes = [
  {
    path: '/meta-community-standard',
    component: App
  },
  {
    path: '/',
    redirect: '/meta-community-standard'   // 👈 khi gõ / thì tự vào /meta-community-standard
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router