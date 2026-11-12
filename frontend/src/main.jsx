import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { instalarRenovacionDeSesion } from './services/sesion'

// El token del equipo vive en localStorage y es por origen: en local se usa siempre localhost.
if (import.meta.env.DEV && window.location.hostname === '127.0.0.1') {
  window.location.replace(window.location.href.replace('//127.0.0.1', '//localhost'))
}

instalarRenovacionDeSesion()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
