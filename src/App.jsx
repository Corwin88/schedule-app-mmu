import { useState, useEffect } from 'react'
import BottomNav from './components/BottomNav.jsx'
import ScheduleScreen from './components/screens/ScheduleScreen.jsx'
import NotificationsScreen from './components/screens/NotificationsScreen.jsx'
import SearchScreen from './components/screens/SearchScreen.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import { subscribeToPush } from './services/pushSubscription.js'

const STORAGE_KEY = 'selectedGroup'

function loadSavedGroup() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && parsed.id && parsed.name) return parsed
    }
  } catch (e) {}
  return null
}

export default function App() {
  const [screen, setScreen] = useState('schedule')
  const [group, setGroup] = useState(loadSavedGroup)
  const [unreadCount, setUnreadCount] = useState(0)
  const [targetDay, setTargetDay] = useState(null)

  useEffect(() => {
    if (group?.id) {
      subscribeToPush(group.id)
    }
  }, [group?.id])

  function handleSaveGroup(newGroupId, newGroupName) {
    const newGroup = { id: newGroupId, name: newGroupName }
    setGroup(newGroup)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroup))
  }

  function handleUnreadCountChange(count) {
    setUnreadCount(count)
  }

  function handleNavigateToDay(dayIndex) {
    setTargetDay(dayIndex)
    setScreen('schedule')
  }

  return (
    <PasswordGate>
      <div className="app">
        {screen === 'schedule' && (
          <ScheduleScreen
            group={group}
            externalActiveDay={targetDay}
            onDayChange={() => setTargetDay(null)}
            onSaveGroup={handleSaveGroup}
          />
        )}
        {screen === 'search' && (
          <SearchScreen group={group} onNavigateToDay={handleNavigateToDay} />
        )}
        {screen === 'notifications' && (
          <NotificationsScreen
            group={group}
            onUnreadCountChange={handleUnreadCountChange}
          />
        )}

        <BottomNav
          active={screen}
          onChange={setScreen}
          unreadCount={unreadCount}
        />

        <InstallPrompt />
      </div>
    </PasswordGate>
  )
}