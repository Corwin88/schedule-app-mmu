import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { fetchSchedule } from '../../api/schedule.js'
import NextClassWidget from '../NextClassWidget'
import GroupModal from '../GroupModal'

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ── Вспомогательные функции ──────────────────────────────────
function mapKindToType(kindOfWork) {
  switch (kindOfWork) {
    case 'Лекция': return 'lec'
    case 'Лабораторная работа': return 'lab'
    case 'Практическое занятие':
    case 'Семинар':
      return 'sem'
    case 'Экзамен':
    case 'Консультация':
      return 'exam'
    default: return 'sem'
  }
}

function normalizeSchedule(rawData) {
  const scheduleMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  if (!Array.isArray(rawData)) return scheduleMap
  rawData.forEach(item => {
    const dayIdx = item.dayOfWeek - 1
    if (dayIdx < 0 || dayIdx > 6) return
    scheduleMap[dayIdx].push({
      id: item.lessonOid || Math.random(),
      start: item.beginLesson,
      end: item.endLesson,
      name: item.discipline,
      room: item.auditorium,
      teacher: item.lecturer,
      type: mapKindToType(item.kindOfWork),
      kindOfWork: item.kindOfWork,
      changed: item.replaces ? 'Замена' : undefined,
      date: item.date,
    })
  })
  Object.values(scheduleMap).forEach(classes => {
    classes.sort((a, b) => {
      const [ah, am] = a.start.split(':').map(Number)
      const [bh, bm] = b.start.split(':').map(Number)
      return ah * 60 + am - (bh * 60 + bm)
    })
  })
  return scheduleMap
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function ClassCard({ cls, isNow }) {
  const badgeClass = cls.type === 'lec' ? 'lec' : cls.type === 'lab' ? 'lab' : 'sem'
  const badgeText =
    cls.type === 'lec' ? 'Лекция' :
    cls.type === 'lab' ? 'Лаборатория' :
    cls.type === 'exam' ? 'Экзамен' : 'Семинар'

  const openRoomPlan = (room) => {
    if (!room) return
    const url = `/room-plan.html?room=${encodeURIComponent(room)}`
    window.open(url, '_blank')
  }

  return (
    <div className={`class-card ${cls.type} ${isNow ? 'now' : ''}`}>
      <div className="time-col">
        <div className="ts">{cls.start}</div>
        <div className="te">{cls.end}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <span className="class-name">{cls.name}</span>
          {isNow && <span className="now-pill">Сейчас</span>}
          {cls.changed && <span className="changed-tag">{cls.changed}</span>}
        </div>
        <div className="class-meta">
          <span>
            <i className="ti ti-map-pin" />{cls.room}
            <i
              className="ti ti-eye"
              onClick={(e) => {
                e.stopPropagation()
                openRoomPlan(cls.room)
              }}
              style={{
                marginLeft: '4px',
                cursor: 'pointer',
                color: 'var(--accent)',
                fontSize: '14px',
                verticalAlign: 'middle'
              }}
              title="Показать план аудитории"
            />
          </span>
          <span><i className="ti ti-user" />{cls.teacher}</span>
        </div>
        <span className={`badge ${badgeClass}`}>{badgeText}</span>
      </div>
    </div>
  )
}

// ── Генератор сетки месяца ──────────────────────────────────
function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid = []
  let startOffset = firstDay === 0 ? 6 : firstDay - 1

  for (let i = 0; i < startOffset; i++) {
    grid.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dayOfWeek = date.getDay()
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    grid.push({ day: d, dayIndex, date })
  }
  return grid
}

// ── Получение всех понедельников месяца ──────────────────────
function getMonthMondays(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const firstMonday = new Date(firstDay)
  firstMonday.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))

  const lastMonday = new Date(lastDay)
  lastMonday.setDate(lastDay.getDate() - ((lastDay.getDay() + 6) % 7))

  const mondays = []
  let currentMonday = new Date(firstMonday)
  while (currentMonday <= lastMonday) {
    mondays.push(new Date(currentMonday))
    currentMonday.setDate(currentMonday.getDate() + 7)
  }
  return mondays
}

