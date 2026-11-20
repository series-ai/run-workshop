import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@series-inc/rundot-game-sdk/api'
import { App } from './App'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
