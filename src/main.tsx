import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/critical.css'
import './index.css'
import App from './App.tsx'
import './utils/performance'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
