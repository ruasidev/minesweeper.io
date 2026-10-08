import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/animations/lossAnimations.css'
import './styles/animations/winAnimations.css'
import './styles/animations/appAnimations.css'
import './styles/App.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { SettingsProvider } from './context/SettingsContext.tsx'
import { AccountProvider } from './context/AccountContext.tsx'
import { ConnectionProvider } from './context/ConnectionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <AccountProvider>
          <ConnectionProvider>
            <App />
          </ConnectionProvider>
        </AccountProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
)
