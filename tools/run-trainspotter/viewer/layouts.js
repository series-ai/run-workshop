// Demo layouts: track plans for the viewer and the shots. Plain data, no dependencies.
// Steps use the trackpath.js Layout format. Each layout names where the chosen train starts
// (`main`), any other trains running or parked on it (`trains`, consist names from demo.js),
// and pieces the overhead wires leave out. A train is {consist: name} or {cars: [...]}; `reverse`
// runs it the other way round the track.

const C192 = 'track-curve-90-r192';
const C256 = 'track-curve-90-r256';
const S128 = 'track-straight-128';
const S64 = 'track-straight-64';
const left = (piece) => ({ piece, enter: 'b', leave: 'a' }); // a right-hand curve run backwards turns left
const times = (n, step) => Array(n).fill(step);

export const LAYOUTS = {
  'Country junction': {
    about: 'An oval with a passing loop, a country station and a signal box.',
    steps: [
      C192, C192, ...times(5, S128), C192, C192,
      'track-switch-right', S128, { piece: 'track-switch-left', enter: 'b', leave: 'a' },
      { piece: S128, from: [9, 'c'] },
    ],
    main: { step: 4, u: 120 },
    trains: [],
  },

  'Figure eight': {
    about: 'Two loops crossing on the level, the classic train-set figure of eight.',
    // 0: the crossing; a left-hand loop from b back into c; a right-hand loop from d back into a
    steps: [
      'track-crossing-90', S128, left(C192), left(C192), left(C192), S128,
      { piece: S128, from: [0, 'd'] }, C192, C192, C192, S128,
    ],
    main: { step: 1, u: 60 },
    trains: [],
  },

  'Mountain line': {
    about: 'Up a ramp onto a stone viaduct and down again, over a river on a truss bridge, across a road and through a tunnel.',
    steps: [
      C192, C192,
      'track-ramp-32', 'bridge-viaduct-arch', 'bridge-viaduct-arch', { piece: 'track-ramp-32', enter: 'b', leave: 'a' },
      C192, C192,
      S128, 'bridge-truss', S64, 'track-level-crossing', S128, S128, S64,
    ],
    main: { step: 8, u: 100 },
    trains: [],
    tunnel: [12, 13], // steps inside the hill
    noWires: [12, 13],
  },

  'Big trainset': {
    about: 'A double-track main line round a town station, with a goods yard and a turntable depot inside the loop.',
    steps: [
      // 0-19: inner main line; the yard leaves it at 12
      C192, C192, ...times(8, S128), C192, C192,
      'track-switch-right', ...times(6, S128),
      // 19-21: yard road 1, ending at a buffer stop just past the second points
      { piece: S128, from: [12, 'c'] }, 'track-switch-right', 'track-buffer-stop',
      // 22-26: yard road 2 to the turntable, a buffer stop beyond it, and a stall off its inner side
      { piece: S128, from: [20, 'c'] }, 'track-turntable', 'track-buffer-stop',
      { piece: S64, from: [23, 'c'] }, 'track-buffer-stop',
      // 27-46: outer main line, 64 outside the inner one, on concentric curves
      { piece: C256, at: { p: [-64, 0, 0], yaw: 0 } }, C256, ...times(8, S128), C256, C256, ...times(8, S128),
    ],
    main: { step: 4, u: 120 },
    trains: [
      { consist: 'Bullet set', step: 39, u: 60, speed: 120, reverse: true },
      // parked: a shunter and two wagons in the yard, a tank engine on the turntable
      { cars: [{ id: 'diesel-yard-shunter' }, { id: 'wagon-tank' }, { id: 'wagon-gondola', load: 'load-coal' }], step: 20, u: 250, speed: 0 },
      { cars: [{ id: 'steam-tank-0-6-0' }], step: 23, u: 150, speed: 0 },
    ],
    noWires: [19, 20, 21, 22, 23, 24, 25, 26],
  },

  'Grand trainset': grand(),
};

/**
 * The showpiece: a big model railway on a baseboard. A double-track main line round the
 * board (inner R192, outer R256) with a through station on the left, a mountain range with
 * double-track tunnels along the back, a goods yard of six roads in front fed by a ladder of
 * points, an upper line inside that climbs to a plateau on viaducts and runs through its own
 * tunnel, and a branch with a shuttle from a halt at the front to a town terminus at the back.
 * `marks` names the step indices the scenery and trains refer to.
 */
