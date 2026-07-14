import { useState, useEffect } from 'react'
import { fetchGroups } from '../api/schedule.js' 

export default function GroupModal({ isOpen, currentGroupId, currentGroupName, onSave, onClose }) {
  const [allGroups, setAllGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    fetchGroups()
      .then(data => {
        setAllGroups(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [isOpen])

  const filteredGroups = allGroups.filter(g => {
    const matchesQuery =
      query.trim() === '' ||
      g.name.toLowerCase().includes(query.toLowerCase()) ||
      (g.speciality && g.speciality.toLowerCase().includes(query.toLowerCase()))
    const matchesCourse = courseFilter === 0 || g.course === courseFilter
    return matchesQuery && matchesCourse
  })

  const handleSelect = (group) => {
    onSave(group.groupOid, group.name)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '16px 16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>
            Выбор группы
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Поиск и фильтры */}
        <div style={{ padding: '12px 16px' }}>
          <input
            type="text"
            placeholder="🔍 Введите название группы"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--grey)',
              fontSize: '14px',
              marginBottom: '8px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)'
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setCourseFilter(0)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid var(--grey)',
                background: courseFilter === 0 ? 'var(--accent)' : 'var(--grey)',
                color: courseFilter === 0 ? 'var(--white)' : 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: courseFilter === 0 ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              Все
            </button>
            {[1, 2, 3, 4, 5].map(c => (
              <button
                key={c}
                onClick={() => setCourseFilter(c)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--grey)',
                  background: courseFilter === c ? 'var(--accent)' : 'var(--grey)',
                  color: courseFilter === c ? 'var(--white)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: courseFilter === c ? 600 : 400,
                  transition: 'all 0.2s'
                }}
              >
                {c} курс
              </button>
            ))}
          </div>
        </div>

        {/* Список групп */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
              Загрузка...
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: 20, color: 'red' }}>
              Ошибка загрузки
            </div>
          )}
          {!loading && !error && filteredGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
              Ничего не найдено
            </div>
          )}
          {!loading && !error && filteredGroups.map(g => (
            <div
              key={g.groupOid}
              onClick={() => handleSelect(g)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: currentGroupId === g.groupOid ? 'rgba(153,179,196,0.1)' : 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => {
                if (currentGroupId !== g.groupOid)
                  e.currentTarget.style.background = 'rgba(153,179,196,0.05)'
              }}
              onMouseOut={e => {
                if (currentGroupId !== g.groupOid)
                  e.currentTarget.style.background = 'transparent'
              }}
            >
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {g.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {g.faculty}, {g.course} курс &middot; {g.speciality}
                </div>
              </div>
              {currentGroupId === g.groupOid && (
                <i
                  className="ti ti-check"
                  style={{ color: 'var(--accent)', fontSize: '18px' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}