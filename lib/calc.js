export const COMPLETION_HOURS = 32;

export const STATUS_LABEL = {
  achieved: { icon: '🎉', text: '이수 기준 달성', cls: 'achieved' },
  ok: { icon: '🟢', text: '정상', cls: 'ok' },
  warn: { icon: '🟡', text: '주의', cls: 'warn' },
  danger: { icon: '🔴', text: '미달 위험', cls: 'danger' }
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function isDone(session) {
  return session.date <= todayStr();
}

export function computeStats(sessions, attendanceRows) {
  const doneSessions = sessions.filter(isDone);
  const totalAssigned = sessions.reduce((s, x) => s + Number(x.hours), 0);
  const doneAssigned = doneSessions.reduce((s, x) => s + Number(x.hours), 0);
  const recognized = attendanceRows.reduce((s, a) => s + Number(a.recognized_hours || 0), 0);
  const attendedCount = attendanceRows.filter((a) => a.status === '출석').length;
  const doneCount = doneSessions.length;
  const attendanceRate = doneCount ? attendedCount / doneCount : 0;
  const remainingScheduled = totalAssigned - doneAssigned;
  const stillNeeded = Math.max(COMPLETION_HOURS - recognized, 0);
  const slack = remainingScheduled - stillNeeded;

  let status = 'ok';
  if (recognized >= COMPLETION_HOURS) status = 'achieved';
  else if (slack < 0) status = 'danger';
  else if (slack < 4) status = 'warn';

  return {
    totalSessions: sessions.length,
    doneCount,
    attendedCount,
    attendanceRate,
    recognizedHours: recognized,
    completionHours: COMPLETION_HOURS,
    stillNeeded,
    remainingScheduled,
    slack,
    status
  };
}

export function recognizedHoursFor(status, hours) {
  if (status === '출석') return hours;
  if (status === '지각' || status === '조퇴') return hours * 0.5;
  return 0;
}
