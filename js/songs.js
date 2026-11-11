const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function seq(str, unit) {
  return str.trim().split(/\s+/).filter(tok => tok !== '|').map(tok => {
    const [n, b] = tok.split(':');
    return { midi: midi(n), dur: (b ? +b : 1) * unit };
  });
}

export const SONGS = [
  {
    name: '小星星', prop: 'duck', inst: 'keys',
    notes: seq('C5 C5 G5 G5 A5 A5 G5:2 | F5 F5 E5 E5 D5 D5 C5:2', 0.4),
  },
  {
    name: '欢乐颂', prop: 'tile', inst: 'keys',
    notes: seq('E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | E5:1.5 D5:.5 D5:2', 0.38),
  },
  {
    name: '致爱丽丝', prop: 'horn', inst: 'musicbox',
    notes: seq('E5 D#5 E5 D#5 E5 B4 D5 C5 A4:3 | C4 E4 A4 B4:3 | E4 C5 B4 A4:4', 0.2),
  },
  {
    name: '卡农', prop: 'step', inst: 'glass',
    notes: seq(`A5:2 F#5 G5 A5:2 F#5 G5 A5 A4 B4 C#5 D5 E5 F#5 G5 |
                F#5:2 D5 E5 F#5:2 F#4 G4 A4 B4 A4 G4 A4 F#4 G4 A4 | G4:4`, 0.15),
  },
  {
    name: '茉莉花', prop: 'gem', inst: 'bell',
    notes: seq('E5:2 E5 G5 A5 C6 C6 A5 | G5:2 G5 A5 G5:4 | G5:2 G5:2 G5:2 E5 G5 | A5:2 A5:2 G5:4', 0.28),
  },
  {
    name: '土耳其进行曲', prop: 'edge', inst: 'keys',
    notes: seq(`B4 A4 G#4 A4 C5:4 | D5 C5 B4 C5 E5:4 | F5 E5 D#5 E5 B5 A5 G#5 A5
                B5 A5 G#5 A5 C6:4 | A5:2 C6:2 | B5:2 A5:2 G5:2 A5:2 | B5:2 A5:2 G5:2 A5:2 |
                B5:2 A5:2 G5:2 F#5:2 | E5:4`, 0.135),
  },
  {
    name: '康康舞曲', prop: 'cube', inst: 'pluck',
    notes: seq(`C5:2 C5:2 D5 F5 E5 D5 | G5:2 G5:2 G5 A5 E5 F5 | D5:2 D5:2 D5 F5 E5 D5 |
                C5 C6 B5 A5 G5 F5 E5 D5 | C5:4`, 0.19),
  },
  {
    name: '铃儿响叮当', prop: 'bar', inst: 'marimba',
    notes: seq(`E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:.5 | E5:4 |
                F5 F5 F5:1.5 F5:.5 | F5 E5 E5 E5:.5 E5:.5 | G5 G5 F5 D5 | C5:4`, 0.3),
  },
];

export const DECOYS = [
  '生日快乐', '两只老虎', '婚礼进行曲', '天鹅湖', '蓝色多瑙河', '命运交响曲', '新年好',
  '友谊地久天长', '四小天鹅', '月光奏鸣曲', '小步舞曲', '拉德斯基进行曲', '匈牙利舞曲',
  '摇篮曲', '斗牛士之歌', '送别',
];