// ── Форматирование локальной даты в YYYY-MM-DD (без UTC) ─────
function localDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Главный компонент ────────────────────────────────────────
export default function ScheduleScreen({ group, externalActiveDay, onDayChange, onSaveGroup }) {
  const [viewMode, setViewMode] = useState('day')
  const [weekOffset, setWeekOffset] = useState(0)
  const [showGroupModal, setShowGroupModal] = useState(false)

  const todayIndex = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    return day === 0 ? 6 : day - 1
  }, [])

  const [activeDay, setActiveDay] = useState(todayIndex)
  const [schedule, setSchedule] = useState({})
  const [monthSchedule, setMonthSchedule] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dates, setDates] = useState([])

  // ✅ БАГ #5 ИСПРАВЛЕН: вычисляем текущее время при каждом рендере
  const currentTimeMins = new Date().getHours() * 60 + new Date().getMinutes()

  const prevViewMode = useRef(viewMode)
  useEffect(() => {
    prevViewMode.current = viewMode
  }, [viewMode])

  const getWeekRange = useCallback((offset) => {
    const nowDate = new Date()
    const dayOfWeek = nowDate.getDay() || 7
    const mondayBase = new Date(nowDate)
    mondayBase.setDate(nowDate.getDate() - ((dayOfWeek + 6) % 7))
    const monday = new Date(mondayBase)
    monday.setDate(monday.getDate() + offset * 7)

    const weekDates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      weekDates.push(d.getDate())
    }

    const dateFrom = localDateString(monday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const dateTo = localDateString(sunday)

    return { weekDates, dateFrom, dateTo, monday }
  }, [])

  // Загрузка для дня/недели
  useEffect(() => {
    if (!group?.id || viewMode === 'month') return

    setLoading(true)
    setError(null)

    const { weekDates, dateFrom, dateTo } = getWeekRange(weekOffset)
    setDates(weekDates)

    if (prevViewMode.current === 'month') {
      // activeDay уже установлен в handleDayClick
    } else {
      setActiveDay(weekOffset === 0 ? todayIndex : 0)
    }

    fetchSchedule(group.id, dateFrom, dateTo)
      .then(data => {
        const normalized = normalizeSchedule(data)
        setSchedule(normalized)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [group, weekOffset, viewMode, todayIndex])

  // Загрузка для месяца
  useEffect(() => {
    if (!group?.id || viewMode !== 'month') return

    const loadMonth = async () => {
      setLoading(true)
      setError(null)

      try {
        const today = new Date()
        const year = today.getFullYear()
        const month = today.getMonth()
        const mondays = getMonthMondays(year, month)

        const weekPromises = mondays.map(monday => {
          const dateFrom = localDateString(monday)
          const sunday = new Date(monday)
          sunday.setDate(monday.getDate() + 6)
          const dateTo = localDateString(sunday)
          return fetchSchedule(group.id, dateFrom, dateTo)
            .then(data => normalizeSchedule(data))
            .catch(() => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }))
        })

        const weeks = await Promise.all(weekPromises)

        const merged = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
        weeks.forEach(week => {
          for (let i = 0; i < 7; i++) {
            if (week[i]) merged[i].push(...week[i])
          }
        })

        setMonthSchedule(merged)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    loadMonth()
  }, [group, viewMode])

  const currentSchedule = viewMode === 'month' ? monthSchedule : schedule

  useEffect(() => {
    if (externalActiveDay !== null && externalActiveDay !== undefined) {
      setActiveDay(externalActiveDay)
      if (onDayChange) onDayChange()
    }
  // ✅ БАГ #7 ИСПРАВЛЕН: добавлена зависимость onDayChange
  }, [externalActiveDay, onDayChange])

  const goToPrevWeek = () => setWeekOffset(prev => prev - 1)
  const goToNextWeek = () => setWeekOffset(prev => prev + 1)
  const goToCurrentWeek = () => {
    setWeekOffset(0)
    setActiveDay(todayIndex)
  }

  const getActiveDate = (dayIdx) => {
    const { monday } = getWeekRange(weekOffset)
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayIdx)
    return d
  }

  const renderDayView = () => {
    const classes = currentSchedule[activeDay] || []
    const activeDate = getActiveDate(activeDay)
    const month = activeDate.toLocaleString('ru-RU', { month: 'long' })
    const label = weekOffset === 0 && activeDay === todayIndex
      ? `Сегодня, ${activeDate.getDate()} ${month}`
      : `${DAYS[activeDay]}, ${activeDate.getDate()} ${month}`

    return (
      <>
        {!loading && !error && (
          <>
            <div className="section-label">{label}</div>
            {classes.length === 0 ? (
              <div className="state-center">
                <i className="ti ti-coffee" />
                <p>Пар нет — можно отдыхать</p>
              </div>
            ) : (
              classes.map((cls, i) => {
                const isNow =
                  weekOffset === 0 &&
                  activeDay === todayIndex &&
                  timeToMins(cls.start) <= currentTimeMins &&
                  timeToMins(cls.end) > currentTimeMins

                const showBreak = i > 0 && timeToMins(cls.start) - timeToMins(classes[i - 1].end) >= 10
                return (
                  <div key={cls.id}>
                    {showBreak && (
                      <div className="break-row">
                        <div className="break-line" />
                        <span className="break-text">
                          {timeToMins(cls.start) - timeToMins(classes[i - 1].end)} мин перерыв
                        </span>
                        <div className="break-line" />
                      </div>
                    )}
                    <ClassCard cls={cls} isNow={isNow} />
                  </div>
                )
              })
            )}
          </>
        )}
      </>
    )
  }

  const renderWeekView = () => {
    return (
      <div style={{ paddingBottom: 16 }}>
        {DAYS.map((dayName, idx) => {
          const classes = currentSchedule[idx] || []
          const activeDate = getActiveDate(idx)
          const month = activeDate.toLocaleString('ru-RU', { month: 'long' })
          const isToday = weekOffset === 0 && idx === todayIndex

          return (
            <div key={idx} style={{ marginBottom: 20 }}>
              <div
                className="section-label"
                style={{
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--accent)' : undefined,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setViewMode('day')
                  setActiveDay(idx)
                }}
              >
                {dayName}, {activeDate.getDate()} {month} {isToday ? '(сегодня)' : ''}
              </div>
              {classes.length === 0 ? (
                <p style={{ fontSize: 13, color: '#999', paddingLeft: 4 }}>Пар нет</p>
              ) : (
                classes.map((cls, i) => (
                  <ClassCard key={cls.id} cls={cls} isNow={false} />
                ))
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthView = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    const grid = getMonthGrid(year, month)
    const daysInWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

    const handleDayClick = (dayNumber, dayIndexFromGrid) => {
      const clickedDate = new Date(year, month, dayNumber)
      const dayOfWeek = clickedDate.getDay()
      const mondayOfThatWeek = new Date(clickedDate)
      mondayOfThatWeek.setDate(clickedDate.getDate() - ((dayOfWeek + 6) % 7))

      const nowDate = new Date()
      const currentDayOfWeek = nowDate.getDay() || 7
      const currentMonday = new Date(nowDate)
      currentMonday.setDate(nowDate.getDate() - ((currentDayOfWeek + 6) % 7))

      const diffTime = mondayOfThatWeek.getTime() - currentMonday.getTime()
      const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000))

      const targetDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      setWeekOffset(diffWeeks)
      setActiveDay(targetDayIndex)
      setViewMode('day')
    }

    const classesByDate = {}
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayClasses = currentSchedule[dayIdx] || []
      dayClasses.forEach(cls => {
        if (cls.date) {
          const parts = cls.date.split('.')
          if (parts.length === 3) {
            const y = parseInt(parts[0])
            const m = parseInt(parts[1]) - 1
            const d = parseInt(parts[2])
            if (m === month && y === year) {
              if (!classesByDate[d]) classesByDate[d] = []
              classesByDate[d].push(cls.type)
            }
          }
        }
      })
    }

    return (
      <div style={{ padding: '0 16px 16px' }}>
        <h3 style={{ textAlign: 'center', margin: '8px 0 12px', fontWeight: 500 }}>
          {monthNames[month]} {year}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: 8 }}>
          {daysInWeek.map(d => (
            <div key={d} style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {grid.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} />
            
            const { day, dayIndex } = cell
            const hasClasses = classesByDate[day] && classesByDate[day].length > 0
            const classTypes = classesByDate[day] || []
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

            return (
              <div
                key={day}
                onClick={() => hasClasses && handleDayClick(day, dayIndex)}
                style={{
                  padding: '6px 4px',
                  borderRadius: 6,
                  cursor: hasClasses ? 'pointer' : 'default',
                  background: hasClasses ? 'var(--accent)' : 'transparent',
                  color: hasClasses ? '#fff' : '#333',
                  fontWeight: isToday ? 700 : 400,
                  opacity: hasClasses ? 1 : 0.5,
                  transition: 'background 0.2s',
                  position: 'relative'
                }}
                title={hasClasses ? `Пар: ${classTypes.length}` : ''}
              >
                {day}
                {hasClasses && (
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '2px'
                  }}>
                    {classTypes.map((type, i) => (
                      <span
                        key={i}
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: type === 'lec' ? '#fff' : type === 'lab' ? '#000' : '#666',
                          display: 'inline-block'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="header">
        {/* Заголовок и группа — новая вёрстка */}
        <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="header-title">Расписание</div>
          </div>

          <div>
            {group?.name ? (
              <div
                onClick={() => setShowGroupModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'var(--white)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              >
                <i className="ti ti-users" style={{ fontSize: '14px' }} />
                {group.name}
                <i className="ti ti-pencil" style={{ fontSize: '12px', opacity: 0.7 }} />
              </div>
            ) : (
              <div
                onClick={() => setShowGroupModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--accent)',
                  color: 'var(--white)',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'transform 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <i className="ti ti-users" style={{ fontSize: '14px' }} />
                Выбрать группу
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 8px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['day', 'week', 'month'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '4px 12px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === mode ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: viewMode === mode ? 600 : 400,
                }}
              >
                {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>

          {viewMode !== 'month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="week-nav-btn" onClick={goToPrevWeek}>←</button>
              <button className="week-nav-today" onClick={goToCurrentWeek}>Сегодня</button>
              <button className="week-nav-btn" onClick={goToNextWeek}>→</button>
            </div>
          )}
        </div>

        {viewMode === 'day' && (
          <NextClassWidget groupId={group?.id} onNavigate={(dayIndex) => setActiveDay(dayIndex)} />
        )}

        {viewMode === 'day' && (
          <div className="days-strip">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className={`day-pill ${i === activeDay ? 'active' : ''} ${i === todayIndex && weekOffset === 0 ? 'today' : ''}`}
                onClick={() => setActiveDay(i)}
              >
                <span className="dn">{d}</span>
                <span className="dd">{dates[i]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="screen-body">
        {loading && (
          <div className="state-center">
            <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
            <p>Загружаем расписание...</p>
          </div>
        )}

        {error && (
          <div className="state-center">
            <i className="ti ti-wifi-off" />
            <p>Не удалось загрузить расписание</p>
            <button className="retry-btn" onClick={() => window.location.reload()}>
              Попробовать снова
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {viewMode === 'day' && renderDayView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'month' && renderMonthView()}
          </>
        )}
      </div>

      <GroupModal
        isOpen={showGroupModal}
        currentGroupId={group?.id}
        currentGroupName={group?.name}
        onSave={(id, name) => {
          if (onSaveGroup) onSaveGroup(id, name)
        }}
        onClose={() => setShowGroupModal(false)}
      />
    </>
  )
}