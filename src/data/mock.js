// src/data/mock.js

// Форматирование даты в YYYY.MM.DD (как в реальном API)
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// Генерирует расписание на неделю, начиная с понедельника `monday`
export function generateMockSchedule(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push(formatDate(date));
  }

  return [
    // Понедельник (dayOfWeek=1)
    {
      lessonOid: 101,
      dayOfWeek: 1,
      date: days[0],
      beginLesson: '09:00',
      endLesson: '10:30',
      discipline: 'История России',
      auditorium: 'Главный корпус/313(л)',
      lecturer: 'Петрич Л.В.',
      kindOfWork: 'Лекция',
    },
    {
      lessonOid: 102,
      dayOfWeek: 1,
      date: days[0],
      beginLesson: '10:45',
      endLesson: '12:15',
      discipline: 'Философия',
      auditorium: 'Главный корпус/207(л)',
      lecturer: 'Иванов И.И.',
      kindOfWork: 'Семинар',
    },
    {
      lessonOid: 103,
      dayOfWeek: 1,
      date: days[0],
      beginLesson: '13:00',
      endLesson: '14:30',
      discipline: 'Английский язык',
      auditorium: 'Главный корпус/305',
      lecturer: 'Смирнова А.А.',
      kindOfWork: 'Лабораторная работа',
    },
    // Вторник (dayOfWeek=2)
    {
      lessonOid: 201,
      dayOfWeek: 2,
      date: days[1],
      beginLesson: '09:00',
      endLesson: '10:30',
      discipline: 'Математический анализ',
      auditorium: 'Главный корпус/412',
      lecturer: 'Кузнецов В.В.',
      kindOfWork: 'Лекция',
    },
    {
      lessonOid: 202,
      dayOfWeek: 2,
      date: days[1],
      beginLesson: '10:45',
      endLesson: '12:15',
      discipline: 'Физика',
      auditorium: 'Главный корпус/511',
      lecturer: 'Петров П.П.',
      kindOfWork: 'Лабораторная работа',
    },
    // Среда (dayOfWeek=3)
    {
      lessonOid: 301,
      dayOfWeek: 3,
      date: days[2],
      beginLesson: '11:00',
      endLesson: '12:30',
      discipline: 'Программирование',
      auditorium: 'Главный корпус/208',
      lecturer: 'Сидоров С.С.',
      kindOfWork: 'Лекция',
    },
    {
      lessonOid: 302,
      dayOfWeek: 3,
      date: days[2],
      beginLesson: '13:00',
      endLesson: '14:30',
      discipline: 'Базы данных',
      auditorium: 'Главный корпус/315',
      lecturer: 'Федоров Ф.Ф.',
      kindOfWork: 'Семинар',
    },
    // Четверг (dayOfWeek=4)
    {
      lessonOid: 401,
      dayOfWeek: 4,
      date: days[3],
      beginLesson: '09:00',
      endLesson: '10:30',
      discipline: 'Экономика',
      auditorium: 'Главный корпус/120',
      lecturer: 'Григорьев Г.Г.',
      kindOfWork: 'Лекция',
    },
    {
      lessonOid: 402,
      dayOfWeek: 4,
      date: days[3],
      beginLesson: '10:45',
      endLesson: '12:15',
      discipline: 'Менеджмент',
      auditorium: 'Главный корпус/220',
      lecturer: 'Алексеев А.А.',
      kindOfWork: 'Семинар',
    },
    {
      lessonOid: 403,
      dayOfWeek: 4,
      date: days[3],
      beginLesson: '13:00',
      endLesson: '14:30',
      discipline: 'Маркетинг',
      auditorium: 'Главный корпус/330',
      lecturer: 'Борисов Б.Б.',
      kindOfWork: 'Лекция',
    },
    // Пятница (dayOfWeek=5)
    {
      lessonOid: 501,
      dayOfWeek: 5,
      date: days[4],
      beginLesson: '09:00',
      endLesson: '10:30',
      discipline: 'Социология',
      auditorium: 'Главный корпус/415',
      lecturer: 'Владимиров В.В.',
      kindOfWork: 'Семинар',
    },
  ];
}

// Генерирует лог изменений для недели
export function generateMockScheduleLog(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push(formatDate(date));
  }

  return [
    {
      lessonOid: 1001,
      date: days[0],
      dayOfWeek: 1,
      discipline: 'История России',
      auditorium: 'Главный корпус/313(л)',
      lecturer: 'Петрич Л.В.',
      kindOfWork: 'Лекция',
      replaces: 'Замена',
      beginLesson: '09:00',
      endLesson: '10:30',
    },
    {
      lessonOid: 1002,
      date: days[1],
      dayOfWeek: 2,
      discipline: 'Объявление',
      auditorium: '',
      lecturer: 'Учебный отдел',
      kindOfWork: '',
      beginLesson: '',
      endLesson: '',
    },
  ];
}

// Совместимость со старыми импортами (больше не используются)
export const MOCK_SCHEDULE = [];
export const MOCK_NOTIFICATIONS = [];