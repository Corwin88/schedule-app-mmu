export default function BottomNav({ active, onChange, unreadCount }) {
  const items = [
    { id: 'schedule',      icon: 'ti-calendar', label: 'Расписание' },
    { id: 'search',        icon: 'ti-search',   label: 'Поиск' },
    { id: 'notifications', icon: 'ti-bell',     label: 'Уведомления' },
  ]

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <i className={`ti ${item.icon}`} />
          <span>{item.label}</span>
          {item.id === 'notifications' && unreadCount > 0 && (
            <div className="nav-badge" />
          )}
        </div>
      ))}
    </nav>
  )
}