const checkRules = (currentState, neighbors, birthRules, survivalRules) => {
  if (currentState === 1) {
    return survivalRules.includes(neighbors) ? 1 : 0;
  } else {
    return birthRules.includes(neighbors) ? 1 : 0;
  }
};

export const f_2dArray = {
  generateField: (width, height) => {
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => 0)
    );
  },

  updateFieldDimensions: (prevField, newHeight, newWidth) => {
    const updatedField = Array.from({ length: newHeight }, () =>
      Array.from({ length: newWidth }, () => 0)
    );

    for (let i = 0; i < Math.min(newHeight, prevField.length); i++) {
      for (let j = 0; j < Math.min(newWidth, prevField[i].length); j++) {
        updatedField[i][j] = prevField[i][j];
      }
    }

    return updatedField;
  },

  randomFill: (randomIndex, height, width, setField) => {
    const newField = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => (Math.random() < randomIndex ? 1 : 0))
    );
    setField(newField);
    return newField;
  },

  rebuildCanvas: (
    newField,
    width,
    height,
    canvasRef,
    cellSize,
    colorOfAliveCell,
    colorOfDeadCell,
    colorOfCellSeparator
  ) => {
    if (newField.length == 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = width * cellSize;
    canvas.height = height * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    newField.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        ctx.fillStyle = cell ? colorOfAliveCell : colorOfDeadCell;
        ctx.fillRect(
          colIndex * cellSize,
          rowIndex * cellSize,
          cellSize,
          cellSize
        );
        ctx.strokeStyle = colorOfCellSeparator;
        ctx.strokeRect(
          colIndex * cellSize,
          rowIndex * cellSize,
          cellSize,
          cellSize
        );
      });
    });
  },

  updateCanvas: (
    newField,
    changedCells,
    canvasRef,
    cellSize,
    colorOfAliveCell,
    colorOfDeadCell,
    colorOfCellSeparator
  ) => {
    if (changedCells.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    changedCells.forEach(([rowIndex, colIndex]) => {
      const cell = newField[rowIndex][colIndex];
      ctx.fillStyle = cell ? colorOfAliveCell : colorOfDeadCell;
      ctx.fillRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
      ctx.strokeStyle = colorOfCellSeparator;
      ctx.strokeRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
    });
  },

  handleCanvasClick: (e, canvasRef, cellSize, field, setField, width) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    const newField = [...field];
    newField[y][x] = newField[y][x] ? 0 : 1;
    setField(newField);
  },

  countNeighborsLimited: (field, x, y) => {
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    let count = 0;
    const height = field.length;
    const width = field[0].length;
    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;
      if (newX >= 0 && newX < height && newY >= 0 && newY < width) {
        count += field[newX][newY];
      }
    }
    return count;
  },

  countNeighborsClosed: (field, x, y) => {
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    let count = 0;
    const height = field.length;
    const width = field[0].length;
    for (const [dx, dy] of directions) {
      const newX = (x + dx + height) % height;
      const newY = (y + dy + width) % width;
      count += field[newX][newY];
    }
    return count;
  },

  makeAStep: (
    field,
    countNeighborsFunction,
    setField,
    setChangedCells,
    setNumberOfGenes,
    birthRules,
    survivalRules
  ) => {
    const height = field.length;
    const width = field[0].length;
    const newField = [];
    const changedCells = [];
    for (let i = 0; i < height; i++) {
      newField.push([]);
      for (let j = 0; j < width; j++) {
        const neighbors = countNeighborsFunction(field, i, j);
        const newState = checkRules(
          field[i][j],
          neighbors,
          birthRules,
          survivalRules
        );
        if (field[i][j] !== newState) {
          changedCells.push([i, j]);
        }
        newField[i][j] = newState;
      }
    }
    setField(newField);
    setChangedCells(changedCells);
    setNumberOfGenes((prev) => prev + 1);
    return newField;
  },

  countAliveCells: (field) => {
    return (
      field.reduce(
        (acc1, row) => acc1 + row.reduce((acc2, cell) => acc2 + cell, 0),
        0
      ) || 0
    );
  },
};

export const convertTo1DArray = (twoDArray) => {
  if (!isArray2D(twoDArray)) return twoDArray;
  const height = twoDArray.length;
  const width = twoDArray[0].length;
  const oneDArray = [];

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      oneDArray.push(twoDArray[i][j]);
    }
  }

  return oneDArray;
};

export const convertTo2DArray = (oneDArray, height, width) => {
  if (!isArray1D(oneDArray)) return oneDArray;
  const twoDArray = [];

  for (let i = 0; i < height; i++) {
    const row = [];
    for (let j = 0; j < width; j++) {
      const index = i * width + j;
      row.push(oneDArray[index]);
    }
    twoDArray.push(row);
  }

  return twoDArray;
};

const isArray2D = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) {
    return false;
  }

  if (Array.isArray(arr[0])) {
    // Проверяем, что все элементы массива также массивы (второй уровень)
    return arr.every((subArray) => Array.isArray(subArray));
  } else {
    // Если первый элемент не массив, то это одномерный массив
    return false;
  }
};

