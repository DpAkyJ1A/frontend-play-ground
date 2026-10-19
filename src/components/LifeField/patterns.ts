// live cells of a pattern, as [x, y] from its top-left corner
export type PatternCells = [x: number, y: number][];

const parse = (rows: string[]): PatternCells =>
  rows.flatMap((row, y) =>
    [...row].flatMap((char, x): PatternCells =>
      char === 'O' ? [[x, y]] : []
    )
  );

export const patterns = {
  gosperGun: parse([
    '........................O...........',
    '......................O.O...........',
    '............OO......OO............OO',
    '...........O...O....OO............OO',
    'OO........O.....O...OO..............',
    'OO........O...O.OO....O.O...........',
    '..........O.....O.......O...........',
    '...........O...O....................',
    '............OO......................',
  ]),
};

export type PatternName = keyof typeof patterns;
