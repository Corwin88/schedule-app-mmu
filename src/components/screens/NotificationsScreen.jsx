import { useState, useEffect } from 'react'
import { fetchScheduleLog } from '../../api/schedule.js'
import { subscribeToPush, unsubscribeFromPush, getPushSubscriptionStatus } from '../../services/pushSubscription.js'

function NotifCard({ n }) {
  const typeClass = n.type === 'change' ? 'type-change' : 'type-dean'
  const tagClass  = n.type === 'change' ? 'change' : 'info'
  const tagText   = n.type === 'change' ? 'Изменение' : 'Объявление'
  const tagIcon   = n.type === 'change' ? 'ti-clock-edit' : 'ti-info-circle'
  const senderIcon = n.type === 'change' ? 'ti-clock-edit' : 'ti-school'

  return (
    <div className={`notif-card ${typeClass}`} style={{ opacity: n.read ? 0.55 : 1 }}>
      <div className="notif-header">
        <span className="notif-sender">
          <i className={`ti ${senderIcon}`} />{n.sender}
        </span>
        <span className="notif-time">{n.time}</span>
      </div>
      <div className="notif-title">{n.title}</div>
      <div className="notif-body">{n.body}</div>
      <span className={`notif-tag ${tagClass}`}>
        <i className={`ti ${tagIcon}`} />{tagText}
      </span>
    </div>
  )
}

// Преобразование сырых данных API в уведомления
function mapLogToNotif(item) {
  const isBan = item.isBan || item.kindOfWork?.toLowerCase().includes('отмена')
  const isReplace = item.replaces || (item.modifieddate && item.modifieddate !== item.createddate)
  const type = isBan ? 'dean' : (isReplace ? 'change' : 'info')
  const sender = item.lecturer || 'Деканат'
  const dateObj = item.date ? new Date(item.date) : new Date()
  const timeStr = item.beginLesson
    ? `${dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${item.beginLesson}`
    : dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

  const discipline = item.discipline || 'Пара'
  let title = ''
  if (isBan) title = `Отмена: ${discipline}`
  else if (isReplace) title = `Замена: ${discipline}`
  else title = `Изменение: ${discipline}`

  const parts = []
  if (item.auditorium) parts.push(`Ауд. ${item.auditorium}`)
  if (item.beginLesson && item.endLesson) parts.push(`${item.beginLesson} – ${item.endLesson}`)
  const body = parts.join(' · ') || 'Подробности уточняйте в расписании'
  const dateKey = dateObj.toISOString().split('T')[0]

  return {
    id: item.lessonOid || Math.random(),
    type: type === 'change' ? 'change' : 'dean',
    read: false,
    sender,
    time: timeStr,
    title,
    body,
    date: dateKey,
    raw: item
  }
}

function groupByDate(notifs) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const groups = {}
  notifs.forEach(n => {
    const d = n.date
    const key = d === today ? 'Сегодня' : (d === yesterday ? 'Вчера' : new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))
    if (!groups[key]) groups[key] = []
    groups[key].push(n)
  })

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Сегодня') return -1
    if (b === 'Сегодня') return 1
    if (a === 'Вчера') return -1
    if (b === 'Вчера') return 1
    return 0
  })
  return sortedKeys.map(key => ({ label: key, items: groups[key] }))
}

export default function NotificationsScreen({ group, onUnreadCountChange }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(false)

  // Проверяем статус подписки при монтировании и при изменении группы
  useEffect(() => {
    async function checkStatus() {
      const status = await getPushSubscriptionStatus()
      setPushEnabled(status)
    }
    checkStatus()
  }, [group])

  // Функция загрузки уведомлений
  const loadNotifications = () => {
    if (!group?.id) {
      setNotifs([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const now = new Date()
    const past = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const dateFrom = past.toISOString().split('T')[0]
    const dateTo = now.toISOString().split('T')[0]

    fetchScheduleLog(group.id, dateFrom, dateTo)
      .then(data => {
        const mapped = data.map(mapLogToNotif)
        setNotifs(mapped)
        if (onUnreadCountChange) {
          const unread = mapped.filter(n => !n.read).length
          onUnreadCountChange(unread)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadNotifications()
  }, [group])

  // Обработчик переключения push-уведомлений
const handleTogglePush = async () => {
  if (pushEnabled) {
    // отключаем
    await unsubscribeFromPush(group?.id);
    setPushEnabled(false);
  } else {
    // включаем
    const result = await subscribeToPush(group?.id);
    // Если подписка успешна, включаем переключатель,
    // иначе оставляем выключенным
    if (result) {
      setPushEnabled(true);
    } else {
      // Можно показать сообщение об ошибке, если нужно
      console.warn('Не удалось включить уведомления');
    }
  }
};

  const unreadCount = notifs.filter(n => !n.read).length
  const groups = groupByDate(notifs)

  return (
    <>
      <div className="header">
        <div className="header-top">
          <div>
            <div className="header-title">Уведомления</div>
            <div className="header-sub">
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Всё прочитано'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <div style={{
                background: 'var(--accent)', color: '#fff',
                fontSize: 11, fontWeight: 500,
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {unreadCount}
              </div>
            )}
            {/* Переключатель push */}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{
                position: 'relative',
                width: '40px',
                height: '22px',
                background: pushEnabled ? '#34c759' : '#e5e5ea',
                borderRadius: '11px',
                transition: 'background 0.2s',
                marginRight: '6px'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: pushEnabled ? '20px' : '2px',
                  width: '18px',
                  height: '18px',
                  background: '#fff',
                  borderRadius: '50%',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}></div>
              </div>
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={handleTogglePush}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                {pushEnabled ? 'Вкл' : 'Выкл'}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="screen-body">
        {loading && (
          <div className="state-center">
            <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
            <p>Загружаем уведомления...</p>
          </div>
        )}

        {error && (
          <div className="state-center">
            <i className="ti ti-wifi-off" />
            <p>Не удалось загрузить уведомления</p>
            <button className="retry-btn" onClick={loadNotifications}>
              Обновить
            </button>
          </div>
        )}

        {!loading && !error && notifs.length === 0 && (
          <div className="state-center">
            <i className="ti ti-bell-off" />
            <p>Нет уведомлений</p>
            <button className="retry-btn" onClick={loadNotifications}>
              Обновить
            </button>
          </div>
        )}

        {!loading && !error && groups.map(grp => (
          <div key={grp.label}>
            <div className="section-label">{grp.label}</div>
            {grp.items.map(n => <NotifCard key={n.id} n={n} />)}
          </div>
        ))}
      </div>
    </>
  )
}