function grand() {
  const steps = [];
  const marks = {};
  const add = (s, name) => {
    if (name) marks[name] = steps.length;
    steps.push(s);
    return steps.length - 1;
  };
  const run = (n, s, name) => {
    const first = steps.length;
    for (let k = 0; k < n; k++) add(s);
    if (name) marks[name] = first;
    return first;
  };
  // inner main (R192) from (0, 0) heading -Z: back straight (+X, z -192), right side (+Z, x 2176),
  // front straight (-X, z 704), left side (-Z, x 0) with the station
  add(C192); run(14, S128, 'innerBack'); add(C192); run(4, S128, 'innerRight'); add(C192); run(14, S128, 'innerFront');
  add(C192); run(4, S128, 'innerLeft');
  // outer main (R256), 64 outside; the yard ladder leaves its front straight at the first points
  add({ piece: C256, at: { p: [-64, 0, 0], yaw: 0 } }, 'outerStart'); run(14, S128, 'outerBack'); add(C256); run(4, S128, 'outerRight');
  add(C256); add('track-switch-left', 'yardPoints'); run(12, S128, 'outerFront'); add(C256); run(4, S128, 'outerLeft');
  // the yard: road k branches from road k-1's points 64 further out and 256 further left
  const roadLens = [11, 9, 7, 5, 3, 3];
  marks.roads = [];
  let feed = [marks.yardPoints, 'c'];
  roadLens.forEach((n, k) => {
    const last = k === roadLens.length - 1;
    const sw = add(last ? { piece: S128, from: feed } : { piece: 'track-switch-left', from: feed });
    const first = run(n, S128);
    add('track-buffer-stop');
    marks.roads.push({ points: sw, first, end: first + n - 1, length: last ? (n + 1) * 128 : n * 128 });
    feed = [sw, 'c'];
  });
  // the upper line: an oval from (640, 0) heading +X, through a tunnel, up two ramps onto viaducts
  // and round a plateau 64 up, back down the other side
  add({ piece: S128, at: { p: [640, 0, 0], yaw: 270 } }, 'upperTunnel'); add(S128);
  add('track-ramp-32', 'upperRampUp'); add('track-ramp-32');
  add('bridge-viaduct-arch', 'upperViaductA'); add('bridge-viaduct-arch');
  add(C192, 'upperTop'); add(C192);
  add('bridge-viaduct-arch', 'upperViaductB'); add('bridge-viaduct-arch');
  add({ piece: 'track-ramp-32', enter: 'b', leave: 'a' }, 'upperRampDown'); add({ piece: 'track-ramp-32', enter: 'b', leave: 'a' });
  add(S128, 'upperGround'); add(S128); add(C192); add(C192);
  // the branch: from a halt at the front (x 2460, z 960) north through a tunnel, round to a terminus in the town
  add({ piece: S128, at: { p: [2460, 0, 960], yaw: 0 } }, 'branchStart'); run(9, S128);
  marks.branchTunnel = marks.branchStart + 6;
  add(left(C192), 'branchCurve'); run(5, S128, 'branchTown'); add('track-buffer-stop', 'branchEnd');
  add({ piece: 'track-buffer-stop', from: [marks.branchStart, 'a'] }, 'branchHalt');
  const wired = new Set();
  for (let i = 0; i < marks.outerLeft + 4; i++) wired.add(i);
  // no masts inside the back tunnels
  for (const k of [4, 5, 6, 7]) { wired.delete(marks.innerBack + k); wired.delete(marks.outerBack + k); }
  return {
    about: 'A big model railway: a double-track main line through mountain tunnels, a station, a yard full of wagons, an upper line on viaducts and a branch to the town.',
    baseboard: true,
    steps,
    marks,
    main: { step: marks.innerFront + 1, u: 60, stops: [{ step: marks.innerLeft + 2, at: 110, dwell: 8 }] },
    trains: [
      { consist: 'Electric express', step: marks.outerBack + 3, u: 40, speed: 110, reverse: true, stops: [{ step: marks.outerLeft + 1, at: 100, dwell: 8 }] },
      { consist: 'Western 4-4-0', step: marks.upperGround, u: 40, speed: 70 },
      { consist: 'Rural railcar', step: marks.branchStart + 3, u: 60, speed: 80, shuttle: true },
      // parked in the yard, fronts near the buffer stops
      ...[
        [{ id: 'wagon-boxcar' }, { id: 'wagon-covered-hopper' }, { id: 'wagon-tank' }, { id: 'wagon-boxcar' }, { id: 'wagon-refrigerator' },
          { id: 'wagon-covered-hopper' }, { id: 'wagon-tank' }, { id: 'wagon-livestock' }, { id: 'wagon-boxcar' }],
        [{ id: 'coach-intercity' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }],
        [{ id: 'wagon-gondola', load: 'load-coal' }, { id: 'wagon-gondola', load: 'load-coal' }, { id: 'wagon-gondola', load: 'load-coal' },
          { id: 'wagon-gondola', load: 'load-coal' }, { id: 'wagon-gondola', load: 'load-coal' }],
        [{ id: 'wagon-container-spine', load: 'load-container' }, { id: 'wagon-container-spine', load: 'load-container' },
          { id: 'wagon-container-spine', load: 'load-container' }],
        [{ id: 'diesel-yard-shunter' }, { id: 'wagon-tank' }, { id: 'wagon-brake-van' }],
        [{ id: 'coach-classic' }, { id: 'coach-classic' }],
      ].map((cars, k) => ({ cars, step: marks.roads[k].end, u: 116, speed: 0 })),
    ],
    noWires: steps.map((_, i) => i).filter((i) => !wired.has(i)),
  };
}

