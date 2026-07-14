import { useState } from 'react';
import GroupSelector from '../components/GroupSelector';
import ScheduleView from '../components/ScheduleView';

export default function SchedulePage() {
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <h1>Расписание занятий</h1>
      <GroupSelector onSelect={setSelectedGroupId} />
      <ScheduleView groupId={selectedGroupId} />
    </div>
  );
}