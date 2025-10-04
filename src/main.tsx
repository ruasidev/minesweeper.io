import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/animations/lossAnimations.css'
import './styles/animations/winAnimations.css'
import './styles/animations/appAnimations.css'
import './styles/App.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
