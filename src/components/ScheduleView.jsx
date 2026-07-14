import { useState, useEffect } from 'react';
import { fetchSchedule } from '../api/schedule';

export default function ScheduleView({ groupId }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setSchedule(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Вычисляем понедельник и воскресенье текущей недели
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 – вс, 1 – пн ...
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dateFrom = monday.toISOString().split('T')[0];
    const dateTo = sunday.toISOString().split('T')[0];

    fetchSchedule(groupId, dateFrom, dateTo)
      .then((data) => {
        setSchedule(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [groupId]);

  if (!groupId) return <p>Выберите группу, чтобы увидеть расписание.</p>;
  if (loading) return <p>Загрузка расписания...</p>;
  if (error) return <p style={{ color: 'red' }}>Ошибка: {error}</p>;
  if (!schedule) return <p>Нет данных о расписании.</p>;

  // Временно показываем сырой JSON – потом заменим на красивую таблицу
  return (
    <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
      {JSON.stringify(schedule, null, 2)}
    </pre>
  );
}