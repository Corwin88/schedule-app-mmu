import { generateMockSchedule, generateMockScheduleLog } from '../data/mock.js'

const BASE_URL = import.meta.env.PROD
  ? '/api'                  // на Vercel прокси будет работать по относительному пути
  : 'http://localhost:3000/api';  // для локальной разработки
const TEST_GROUP_ID = 999999;

export async function fetchGroups() {
  const res = await fetch(`${BASE_URL}/dictionary/groups`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const groups = await res.json();
  groups.push({
    groupOid: TEST_GROUP_ID,
    name: 'Тестовая группа (мок)',
    course: 0,
    faculty: 'Тестовый факультет',
    formOfEducation: 'очная',
    speciality: 'Тестовая специальность'
  });
  return groups;
}

export async function fetchSchedule(groupId, dateFrom, dateTo) {
  if (groupId == TEST_GROUP_ID) {
    // dateFrom — понедельник запрашиваемой недели, передаём его в генератор
    return generateMockSchedule(new Date(dateFrom));
  }
  const url = `${BASE_URL}/schedule/group/${groupId}?start=${dateFrom}&finish=${dateTo}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchScheduleLog(groupId, fromDate, toDate) {
  if (groupId == TEST_GROUP_ID) {
    return generateMockScheduleLog(new Date(fromDate));
  }
  const url = `${BASE_URL}/schedulelog?groupOid=${groupId}&fromDate=${fromDate}&toDate=${toDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return [];
  return JSON.parse(text);
}