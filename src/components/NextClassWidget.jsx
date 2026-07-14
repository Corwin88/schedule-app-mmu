import { useState, useEffect } from 'react';
import { fetchSchedule } from '../api/schedule';

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    dateFrom: monday.toISOString().split('T')[0],
    dateTo: sunday.toISOString().split('T')[0],
    monday,
  };
}

// Преобразует сырые данные в плоский список с добавлением даты и времени начала
function normalizeAndFlatten(rawData) {
  if (!Array.isArray(rawData)) return [];

  return rawData.map(item => ({
    id: item.lessonOid,
    start: item.beginLesson,
    end: item.endLesson,
    name: item.discipline,
    room: item.auditorium,
    teacher: item.lecturer,
    date: item.date,        // "2026.07.06"
    dayOfWeek: item.dayOfWeek, // 1..7
  })).sort((a, b) => {
    // сортируем по дате, затем по времени
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA - dateB !== 0) return dateA - dateB;
    const [ah, am] = a.start.split(':').map(Number);
    const [bh, bm] = b.start.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });
}

// Ищет самую первую будущую пару (включая сегодняшние, которые ещё не начались)
function findNextClass(flatSchedule) {
  const now = new Date();
  for (const cls of flatSchedule) {
    const [year, month, day] = cls.date.split('.').map(Number);
    const [h, m] = cls.start.split(':').map(Number);
    const classDate = new Date(year, month - 1, day, h, m);
    if (classDate > now) {
      return cls;
    }
  }
  return null; // все пары уже прошли
}

export default function NextClassWidget({ groupId, onNavigate }) {
  const [nextClass, setNextClass] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setNextClass(null);
      setLoading(false);
      return;
    }

    const { dateFrom, dateTo } = getWeekRange();
    setLoading(true);

    fetchSchedule(groupId, dateFrom, dateTo)
      .then(data => {
        const flat = normalizeAndFlatten(data);
        const next = findNextClass(flat);
        setNextClass(next);
        setLoading(false);
      })
      .catch(() => {
        setNextClass(null);
        setLoading(false);
      });
  }, [groupId]);

  if (loading) {
    return (
      <div style={{ padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
        Загрузка...
      </div>
    );
  }

  if (!nextClass) {
    return (
      <div style={{ padding: '8px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
        Пар нет - отдыхай 😊
      </div>
    );
  }

  const cls = nextClass;

  // Определяем индекс дня для навигации (0 = Пн, ..., 6 = Вс)
  const dayIndex = cls.dayOfWeek - 1; // API: 1=Пн -> 0

  // Форматируем дату и время
  const classDate = new Date(cls.date.replace(/\./g, '-'));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const classDay = new Date(classDate.getFullYear(), classDate.getMonth(), classDate.getDate());

  let dateLabel = '';
  const timeLabel = cls.start;
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const dayOfWeekShort = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][classDate.getDay()];
  const dayMonth = `${classDate.getDate()} ${monthNames[classDate.getMonth()]}`;

  if (classDay.getTime() === today.getTime()) {
    dateLabel = `Сегодня в ${timeLabel}`;
  } else if (classDay.getTime() === tomorrow.getTime()) {
    dateLabel = `Завтра в ${timeLabel}`;
  } else {
    dateLabel = `${dayOfWeekShort}, ${dayMonth} в ${timeLabel}`;
  }

  const handleClick = () => {
    if (onNavigate && dayIndex !== undefined) {
      onNavigate(dayIndex);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        margin: '8px 16px',
        padding: '10px 12px',
        color: '#fff',
        fontSize: '14px',
        lineHeight: 1.4,
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
      onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
      onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
    >
      {/* Строка 1: тип пары + дата/время */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontWeight: 600 }}>
          {classDay.getTime() === today.getTime() ? 'Следующая пара' : 'Ближайшая пара'}
        </span>
        <span style={{ opacity: 0.8 }}>{dateLabel}</span>
      </div>

      {/* Строка 2: название пары + преподаватель */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontWeight: 500, fontSize: '16px' }}>{cls.name}</span>
        {cls.teacher && (
          <span style={{ opacity: 0.85, fontSize: '13px', marginLeft: '8px', whiteSpace: 'nowrap' }}>
            👤 {cls.teacher}
          </span>
        )}
      </div>

      {/* Строка 3: время пары + аудитория */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', opacity: 0.85 }}>
        <span>🕒 {cls.start} – {cls.end}</span>
        {cls.room && <span>🚪 {cls.room}</span>}
      </div>
    </div>
  );
}