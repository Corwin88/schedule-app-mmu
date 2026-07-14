import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Показываем окно, если не показывали ранее (можно управлять через localStorage)
      const alreadyShown = localStorage.getItem('install_prompt_shown') === 'true'
      if (!alreadyShown) {
        setShowPrompt(true)
        localStorage.setItem('install_prompt_shown', 'true')
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('Результат установки:', outcome)
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-card, #fff)',
      borderRadius: '16px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: '12px',
      zIndex: 500,
      maxWidth: '400px', width: 'calc(100% - 32px)'
    }}>
      <i className="ti ti-download" style={{ fontSize: '24px', color: 'var(--accent)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
          Установить приложение
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Быстрый доступ с главного экрана
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Установить
      </button>
      <button
        onClick={() => setShowPrompt(false)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '18px',
          cursor: 'pointer',
          marginLeft: '-8px'
        }}
      >
        ×
      </button>
    </div>
  )
}