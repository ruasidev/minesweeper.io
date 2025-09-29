import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/animations/lossAnimations.css'
import './styles/animations/winAnimations.css'
import './styles/animations/appAnimations.css'
import './styles/App.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
