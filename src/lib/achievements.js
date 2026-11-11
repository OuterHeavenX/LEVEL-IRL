const mi = n => Number(n) || 0;

export const landmarkMilestones = [
  { id:'brooklyn-bridge', miles:1.1, name:'Brooklyn Bridge Crossing', place:'New York City', sketch:'suspension', flavor:'A first crossing. The city is behind you; the campaign is ahead.' },
  { id:'golden-gate', miles:1.7, name:'Golden Gate Crossing', place:'San Francisco', sketch:'suspension', flavor:'Fog, steel, and forward motion.' },
  { id:'vegas-strip', miles:4.2, name:'Neon Recon', place:'Las Vegas Strip', sketch:'city', flavor:'Four miles of lights. Zero need for a save point.' },
  { id:'central-park', miles:6.1, name:'Central Park Loop', place:'New York City', sketch:'park', flavor:'One complete loop around the green heart of Manhattan.' },
  { id:'manhattan', miles:13.4, name:'Manhattan Traverse', place:'New York City', sketch:'city', flavor:'From one end of the island to the other — in accumulated steps.' },
  { id:'grand-canyon', miles:24, name:'Rim-to-Rim Equivalent', place:'Grand Canyon', sketch:'canyon', flavor:'A virtual rim-to-rim distance. Your legs have entered the briefing.' },
  { id:'marathon', miles:26.2, name:'The 26.2', place:'Marathon Distance', sketch:'road', flavor:'A full marathon worth of accumulated cardio distance.' },
  { id:'rhode-island', miles:48, name:'Rhode Island Traverse', place:'Approx. north-to-south', sketch:'map', flavor:'You have covered roughly the north-to-south span of America’s smallest state.' },
  { id:'appalachian-trail', miles:2190, name:'Appalachian Trail', place:'Eastern United States', sketch:'trail', flavor:'An entire long trail’s worth of accumulated distance.' },
  { id:'route-66', miles:2448, name:'Route 66', place:'Chicago → Santa Monica', sketch:'road', flavor:'A legendary road, completed one workout at a time.' },
  { id:'transamerica', miles:2800, name:'Continental Crossing', place:'Approx. U.S. coast-to-coast', sketch:'map', flavor:'A continent-sized campaign marker.' },
  { id:'great-wall', miles:13171, name:'Great Wall Campaign', place:'Great Wall of China', sketch:'wall', flavor:'An absurdly epic long-game milestone — exactly as an RPG should have.' }
];

export function totalDistanceMiles(data){
  return (data.workouts || []).flatMap(w => w.exercises || []).filter(e => e.type === 'cardio').reduce((sum,e) => {
    const d = mi(e.distance);
    return sum + (e.distanceUnit === 'km' ? d * 0.621371 : d);
  }, 0);
}

export function buildAchievementArchive(data, stats){
  const distance = totalDistanceMiles(data);
  const archive = [];
  const pushSeries = (kind, max, step, getValue, label, icon) => {
    for(let i=1;i<=max;i++){
      const target = i * step;
      archive.push({id:`${kind}-${target}`, kind, target, name:`${label} ${target.toLocaleString()}`, icon, unlocked:getValue() >= target});
    }
  };
  pushSeries('adventure',250,1,()=>stats.workouts,'Adventure','🗺️');
  pushSeries('sets',250,10,()=>stats.strengthSets,'Forge Sets','⚔️');
  pushSeries('cardio-min',250,30,()=>stats.cardio,'Cardio Minutes','🏃');
  pushSeries('distance',250,1,()=>distance,'Road Miles','🥾');
  pushSeries('level',100,1,()=>stats.level,'Level','✨');
  const nutritionDates = new Set((data.nutrition||[]).map(n=>n.date)).size;
  pushSeries('provisions',100,1,()=>nutritionDates,'Provision Days','🍎');
  landmarkMilestones.forEach(l => archive.push({...l,kind:'landmark',target:l.miles,icon:'📍',unlocked:distance>=l.miles}));
  archive.push({id:'box-protocol',kind:'secret',target:7,name:'Corrugated Tactics',icon:'📦',unlocked:stats.bestStreak>=7,flavor:'Sometimes legendary equipment is surprisingly rectangular.'});
  archive.push({id:'no-alert',kind:'secret',target:5,name:'No-Alert Week',icon:'❗',unlocked:stats.workouts>=5,flavor:'Five missions logged. Stay sharp. Stay quiet.'});
  return archive;
}

export function achievementSummary(data, stats){
  const archive = buildAchievementArchive(data, stats);
  const unlocked = archive.filter(a=>a.unlocked);
  const distance = totalDistanceMiles(data);
  const landmarks = landmarkMilestones.map(l=>({...l,unlocked:distance>=l.miles,remaining:Math.max(0,l.miles-distance)}));
  const nextLandmark = landmarks.find(l=>!l.unlocked) || landmarks[landmarks.length-1];
  return {archive, unlocked, landmarks, nextLandmark, distance, total:archive.length};
}

export function sketchSVG(type='road'){
  const common = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"';
  const paths = {
    suspension:`<path ${common} d="M6 35h68M16 35V12m48 23V12M16 17c13 12 35 12 48 0M9 25c8-6 15-7 22-2m18 0c7-5 14-4 22 2M28 35V24m24 11V24"/>`,
    wall:`<path ${common} d="M5 35c12-4 15-14 26-12s14 8 23 4 11-12 21-10M11 32v-9h10v6h10v-8h10v7h10v-7h10v3h10"/>`,
    city:`<path ${common} d="M7 36h67M14 36V18h11v18m4 0V10h13v26m4 0V22h10v14m5 0V15h8v21M33 15h5M33 20h5M33 25h5"/>`,
    park:`<path ${common} d="M6 35h68M17 35V22m0 0-7 7m7-7 7 7M39 35V15m0 0-9 10m9-10 9 10M61 35V24m0 0-6 7m6-7 6 7"/>`,
    canyon:`<path ${common} d="M5 15c14 2 18 13 28 10s13-12 21-7 10 15 21 13M7 34c13-1 18-8 26-7s14 8 22 6 11-6 18-5"/>`,
    trail:`<path ${common} d="M8 36c8-17 13-22 21-17s8 15 17 10 11-18 24-20M13 33l8-2m9-7 7 1m14-1 8-5"/>`,
    map:`<path ${common} d="M8 31l15-19 17 8 15-10 17 8-9 20-19-4-15 6zM23 12l6 28m11-20 4 14m11-24 8 28"/>`,
    road:`<path ${common} d="M27 40c0-13 7-16 11-25m15 25c0-13-7-16-11-25M40 37h1m-2-8h3m-1-8h1"/>`
  };
  return `<svg viewBox="0 0 80 48" aria-hidden="true">${paths[type] || paths.road}</svg>`;
}
