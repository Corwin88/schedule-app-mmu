import { useState, useEffect } from 'react';
import { fetchGroups } from '../api/schedule';

export default function GroupSelector({ onSelect }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGroups()
      .then((data) => {
        // data – массив объектов с полями groupOid, name, faculty, course
        setGroups(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Загрузка списка групп...</p>;
  if (error) return <p style={{ color: 'red' }}>Ошибка загрузки групп: {error}</p>;

  return (
    <select
      onChange={(e) => onSelect(e.target.value)}
      defaultValue=""
      style={{ padding: '8px', fontSize: '16px', marginBottom: '20px' }}
    >
      <option value="" disabled>
        -- Выберите группу --
      </option>
      {groups.map((g) => (
        <option key={g.groupOid} value={g.groupOid}>
          {g.name} ({g.faculty}, {g.course} курс)
        </option>
      ))}
    </select>
  );
}