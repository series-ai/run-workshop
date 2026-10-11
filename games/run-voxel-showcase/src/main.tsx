import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { App } from './App'
import './styles.css'

async function boot(): Promise<void> {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Root element not found')

  try {
    // Must complete before any other SDK call. Bounded so a hung init cannot
    // wedge the app.
    await Promise.race([
      RundotAPI.initializeAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RUN SDK init timed out')), 5000),
      ),
    ])
  } catch (error) {
    // Catalog metadata remains usable, but remote assets may be unavailable.
    console.warn('RUN SDK initialization failed; remote assets may be unavailable.', error)
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
