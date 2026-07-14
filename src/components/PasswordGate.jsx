import { useState } from 'react'

// Список допустимых паролей (можно хранить здесь, т.к. это не секьюрно,
// но для тестового доступа подходит)
const VALID_PASSWORDS = ['mmu2020', 'mmu2021', 'mmu2022', 'mmu2023', 'mmu2024', 'mmu2025', 'mmu2026']

export default function PasswordGate({ children }) {
  const [isAuthorized, setIsAuthorized] = useState(
    () => localStorage.getItem('app_authorized') === 'true'
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (VALID_PASSWORDS.includes(input.trim())) {
      localStorage.setItem('app_authorized', 'true')
      setIsAuthorized(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (isAuthorized) return children

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-app, #D3D7D8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-card, #fff)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '320px',
        width: '100%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <i className="ti ti-lock" style={{ fontSize: '36px', color: 'var(--accent)' }} />
        <h3 style={{ margin: '12px 0 4px', color: 'var(--text-primary)' }}>Доступ к приложению</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          Введите тестовый пароль
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            placeholder="Пароль"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${error ? '#ff3b30' : 'var(--grey)'}`,
              fontSize: '16px',
              marginBottom: '12px',
              boxSizing: 'border-box',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)'
            }}
          />
          {error && (
            <p style={{ color: '#ff3b30', fontSize: '13px', marginBottom: '8px' }}>Неверный пароль</p>
          )}
          <button type="submit" style={{
            width: '100%',
            padding: '10px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer'
          }}>
            Войти
          </button>
        </form>
      </div>
    </div>
  )
}