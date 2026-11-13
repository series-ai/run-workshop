import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element is missing.')
createRoot(root).render(<App />)

// The local pack remains available if the RUN host is absent.
void import('@series-inc/rundot-game-sdk/api').then(async ({ default: api }) => {
  await api.initializeAsync()
}).catch(error => console.info('RUN host is unavailable. Local asset mode is active.', error))
