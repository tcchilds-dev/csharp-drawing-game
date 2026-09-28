import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ScreenGuard from './components/ScreenGuard.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScreenGuard>
      <App />
    </ScreenGuard>
  </StrictMode>,
)
