import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Проверяем, не закрывал ли пользователь баннер ранее
    if (localStorage.getItem('welcome_banner_dismissed') === 'true') {
      return
    }

    // Определяем iOS
    const ua = navigator.userAgent || ''
    if (/iPhone|iPad|iPod/.test(ua)) {
      setIsIOS(true)
    }

    // Слушаем beforeinstallprompt для Android
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    setVisible(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('Результат установки:', outcome)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('welcome_banner_dismissed', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--grey)',
      padding: '12px 16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      fontSize: '14px',
      color: 'var(--text-primary)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 8 }}>
            ⚠️ Приложение находится в разработке, возможны ошибки.
          </div>

          {isIOS ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              📱 Чтобы установить на iPhone/iPad:<br />
              Нажмите <strong>«Поделиться»</strong> (квадрат со стрелкой в Safari) и выберите <strong>«На экран „Домой“»</strong>.
            </div>
          ) : deferredPrompt ? (
            <button
              onClick={handleInstall}
              style={{
                background: 'var(--accent)',
                color: 'var(--white)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              📲 Установить приложение
            </button>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              📱 Чтобы установить на Android, откройте меню браузера и выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            marginLeft: '8px',
          }}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  )
}