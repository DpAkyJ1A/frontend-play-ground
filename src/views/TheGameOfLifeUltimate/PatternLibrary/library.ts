import { parseRle, type Rule, type Shape, type Size } from './rle';

// A bundled pattern as written below; its shape and rule come from the RLE.
export type PatternEntry = {
  id: string;
  name: string;
  meta: string;
  rle: string;
};

export type PatternGroup = {
  id: string;
  title: string;
  note: string;
  patterns: PatternEntry[];
};

// Anything that can be placed on the field: a bundled pattern or one of yours.
export type Pattern = Shape & {
  id: string;
  name: string;
  meta: string;
  rule: Rule | null;
};

export type LibraryPattern = Pattern & PatternEntry;

export const patternGroups: PatternGroup[] = [
  {
    id: 'spaceships',
    title: 'Spaceships',
    note: 'Rebuild themselves one cell over, so they travel. c/4 means one cell every 4 generations.',
    patterns: [
      {
        id: 'glider',
        name: 'Glider',
        meta: 'c/4 diagonal',
        rle: `
x = 3, y = 3, rule = B3/S23
bo$2bo$3o!
`,
      },
      {
        id: 'lwss',
        name: 'Lightweight spaceship',
        meta: 'c/2',
        rle: `
x = 5, y = 4, rule = B3/S23
bo2bo$o$o3bo$4o!
`,
      },
      {
        id: 'mwss',
        name: 'Middleweight spaceship',
        meta: 'c/2',
        rle: `
x = 6, y = 5, rule = B3/S23
3bo$bo3bo$o$o4bo$5o!
`,
      },
      {
        id: 'hwss',
        name: 'Heavyweight spaceship',
        meta: 'c/2',
        rle: `
x = 7, y = 5, rule = B3/S23
3b2o$bo4bo$o$o5bo$6o!
`,
      },
      {
        id: 'turtle',
        name: 'Turtle',
        meta: 'c/3',
        rle: `
x = 12, y = 10, rule = B3/S23
b3o7bo$b2o2bob2ob2o$3b3o4bo$bo2bobo3bo$o4bo4bo$o4bo4bo$bo2bobo3bo$3b3o
4bo$b2o2bob2ob2o$b3o7bo!
`,
      },
      {
        id: 'dart',
        name: 'Dart',
        meta: 'c/3',
        rle: `
x = 15, y = 10, rule = B3/S23
7bo$6bobo$5bo3bo$6b3o2$4b2o3b2o$2bo3bobo3bo$b2o3bobo3b2o$o5bobo5bo$bob
2obobob2obo!
`,
      },
      {
        id: 'loafer',
        name: 'Loafer',
        meta: 'c/7',
        rle: `
x = 9, y = 9, rule = B3/S23
b2o2bob2o$o2bo2b2o$bobo$2bo$8bo$6b3o$5bo$6bo$7b2o!
`,
      },
      {
        id: 'weekender',
        name: 'Weekender',
        meta: '2c/7',
        rle: `
x = 16, y = 11, rule = B3/S23
bo12bo$bo12bo$obo10bobo$bo12bo$bo12bo$2bo3b4o3bo$6b4o$2b4o4b4o2$4bo6bo
$5b2o2b2o!
`,
      },
      {
        id: 'copperhead',
        name: 'Copperhead',
        meta: 'c/10',
        rle: `
x = 8, y = 12, rule = B3/S23
b2o2b2o$3b2o$3b2o$obo2bobo$o6bo2$o6bo$b2o2b2o$2b4o2$3b2o$3b2o!
`,
      },
    ],
  },
  {
    id: 'guns',
    title: 'Guns',
    note: 'Fire a glider or a spaceship every period, forever. Give them room.',
    patterns: [
      {
        id: 'gosperGun',
        name: 'Gosper glider gun',
        meta: 'period 30',
        rle: `
x = 36, y = 9, rule = B3/S23
24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4b
obo$10bo5bo7bo$11bo3bo$12b2o!
`,
      },
      {
        id: 'simkinGun',
        name: 'Simkin glider gun',
        meta: 'period 120',
        rle: `
x = 33, y = 21, rule = B3/S23
2o5b2o$2o5b2o2$4b2o$4b2o5$22b2ob2o$21bo5bo$21bo6bo2b2o$21b3o3bo3b2o$26
bo4$20b2o$20bo$21b3o$23bo!
`,
      },
      {
        id: 'p52Gun',
        name: 'Period-52 glider gun',
        meta: 'period 52',
        rle: `
x = 126, y = 97, rule = B3/S23
64bo$62b3o$61bo$61b2o2$57bo$56bobo$46b3o2bo3bo2bo$43bo2b2obobo4b2o$42b
obobo4bo$43bo3b3o31b2o$39bo6bo26bo7bo9bo$38bobo2bo2b2o13bo11b3o2b2obo7
b3o$37bo2b4o16b2o14bo3bo7bo$38b2o2b2o2bo13bobo12bo12b2o$40b2o8bo25b3o$
40bo8bo$41bo7b3o30bobo$38b3o36b2ob3ob3o$38bo38b2ob2obobo$82b3o$57b2o23
b3o$56bobo$50b2o4bo$48bo2bo2b2ob4o$48b2obobobobo2bo13bo$51bobobobo15b2
o$51bobob2o16bobo34b2o$37bo14bo57bo$36bo70b2obo$36b3o26b2o2b2o6b3o24bo
4bo$65bo2bo2bo4bo18b2o6bo4bo$56bo6bobo10bo2bo14b2o7bo3b3o$55b3o5b2o12b
2o17bo7bo4b2o$54b5o8bo2bo14b2o22bo$53b2o3b2o7bob2o9b2o4bo23b3o$54b5o9b
ob3o7bo5bobo15bo7bo$55b3o7b3o3bobo7b3o3bobo13bobo$56bo8bo7bo9bo5bo2b2o
9bo2bo$73b2o11bo2bo2b2o10b2o$53b2o31bo$24bo29bo32bo23b2o$9bo13bo27b3o3
0b3o9b3o9b2o2bo$9b3o11b3o25bo32bo13bo9bob2o$12bo27bobo23bo30bo12bo$11b
2o27b2o23b2o11b2o11b2o17bo$41bo23bobo10bo11bo2bo17b2o$80bo9b2ob2o13b3o
2bo$3b2o55b2o14b5o11bo14bo3bo2bo$3bo9b3o45bo13bo11b2o18bob2ob2o$2obo8b
o3bo40bo3bobo12b3o7bobo19bo3bo$o2b3o5bo5bo37b3o4b2o15bo6bo22bo2bo3bo$b
2o3bo4bo5bo28bob2o4bo21b4o5b2o16bo8b2obobo$3b4o4bo5bo28b2o2bobo2b5o11b
2o3bo3b2o7bo12b2o8bo3bo$3bo8bo3bo2b2o18b2o8b2ob3o5bo10b2o4b3o2bo6b3o10
bobo6b2o$4b3o6b3o3bobo18bo5b3o2bo3b2o2b2o18bob2o4b2o3bo18b3o3bo$7bo13b
o18bobo2bo3b2obobo8bo15bo6bo3b2obo19bobob2o$2b5o14b2o4bobo8b2obobo2b2o
bo3bo9b2o13b2o5bo2b2obobo21b2o$2bo24b2o8bobobob2obo2bo12bobo21b2obobob
2o20bobo$4bo23bo8bo3bo4bobo5bo32bo3bo4bo19b2o$3b2o29b2obo3bob4obob4o16
b2o15bo3bob4o20b2o$34bo2bob2obo4bob3o18bo14bobob2obo$35b2obobobob2obo2
3b3o11b2obob2o2b2obo19b2o$38bo5bob2o25bo14bo4b2ob2o$38bo49b2o25bo3bo$3
9bo24bo42bo6bo$24bo39b3o38b3o7bo3bo$25bo8b2o16bo14bo21bo14bo11bo$23b3o
3b2o2b3o2b2o11b3o12b2o11b2o5b5o13b2o11b2o$29bo2bobo4b2o9b2obo25bo11bo$
30bo3bob2obo10b2o37b2o31b2o$33bo3b2o30b2o17b2o32bobo$69b2o16bo17b2o17b
o$20bob2o44bo2bo32bo2bo16b2o$18b3obo42bo2bob2o32bo2bo$17bo4bobo27bobo9
bo2bo39bo$17b2o3b2obo27b2o10bobo33b2o3bo5b2o$25bo28bo46bo3bo6b2o$25b2o
14b2o48b2o9b3o$42bo49bo$39b3o47b3o8b2o$39bo42bo6bo11bo$63b2o18bo14b3o$
63bo4b2ob2o8b3o14bo$60b2obobo3b2obo$59bo2bob2obo4bobo$59b2obo3bob4obob
3o$62bo3bo4bobo2bob2o$62bobobob2obo2bobob2o$63b2obobo2b2obo3bo$65bobo2
bo3bobobo$65bo5b3o6b2o2b2o$64b2o8b2ob3o2bo2bo$71b2o2bobo2b5o$71bob2o4b
o15bo$80b3o13bo$82bo11b3o!
`,
      },
      {
        id: 'mwssGun',
        name: 'MWSS gun',
        meta: 'period 165',
        rle: `
x = 178, y = 218, rule = B3/S23
125b3o$125bobo$125b3o6bo$125b3o5b3o$125b3o$125b3o$125bobo5b3o$125b3o$1
33bobo$133bobo2$133b3o$111b2o6b2o$110bo2bo4bo2bo$110bo2bo4bo2bo11b3o$1
10bo2bo4bo2bo12bo$111b2o6b2o2$137bo2b2o4b2o2bo$136bo3b3o2b3o3bo$137bo2
b2o4b2o2bo7$139bo$139b3o4bobo2bobo$138bob4obo2bo2bo2bob2o$120bobo23bob
o2bobo$120b2o$121bo$139b3o$139b3o$44b3o93bo$45bo94bo$45bo94bo$44b3o92b
obo2$44b3o$44b3o92bobo$140bo$44b3o93bo$45bo94bo$45bo93b3o$44b3o92b3o2$
51b2o6b2o$49bo4bo2bo4bo$49bo4bo2bo4bo$49bo4bo2bo4bo4bo$51b2o6b2o5b3o8b
o$65bobobo6b3o$65bobobo5bobobo$66b3o6bobobo$67bo8b3o$77bo2$67bo$66b3o8
bo$17bo47bobobo6b3o$16b3o46bobobo5bobobo$15bobobo46b3o6bobobo$15bobobo
47bo8b3o$16b3o12bo45bo$17bo11b2o$30b2o2$17bo79b3o$16b3o80bo$15bobobo59
bo18bo$15bobobo59bobo$16b3o49bo10b2o$17bo49b2o$67bobo$78b3o$2bo2bo4bo2
bo64bo$3o2b6o2b3o63bo$2bo2bo4bo2bo2$81b2o$82b2o$81bo2$48bo$46b2o$47b2o
$58bobo2bobo$54b2obo2bo2bo2bob2o$58bobo2bobo2$22b3o52b3o2$21bo3bo50bo3
bo$21bo3bo50bo3bo2$22b3o52b3o$88b3o$88b3o$22b3o52b3o9bo$89bo$21bo3bo50
bo3bo8bo$21bo3bo17bobo30bo3bo7bobo$44b2o$22b3o19bo32b3o$88bobo$89bo$8b
o2bob2obo2bo69bo$8b4ob2ob4o69bo$8bo2bob2obo2bo68b3o$37b2o6b2o41b3o$35b
o4bo2bo4bo$35bo4bo2bo4bo$35bo4bo2bo4bo$37b2o6b2o2$51b3o66b2o$52bo66b2o
$52bo68bo$51b3o2$51b3o$38bobo10b3o$39b2o$39bo11b3o$52bo$52bo$51b3o26$1
59bo$159b3o4bobo2bobo$158bob4obo2bo2bo2bob2o$166bobo2bobo3$159b3o$159b
3o$160bo$160bo$81bo78bo$79bobo77bobo$80b2o2$159bobo$160bo$160bo$160bo$
159b3o$159b3o23$117b3o$119bo$118bo$100b2o6b2o$99bo2bo4bo2bo$99bo2bo4bo
2bo$99bo2bo4bo2bo$100b2o6b2o$114b3o2$113bo3bo$113bo3bo2$114b3o3$114b3o
2$113bo3bo$113bo3bo2$114b3o!
`,
      },
    ],
  },
  {
    id: 'growth',
    title: 'Infinite growth',
    note: 'Never settle down: they leave a trail behind or keep spreading out.',
    patterns: [
      {
        id: 'pufferTrain',
        name: 'Puffer train',
        meta: 'c/2 puffer',
        rle: `
x = 5, y = 18, rule = B3/S23
3bo$4bo$o3bo$b4o4$o$b2o$2bo$2bo$bo3$3bo$4bo$o3bo$b4o!
`,
      },
      {
        id: 'growth10',
        name: '10-cell infinite growth',
        meta: 'grows forever',
        rle: `
x = 8, y = 6, rule = B3/S23
6bo$4bob2o$4bobo$4bo$2bo$obo!
`,
      },
      {
        id: 'growth5x5',
        name: '5×5 infinite growth',
        meta: 'grows forever',
        rle: `
x = 5, y = 5, rule = B3/S23
3obo$o$3b2o$b2obo$obobo!
`,
      },
      {
        id: 'growthLine',
        name: 'One-cell-thick growth',
        meta: 'grows forever',
        rle: `
x = 39, y = 1, rule = B3/S23
8ob5o3b3o6b7ob5o!
`,
      },
      {
        id: 'quadratic20',
        name: '20-cell quadratic growth',
        meta: 'quadratic',
        rle: `
x = 97, y = 33, rule = B3/S23
94bo$92bobo$94b2o6$88b3o11$96bo$95b2o8$3bob2o$2bo3bo$bo$bo$obo!
`,
      },
    ],
  },
  {
    id: 'oscillators',
    title: 'Oscillators',
    note: 'Come back to the same shape after a fixed number of generations.',
    patterns: [
      {
        id: 'blinker',
        name: 'Blinker',
        meta: 'period 2',
        rle: `
x = 3, y = 1, rule = B3/S23
3o!
`,
      },
      {
        id: 'toad',
        name: 'Toad',
        meta: 'period 2',
        rle: `
x = 4, y = 2, rule = B3/S23
b3o$3o!
`,
      },
      {
        id: 'beacon',
        name: 'Beacon',
        meta: 'period 2',
        rle: `
x = 4, y = 4, rule = B3/S23
2o$2o$2b2o$2b2o!
`,
      },
      {
        id: 'clock',
        name: 'Clock',
        meta: 'period 2',
        rle: `
x = 4, y = 4, rule = B3/S23
2bo$obo$bobo$bo!
`,
      },
      {
        id: 'bipole',
        name: 'Bipole',
        meta: 'period 2',
        rle: `
x = 5, y = 5, rule = B3/S23
2o$o$bobo$4bo$3b2o!
`,
      },
      {
        id: 'sparkCoil',
        name: 'Spark coil',
        meta: 'period 2',
        rle: `
x = 8, y = 5, rule = B3/S23
2o4b2o$obo2bobo$2bo2bo$obo2bobo$2o4b2o!
`,
      },
      {
        id: 'pulsar',
        name: 'Pulsar',
        meta: 'period 3',
        rle: `
x = 13, y = 13, rule = B3/S23
2b3o3b3o2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2$2b3o3b3o$o4bobo4bo$o
4bobo4bo$o4bobo4bo2$2b3o3b3o!
`,
      },
      {
        id: 'cross',
        name: 'Cross',
        meta: 'period 3',
        rle: `
x = 8, y = 8, rule = B3/S23
2b4o$2bo2bo$3o2b3o$o6bo$o6bo$3o2b3o$2bo2bo$2b4o!
`,
      },
      {
        id: 'jam',
        name: 'Jam',
        meta: 'period 3',
        rle: `
x = 6, y = 7, rule = B3/S23
3b2o$2bo2bo$o2bobo$o3bo$o$3bo$b2o!
`,
      },
      {
        id: 'caterer',
        name: 'Caterer',
        meta: 'period 3',
        rle: `
x = 8, y = 6, rule = B3/S23
2bo$o3b4o$o3bo$o$3bo$b2o!
`,
      },
      {
        id: 'mold',
        name: 'Mold',
        meta: 'period 4',
        rle: `
x = 6, y = 6, rule = B3/S23
3b2o$2bo2bo$o2bobo$4bo$ob2o$bo!
`,
      },
      {
        id: 'octagon2',
        name: 'Octagon 2',
        meta: 'period 5',
        rle: `
x = 8, y = 8, rule = B3/S23
3b2o$2bo2bo$bo4bo$o6bo$o6bo$bo4bo$2bo2bo$3b2o!
`,
      },
      {
        id: 'unix',
        name: 'Unix',
        meta: 'period 6',
        rle: `
x = 8, y = 8, rule = B3/S23
b2o$b2o2$bo$obo$o2bo2b2o$4bob2o$2b2o!
`,
      },
      {
        id: 'figureEight',
        name: 'Figure eight',
        meta: 'period 8',
        rle: `
x = 6, y = 6, rule = B3/S23
3o$3o$3o$3b3o$3b3o$3b3o!
`,
      },
      {
        id: 'koksGalaxy',
        name: "Kok's galaxy",
        meta: 'period 8',
        rle: `
x = 9, y = 9, rule = B3/S23
6ob2o$6ob2o$7b2o$2o5b2o$2o5b2o$2o5b2o$2o$2ob6o$2ob6o!
`,
      },
      {
        id: 'tumbler',
        name: 'Tumbler',
        meta: 'period 14',
        rle: `
x = 9, y = 5, rule = B3/S23
bo5bo$obo3bobo$o2bobo2bo$2bo3bo$2b2ob2o!
`,
      },
      {
        id: 'pentadecathlon',
        name: 'Pentadecathlon',
        meta: 'period 15',
        rle: `
x = 10, y = 3, rule = B3/S23
2bo4bo$2ob4ob2o$2bo4bo!
`,
      },
      {
        id: 'queenBeeShuttle',
        name: 'Queen bee shuttle',
        meta: 'period 30',
        rle: `
x = 22, y = 7, rule = B3/S23
9bo$7bobo$6bobo$2o3bo2bo11b2o$2o4bobo11b2o$7bobo$9bo!
`,
      },
    ],
  },
  {
    id: 'methuselahs',
    title: 'Methuselahs',
    note: 'Tiny seeds that churn for hundreds or thousands of generations.',
    patterns: [
      {
        id: 'rPentomino',
        name: 'R-pentomino',
        meta: 'settles at 1103',
        rle: `
x = 3, y = 3, rule = B3/S23
b2o$2o$bo!
`,
      },
      {
        id: 'acorn',
        name: 'Acorn',
        meta: 'settles at 5206',
        rle: `
x = 7, y = 3, rule = B3/S23
bo$3bo$2o2b3o!
`,
      },
      {
        id: 'rabbits',
        name: 'Rabbits',
        meta: 'settles at 17331',
        rle: `
x = 7, y = 3, rule = B3/S23
o3b3o$3o2bo$bo!
`,
      },
      {
        id: 'thunderbird',
        name: 'Thunderbird',
        meta: 'settles at 243',
        rle: `
x = 3, y = 5, rule = B3/S23
3o2$bo$bo$bo!
`,
      },
      {
        id: 'piHeptomino',
        name: 'Pi-heptomino',
        meta: 'settles at 173',
        rle: `
x = 3, y = 3, rule = B3/S23
3o$obo$obo!
`,
      },
      {
        id: 'bHeptomino',
        name: 'B-heptomino',
        meta: 'settles at 148',
        rle: `
x = 4, y = 3, rule = B3/S23
ob2o$3o$bo!
`,
      },
      {
        id: 'herschel',
        name: 'Herschel',
        meta: 'settles at 128',
        rle: `
x = 3, y = 4, rule = B3/S23
o$3o$obo$2bo!
`,
      },
      {
        id: 'century',
        name: 'Century',
        meta: 'settles at 103',
        rle: `
x = 4, y = 3, rule = B3/S23
2b2o$3o$bo!
`,
      },
      {
        id: 'diehard',
        name: 'Diehard',
        meta: 'gone at 130',
        rle: `
x = 8, y = 3, rule = B3/S23
6bo$2o$bo3b3o!
`,
      },
    ],
  },
  {
    id: 'stillLifes',
    title: 'Still lifes',
    note: 'Never change unless something hits them.',
    patterns: [
      {
        id: 'block',
        name: 'Block',
        meta: 'still',
        rle: `
x = 2, y = 2, rule = B3/S23
2o$2o!
`,
      },
      {
        id: 'beehive',
        name: 'Beehive',
        meta: 'still',
        rle: `
x = 4, y = 3, rule = B3/S23
b2o$o2bo$b2o!
`,
      },
      {
        id: 'loaf',
        name: 'Loaf',
        meta: 'still',
        rle: `
x = 4, y = 4, rule = B3/S23
b2o$o2bo$bobo$2bo!
`,
      },
      {
        id: 'boat',
        name: 'Boat',
        meta: 'still',
        rle: `
x = 3, y = 3, rule = B3/S23
2o$obo$bo!
`,
      },
      {
        id: 'ship',
        name: 'Ship',
        meta: 'still',
        rle: `
x = 3, y = 3, rule = B3/S23
2o$obo$b2o!
`,
      },
      {
        id: 'tub',
        name: 'Tub',
        meta: 'still',
        rle: `
x = 3, y = 3, rule = B3/S23
bo$obo$bo!
`,
      },
      {
        id: 'pond',
        name: 'Pond',
        meta: 'still',
        rle: `
x = 4, y = 4, rule = B3/S23
b2o$o2bo$o2bo$b2o!
`,
      },
      {
        id: 'barge',
        name: 'Barge',
        meta: 'still',
        rle: `
x = 4, y = 4, rule = B3/S23
bo$obo$bobo$2bo!
`,
      },
      {
        id: 'longBoat',
        name: 'Long boat',
        meta: 'still',
        rle: `
x = 4, y = 4, rule = B3/S23
2o$obo$bobo$2bo!
`,
      },
      {
        id: 'snake',
        name: 'Snake',
        meta: 'still',
        rle: `
x = 4, y = 2, rule = B3/S23
2obo$ob2o!
`,
      },
      {
        id: 'aircraftCarrier',
        name: 'Aircraft carrier',
        meta: 'still',
        rle: `
x = 4, y = 3, rule = B3/S23
2o$o2bo$2b2o!
`,
      },
      {
        id: 'mango',
        name: 'Mango',
        meta: 'still',
        rle: `
x = 5, y = 4, rule = B3/S23
b2o$o2bo$bo2bo$2b2o!
`,
      },
      {
        id: 'integral',
        name: 'Integral sign',
        meta: 'still',
        rle: `
x = 5, y = 5, rule = B3/S23
3b2o$2bobo$2bo$obo$2o!
`,
      },
    ],
  },
  {
    id: 'eaters',
    title: 'Eaters',
    note: 'Still lifes that swallow a glider and repair themselves.',
    patterns: [
      {
        id: 'eater1',
        name: 'Eater 1',
        meta: 'still',
        rle: `
x = 4, y = 4, rule = B3/S23
2o$obo$2bo$2b2o!
`,
      },
      {
        id: 'eaterGlider',
        name: 'Eater meets glider',
        meta: 'demo',
        rle: `
x = 14, y = 14, rule = B3/S23
bo$2bo$3o8$10b2o$10bobo$12bo$12b2o!
`,
      },
      {
        id: 'gunEater',
        name: 'Gun and eater',
        meta: 'period 30',
        rle: `
x = 40, y = 26, rule = B3/S23
24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4b
obo$10bo5bo7bo$11bo3bo$12b2o14$36b2o$36bobo$38bo$38b2o!
`,
      },
    ],
  },
  {
    id: 'otherRules',
    title: 'Other rules',
    note: 'Built for a rule other than Life Classic.',
    patterns: [
      {
        id: 'replicator',
        name: 'Replicator',
        meta: 'copies itself',
        rle: `
x = 5, y = 5, rule = B36/S23
2b3o$bo2bo$o3bo$o2bo$3o!
`,
      },
    ],
  },
];

export const patternsById = new Map(
  patternGroups.flatMap((group) =>
    group.patterns.map((pattern): [string, LibraryPattern] => [
      pattern.id,
      { ...parseRle(pattern.rle), ...pattern },
    ])
  )
);

export const CLASSIC_RULE: Rule = { birth: [3], survival: [2, 3] };

export const fitsField = (
  { width, height }: Size,
  cols: number,
  rows: number
) => width <= cols && height <= rows;

export const fitsTurned = (
  { width, height }: Size,
  cols: number,
  rows: number
) =>
  fitsField({ width, height }, cols, rows) ||
  fitsField({ width: height, height: width }, cols, rows);
