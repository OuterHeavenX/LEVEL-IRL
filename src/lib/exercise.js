import { escapeHtml } from './dom.js';

// A stored icon wins unless it is the generic '⚔️', which means "pick one by name".
export const exerciseIcon = (name, type = 'strength', fallback = '') => {
  if (fallback && fallback !== '⚔️') return fallback;
  const value = String(name || '').toLowerCase();
  const icons = [
    [/treadmill|run|jog|sprint/, '🏃'], [/walk|hike/, '🥾'], [/bike|cycle|spin/, '🚴'],
    [/row/, '🚣'], [/swim/, '🏊'], [/jump rope|skipping/, '🪢'], [/stair|step/, '🪜'],
    [/bench|chest press|push.?up/, '🏋️'], [/curl|bicep/, '💪'], [/shoulder|overhead press/, '🙆'],
    [/deadlift/, '🏗️'], [/squat|leg press/, '🦵'], [/lunge/, '🤺'], [/calf/, '🦶'],
    [/pull.?up|lat pull/, '🧗'], [/plank|core|crunch|sit.?up/, '🧘'], [/fly|deltoid/, '🪽'],
    [/yoga|stretch|mobility/, '🤸'], [/boxing|punch|kickbox/, '🥊'], [/dance/, '💃']
  ];
  return icons.find(([pattern]) => pattern.test(value))?.[1] || (type === 'cardio' ? '❤️' : '🏋️');
};

// One-line summary of an exercise. Returns HTML-escaped text; do not escape it again.
export function exerciseDetail(e) {
  if (e?.type === 'cardio') {
    const d = Number(e.distance);
    const distance = d > 0 ? ` · ${d.toFixed(d % 1 ? 2 : 0)} ${escapeHtml(e.distanceUnit || 'mi')}` : '';
    return `${Number(e.duration) || 0} min${distance}`;
  }
  return `${Number(e?.sets) || 0} sets × ${Number(e?.reps) || 0} reps · ${e?.weight ? escapeHtml(e.weight) : 'no weight'}`;
}
