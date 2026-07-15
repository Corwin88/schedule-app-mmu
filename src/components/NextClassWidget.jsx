import { useState, useEffect } from 'react';
import { fetchSchedule } from '../api/schedule';

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { dateFrom: fmt(monday), dateTo: fmt(sunday), monday };
}

function normalizeAndFlatten(rawData) {
  if (!Array.isArray(rawData)) return [];
  return rawData.map(item => ({
    id: item.lessonOid,
    start: item.beginLesson,
    end: item.endLesson,
    name: item.discipline,
    room: item.auditorium,
    teacher: item.lecturer,
    date: item.date,       // "2026.07.06"
    dayOfWeek: item.dayOfWeek,
  })).sort((a, b) => {
    // ✅ БАГ #4 ИСПРАВЛЕН: парсим дату локально, без UTC
    const [ay, am, ad] = a.date.split('.').map(Number);
    const [by, bm, bd] = b.date.split('.').map(Number);
    const dateA = new Date(ay, am - 1, ad);
    const dateB = new Date(by, bm - 1, bd);
    if (dateA - dateB !== 0) return dateA - dateB;
    const [ah, amin] = a.start.split(':').map(Number);
    const [bh, bmin] = b.start.split(':').map(Number);
    return (ah * 60 + amin) - (bh * 60 + bmin);
  });
}

function findNextClass(flatSchedule) {
  const now = new Date();
  for (const cls of flatSchedule) {
    // ✅ БАГ #4 ИСПРАВЛЕН: локальная дата
    const [year, month, day] = cls.date.split('.').map(Number);
    const [h, m] = cls.start.split(':').map(Number);
    const classDate = new Date(year, month - 1, day, h, m);
    if (classDate > now) return cls;
  }
  return null;
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
        setNextClass(findNextClass(flat));
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
        Пар нет — отдыхай 😊
      </div>
    );
  }

  const cls = nextClass;
  const dayIndex = cls.dayOfWeek - 1;

  // ✅ БАГ #4 ИСПРАВЛЕН: локальная дата для сравнения
  const [cy, cm, cd] = cls.date.split('.').map(Number);
  const classDay = new Date(cy, cm - 1, cd);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const monthNames = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const dayOfWeekShort = ['вс','пн','вт','ср','чт','пт','сб'][classDay.getDay()];
  const dayMonth = `${classDay.getDate()} ${monthNames[classDay.getMonth()]}`;

  let dateLabel = '';
  if (classDay.getTime() === today.getTime()) {
    dateLabel = `Сегодня в ${cls.start}`;
  } else if (classDay.getTime() === tomorrow.getTime()) {
    dateLabel = `Завтра в ${cls.start}`;
  } else {
    dateLabel = `${dayOfWeekShort}, ${dayMonth} в ${cls.start}`;
  }

  return (
    <div
      onClick={() => onNavigate && onNavigate(dayIndex)}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontWeight: 600 }}>
          {classDay.getTime() === today.getTime() ? 'Следующая пара' : 'Ближайшая пара'}
        </span>
        <span style={{ opacity: 0.8 }}>{dateLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontWeight: 500, fontSize: '16px' }}>{cls.name}</span>
        {cls.teacher && (
          <span style={{ opacity: 0.85, fontSize: '13px', marginLeft: '8px', whiteSpace: 'nowrap' }}>
            👤 {cls.teacher}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', opacity: 0.85 }}>
        <span>🕒 {cls.start} – {cls.end}</span>
        {cls.room && <span>🚪 {cls.room}</span>}
      </div>
    </div>
  );
}
