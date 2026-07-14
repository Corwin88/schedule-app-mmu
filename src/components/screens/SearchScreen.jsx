import { useState, useEffect, useMemo } from 'react';
import { fetchSchedule } from '../../api/schedule';

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
  };
}

// Извлекаем уникальных преподавателей и аудитории
function parseData(raw) {
  if (!Array.isArray(raw)) return { teachers: [], rooms: [] };

  const teacherMap = new Map();
  const roomSet = new Set();

  raw.forEach(item => {
    if (item.lecturer && item.lecturerOid) {
      teacherMap.set(item.lecturerOid, {
        id: item.lecturerOid,
        name: item.lecturer,
        email: item.lecturerEmail || '',
        rank: item.lecturer_rank || '',
      });
    }
    if (item.auditorium) {
      roomSet.add(item.auditorium);
    }
  });

  return {
    teachers: Array.from(teacherMap.values()),
    rooms: Array.from(roomSet).sort(),
  };
}

export default function SearchScreen({ group }) {
  const [tab, setTab] = useState('teachers'); // 'teachers' | 'rooms'
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  useEffect(() => {
    if (!group?.id) {
      setTeachers([]);
      setRooms([]);
      setLoading(false);
      return;
    }

    const { dateFrom, dateTo } = getWeekRange();
    setLoading(true);
    setError(null);

    fetchSchedule(group.id, dateFrom, dateTo)
      .then(data => {
        console.log('SearchScreen расписание:', data); // диагностика
        const { teachers, rooms } = parseData(data);
        setTeachers(teachers);
        setRooms(rooms);
        setLoading(false);
      })
      .catch(err => {
        console.error('SearchScreen ошибка:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [group]);

  const filteredTeachers = useMemo(() => {
    if (!teacherQuery.trim()) return teachers;
    const q = teacherQuery.toLowerCase();
    return teachers.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, teacherQuery]);

  const filteredRooms = useMemo(() => {
    if (!roomQuery.trim()) return rooms;
    const q = roomQuery.toLowerCase();
    return rooms.filter(r => r.toLowerCase().includes(q));
  }, [rooms, roomQuery]);

  if (!group?.id) {
    return (
      <div className="screen-body">
        <div className="state-center">
          <i className="ti ti-search-off" />
          <p>Выберите группу для поиска</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="header" style={{ paddingBottom: 0 }}>
        <div className="header-top" style={{ marginBottom: 6 }}>
          <div className="header-title">Поиск</div>
          <div className="header-sub">{group.name}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={() => setTab('teachers')}
            style={{
              background: tab === 'teachers' ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Преподаватели
          </button>
          <button
            onClick={() => setTab('rooms')}
            style={{
              background: tab === 'rooms' ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Аудитории
          </button>
        </div>
      </div>

      <div className="screen-body">
        {loading && (
          <div className="state-center">
            <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
            <p>Загрузка данных...</p>
          </div>
        )}

        {error && (
          <div className="state-center">
            <i className="ti ti-wifi-off" />
            <p>Ошибка загрузки</p>
          </div>
        )}

        {!loading && !error && tab === 'teachers' && (
          <div>
            <input
              type="text"
              placeholder="🔍 Имя преподавателя"
              value={teacherQuery}
              onChange={e => setTeacherQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '12px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />

            {selectedTeacher ? (
              <div>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginBottom: '10px',
                  }}
                >
                  ← Назад к списку
                </button>
                <TeacherSchedule
                  teacher={selectedTeacher}
                  groupId={group.id}
                />
              </div>
            ) : (
              <div className="group-list">
                {filteredTeachers.map(t => (
                  <div
                    key={t.id}
                    className="group-row"
                    onClick={() => setSelectedTeacher(t)}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {t.rank} {t.email && `· ${t.email}`}
                      </div>
                    </div>
                    <i className="ti ti-chevron-right" style={{ color: '#999' }} />
                  </div>
                ))}
                {filteredTeachers.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Ничего не найдено</p>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && !error && tab === 'rooms' && (
          <div>
            <input
              type="text"
              placeholder="🔍 Номер аудитории"
              value={roomQuery}
              onChange={e => setRoomQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '12px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            <div className="group-list">
              {filteredRooms.map(room => (
                <div key={room} className="group-row">
                  <span>🚪 {room}</span>
                </div>
              ))}
              {filteredRooms.length === 0 && (
                <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Ничего не найдено</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Компонент отображения занятий преподавателя на текущей неделе
function TeacherSchedule({ teacher, groupId }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher || !groupId) return;
    const { dateFrom, dateTo } = getWeekRange();
    setLoading(true);
    fetchSchedule(groupId, dateFrom, dateTo)
      .then(data => {
        const filtered = data
          .filter(item => item.lecturerOid === teacher.id)
          .map(item => ({
            date: item.date,
            dayOfWeek: item.dayOfWeek,
            start: item.beginLesson,
            end: item.endLesson,
            discipline: item.discipline,
            room: item.auditorium,
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setClasses(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [teacher, groupId]);

  if (loading) return <p style={{ padding: 12 }}>Загрузка...</p>;
  if (classes.length === 0) return <p style={{ padding: 12 }}>Нет занятий на этой неделе.</p>;

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div>
      {classes.map((c, i) => (
        <div key={i} className="group-row">
          <div>
            <div style={{ fontWeight: 500 }}>{c.discipline}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {dayNames[c.dayOfWeek - 1]}, {c.date} · {c.start}–{c.end} · 🚪 {c.room}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}