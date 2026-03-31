// 原版使用 Cursor Canvas 的 window.storage；瀏覽器用 localStorage 模擬
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async get(key) {
      try {
        const v = localStorage.getItem(key)
        return v != null ? { value: v } : null
      } catch {
        return null
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value)
      } catch { /* ignore */ }
    },
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
