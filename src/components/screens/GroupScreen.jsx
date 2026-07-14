import { useState, useEffect } from 'react'
import { fetchGroups } from '../../api/schedule.js'

export default function GroupScreen({ currentGroupId, currentGroupName, onSave }) {
  // Все группы с сервера
  const [allGroups, setAllGroups] = useState([])
  // Состояния загрузки и ошибки
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Поисковый запрос
  const [query, setQuery] = useState('')
  // Выбранный курс (0 = все)
  const [courseFilter, setCourseFilter] = useState(0)

  // Загружаем группы один раз
  useEffect(() => {
    fetchGroups()
      .then(data => {
        setAllGroups(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Фильтрация групп по поиску и курсу
  const filteredGroups = allGroups.filter(g => {
    const matchesQuery =
      query.trim() === '' ||
      g.name.toLowerCase().includes(query.toLowerCase()) ||
      (g.speciality && g.speciality.toLowerCase().includes(query.toLowerCase()))
    const matchesCourse = courseFilter === 0 || g.course === courseFilter
    return matchesQuery && matchesCourse
  })

  // Обработчик выбора группы – сразу сохраняем и переходим к расписанию
  function handleSelect(group) {
    onSave(group.groupOid, group.name)
  }

  // Список курсов для фильтра
  const courses = [1, 2, 3, 4, 5]

  if (loading) {
    return (
      <>
        <div className="header">
          <div className="header-top">
            <div className="header-title">Выбор группы</div>
            <div className="header-sub">Загрузка списка...</div>
          </div>
        </div>
        <div className="screen-body">
          <div className="state-center">
            <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
            <p>Загружаем группы...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="header">
          <div className="header-top">
            <div className="header-title">Выбор группы</div>
            <div className="header-sub">Ошибка загрузки</div>
          </div>
        </div>
        <div className="screen-body">
          <div className="state-center">
            <i className="ti ti-wifi-off" />
            <p>Не удалось загрузить список групп</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="header">
        <div className="header-top">
          <div>
            <div className="header-title">Выбор группы</div>
            <div className="header-sub">
              {currentGroupName ? `Сейчас: ${currentGroupName}` : 'Найдите свою группу'}
            </div>
          </div>
        </div>

        {/* Поисковая строка */}
        <div style={{ padding: '0 16px 8px' }}>
          <input
            type="text"
            placeholder="🔍 Введите название группы (например, ИС-231)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input" // можешь добавить свой класс или оставить инлайн-стили
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '12px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
        </div>

        {/* Фильтр по курсу */}
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          <button
            onClick={() => setCourseFilter(0)}
            className={`course-btn ${courseFilter === 0 ? 'active' : ''}`}
            style={{
              padding: '4px 12px',
              borderRadius: '14px',
              border: '1px solid #ccc',
              background: courseFilter === 0 ? '#99b3c4' : '#fff',
              color: courseFilter === 0 ? '#333' : '#333',
              fontSize: '14px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Все
          </button>
          {courses.map(c => (
            <button
              key={c}
              onClick={() => setCourseFilter(c)}
              className={`course-btn ${courseFilter === c ? 'active' : ''}`}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                border: '1px solid #ccc',
                background: courseFilter === c ? '#99b3c4' : '#fff',
                color: courseFilter === c ? '#333' : '#333',
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {c} курс
            </button>
          ))}
        </div>
      </div>

      {/* Результаты поиска */}
      <div className="screen-body" style={{ padding: '0 16px' }}>
        {filteredGroups.length === 0 ? (
          <div className="state-center">
            <i className="ti ti-coffee" />
            <p>Групп не найдено</p>
          </div>
        ) : (
          <div className="group-list">
            {filteredGroups.map(g => (
              <div
                key={g.groupOid}
                className="group-row"
                onClick={() => handleSelect(g)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontWeight: '500' }}>{g.name}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {g.faculty}, {g.course} курс &middot; {g.speciality}
                  </div>
                </div>
                {currentGroupId === g.groupOid && (
                  <i className="ti ti-check" style={{ color: '#007aff' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}