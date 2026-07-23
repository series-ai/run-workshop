import React from 'react'
import ReactDOM from 'react-dom/client'
import { PfxBrowserApp } from './PfxBrowserApp'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PfxBrowserApp />
  </React.StrictMode>,
)