const isArray1D = (arr) => {
  return Array.isArray(arr) && !isArray2D(arr);
};

export const f_1dArray = {
  generateField: (width, height) => {
    return Array.from({ length: width * height }, () => 0);
  },

  updateFieldDimensions: (
    prevField,
    newHeight,
    newWidth,
    prevHeight,
    prevWidth
  ) => {
    const updatedField = Array.from({ length: newHeight * newWidth }, () => 0);

    const minHeight = Math.min(newHeight, prevHeight);
    const minWidth = Math.min(newWidth, prevWidth);

    for (let i = 0; i < minHeight; i++) {
      for (let j = 0; j < minWidth; j++) {
        const newIndex = i * newWidth + j;
        const oldIndex = i * prevWidth + j;
        updatedField[newIndex] = prevField[oldIndex];
      }
    }

    return updatedField;
  },

  randomFill: (randomIndex, height, width, setField) => {
    const newField = Array.from({ length: height * width }, () =>
      Math.random() < randomIndex ? 1 : 0
    );
    setField(newField);
    return newField;
  },

  rebuildCanvas: (
    newField,
    width,
    height,
    canvasRef,
    cellSize,
    colorOfAliveCell,
    colorOfDeadCell,
    colorOfCellSeparator
  ) => {
    if (newField.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = width * cellSize;
    canvas.height = height * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < newField.length; i++) {
      const rowIndex = Math.floor(i / width);
      const colIndex = i % width;

      ctx.fillStyle = newField[i] ? colorOfAliveCell : colorOfDeadCell;
      ctx.fillRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
      ctx.strokeStyle = colorOfCellSeparator;
      ctx.strokeRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
    }
  },

  updateCanvas: (
    newField,
    changedCells,
    canvasRef,
    cellSize,
    colorOfAliveCell,
    colorOfDeadCell,
    colorOfCellSeparator,
    width
  ) => {
    if (changedCells.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    changedCells.forEach((index) => {
      const cell = newField[index];
      const rowIndex = Math.floor(index / width);
      const colIndex = index % width;
      ctx.fillStyle = cell ? colorOfAliveCell : colorOfDeadCell;
      ctx.fillRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
      ctx.strokeStyle = colorOfCellSeparator;
      ctx.strokeRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
    });
  },

  handleCanvasClick: (e, canvasRef, cellSize, field, setField, width) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    const index = y * width + x;

    const newField = [...field];
    newField[index] = newField[index] ? 0 : 1;
    setField(newField);
  },

  countNeighborsLimited: (field, index, width) => {
    width = +width;
    let count = 0;
    const isTopEdge = index < width;
    const isBottomEdge = index >= field.length - width;
    const isLeftEdge = index % width === 0;
    const isRightEdge = index % width === width - 1;

    const topLeft = index - width - 1;
    const top = index - width;
    const topRight = index - width + 1;
    const left = index - 1;
    const right = index + 1;
    const bottomLeft = index + width - 1;
    const bottom = index + width;
    const bottomRight = index + width + 1;

    if (!isTopEdge) {
      count += field[top];
      if (!isLeftEdge) count += field[topLeft];
      if (!isRightEdge) count += field[topRight];
    }

    if (!isLeftEdge) count += field[left];
    if (!isRightEdge) count += field[right];

    if (!isBottomEdge) {
      count += field[bottom];
      if (!isLeftEdge) count += field[bottomLeft];
      if (!isRightEdge) count += field[bottomRight];
    }

    return count;
  },

  countNeighborsClosed: (field, index, width) => {
    width = +width;
    let count = 0;

    const top = (index - width + field.length) % field.length;
    const bottom = (index + width) % field.length;
    const left =
      ((index - 1 + width) % width) + width * Math.floor(index / width);
    const right = ((index + 1) % width) + width * Math.floor(index / width);

    const topLeft =
      ((top - 1 + width) % width) + width * Math.floor(top / width);
    const topRight = ((top + 1) % width) + width * Math.floor(top / width);
    const bottomLeft =
      ((bottom - 1 + width) % width) + width * Math.floor(bottom / width);
    const bottomRight =
      ((bottom + 1) % width) + width * Math.floor(bottom / width);

    const neighbors = [
      top,
      bottom,
      left,
      right,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    ];

    for (const neighbor of neighbors) {
      count += field[neighbor];
    }

    return count;
  },

  makeAStep: (
    field,
    countNeighborsFunction,
    setField,
    setChangedCells,
    setNumberOfGenes,
    birthRules,
    survivalRules,
    width
  ) => {
    const newField = [];
    const changedCells = [];

    for (let i = 0; i < field.length; i++) {
      const neighbors = countNeighborsFunction(field, i, width);
      const newState = checkRules(
        field[i],
        neighbors,
        birthRules,
        survivalRules
      );
      if (field[i] !== newState) {
        changedCells.push(i);
      }
      newField[i] = newState;
    }

    setField(newField);
    setChangedCells(changedCells);
    setNumberOfGenes((prev) => prev + 1);
    return newField;
  },

  countAliveCells: (field) => {
    return field.reduce((acc, cell) => acc + cell, 0) || 0;
  },
};
