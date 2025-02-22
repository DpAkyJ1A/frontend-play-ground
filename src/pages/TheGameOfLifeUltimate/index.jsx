import { useState, useEffect, useRef } from 'react';
import styles from './index.module.css';
import { Header } from '@/layout';
import { IonIcon } from '@ionic/react';
import {
  play,
  pause,
  playSkipForward,
  informationCircleOutline,
  chevronDown,
} from 'ionicons/icons';
import { f_2dArray, f_1dArray, f_bitArray, convertField } from './functions';
import { colorPresetsList } from './colorsPresets';
import { rulesPresetsList } from './rulesPresets';
import BitArrayExplainer from './BitArrayExplainer';
import { Tooltip } from '@/components';

const ENGINES = {
  '2d array': f_2dArray,
  '1d array': f_1dArray,
  'bit array': f_bitArray,
};

const DATA_STRUCTURES = [
  {
    value: '2d array',
    label: '2D array',
    slowdown: { limited: '78×', closed: '80×' },
    range: { limited: '53–92×', closed: '61–97×' },
  },
  {
    value: '1d array',
    label: '1D array',
    slowdown: { limited: '27×', closed: '42×' },
    range: { limited: '15–32×', closed: '32–52×' },
  },
  { value: 'bit array', label: 'Bit array' },
];

const PRESET_PREVIEW = [0, 1, 0, 0, 0, 1, 1, 1, 1];
const NEIGHBOR_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const SIDEBAR_WIDTH = 320;
const MAX_FIELD_SIZE = 2000;
const MIN_CELL_SIZE = 1;
const MAX_CELL_SIZE = 40;
const MAX_SPEED = 100000;
const FRAME_BUDGET = 10;
const MIN_GRID_CELL_SIZE = 4;
const SECTIONS_KEY = 'game-of-life-sections';
const SECTION_DEFAULTS = {
  field: true,
  simulation: true,
  rules: false,
  look: false,
  colors: false,
  engine: false,
};

const readSections = () => {
  try {
    return {
      ...SECTION_DEFAULTS,
      ...JSON.parse(localStorage.getItem(SECTIONS_KEY)),
    };
  } catch {
    return SECTION_DEFAULTS;
  }
};

const storeSections = (sections) => {
  try {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
    return true;
  } catch {
    return false;
  }
};

const toPixelColor = (hex) => {
  const value = parseInt(hex.slice(1), 16);
  return (
    (0xff000000 |
      ((value & 0xff) << 16) |
      (value & 0xff00) |
      ((value >> 16) & 0xff)) >>>
    0
  );
};

const toFieldSize = (value, fallback) => {
  const size = Math.floor(Number(value));
  return size >= 1 ? Math.min(size, MAX_FIELD_SIZE) : fallback;
};

const toggleRule = (rules, n) =>
  rules.includes(n)
    ? rules.filter((rule) => rule !== n)
    : [...rules, n].sort((a, b) => a - b);

export default function TheGameOfLifeUltimate() {
  const [dataStructure, setDataStructure] = useState('bit array');
  const [width, setWidth] = useState(76);
  const [height, setHeight] = useState(33);
  const [cellSize, setCellSize] = useState(14);
  const [fitMode, setFitMode] = useState(null);
  const [fieldType, setFieldType] = useState('limited');
  const [colorOfAliveCell, setColorOfAliveCell] = useState(
    colorPresetsList[0].alive
  );
  const [colorOfDeadCell, setColorOfDeadCell] = useState(
    colorPresetsList[0].dead
  );
  const [colorOfCellSeparator, setColorOfCellSeparator] = useState(
    colorPresetsList[0].separator
  );
  const [randomIndex, setRandomIndex] = useState(0.3);
  const [numberOfGenes, setNumberOfGenes] = useState(0);
  const [genesPerSecond, setGenesPerSecond] = useState(0);
  const [cellsAlive, setCellsAlive] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [survivalRules, setSurvivalRules] = useState([2, 3]);
  const [birthRules, setBirthRules] = useState([3]);
  const [viewportSize, setViewportSize] = useState(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [openSections, setOpenSections] = useState(readSections);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    () => window.matchMedia('(min-width: 861px)').matches
  );

  const canvasRef = useRef(null);
  const mainRef = useRef(null);
  const viewportRef = useRef(null);
  const explainerButtonRef = useRef(null);
  const fieldRef = useRef(null);
  const dimensionsRef = useRef(null);
  const engineRef = useRef(ENGINES[dataStructure]);
  const imageRef = useRef(null);
  const generationRef = useRef(0);
  const aliveRef = useRef(0);
  const drawingRef = useRef(null);
  const lastSizeRef = useRef({ cols: 76, rows: 33 });

  const cols = toFieldSize(width, lastSizeRef.current.cols);
  const rows = toFieldSize(height, lastSizeRef.current.rows);
  lastSizeRef.current = { cols, rows };

  const fillsWidth =
    viewportSize && Math.floor(viewportSize.width / cellSize) === cols;
  const fillsHeight =
    viewportSize && Math.floor(viewportSize.height / cellSize) === rows;
  const stageWidth = fillsWidth ? viewportSize.width : cols * cellSize;
  const stageHeight = fillsHeight ? viewportSize.height : rows * cellSize;

  const settingsRef = useRef({});
  settingsRef.current = {
    cols,
    rows,
    speed: Math.min(Math.max(Number(speed) || 0, 0), MAX_SPEED),
    wrap: fieldType === 'closed',
    birthRules,
    survivalRules,
    aliveColor: toPixelColor(colorOfAliveCell),
    deadColor: toPixelColor(colorOfDeadCell),
  };

  const paint = () => {
    const image = imageRef.current;
    if (!image || !fieldRef.current) return;
    const { aliveColor, deadColor } = settingsRef.current;
    engineRef.current.paint(
      fieldRef.current,
      image.pixels,
      aliveColor,
      deadColor
    );
    canvasRef.current.getContext('2d').putImageData(image.data, 0, 0);
  };

  const syncStats = () => {
    setNumberOfGenes(generationRef.current);
    setCellsAlive(aliveRef.current);
  };

  const stepOnce = () => {
    const { cols, rows, wrap, birthRules, survivalRules } = settingsRef.current;
    const result = engineRef.current.makeAStep(fieldRef.current, {
      width: cols,
      height: rows,
      wrap,
      birthRules,
      survivalRules,
    });
    fieldRef.current = result.field;
    aliveRef.current = result.alive;
    generationRef.current += 1;
  };

  const replaceField = (field) => {
    fieldRef.current = field;
    aliveRef.current = engineRef.current.countAliveCells(field);
    paint();
    syncStats();
  };

  const clearHandle = () => {
    generationRef.current = 0;
    setGenesPerSecond(0);
    replaceField(engineRef.current.generateField(cols, rows));
  };

  const randomClickHandle = () => {
    replaceField(engineRef.current.randomFill(randomIndex, rows, cols));
  };

  const stepHandle = () => {
    stepOnce();
    paint();
    syncStats();
  };

  const fitField = (mode, size) => {
    const main = mainRef.current.getBoundingClientRect();
    const viewport = getComputedStyle(viewportRef.current);
    const panel =
      mode === 'panel' ? Math.min(SIDEBAR_WIDTH, window.innerWidth - 48) : 0;
    const availableWidth =
      main.width -
      panel -
      parseFloat(viewport.paddingLeft) -
      parseFloat(viewport.paddingRight);
    const availableHeight =
      main.height -
      parseFloat(viewport.paddingTop) -
      parseFloat(viewport.paddingBottom);
    setWidth(toFieldSize(Math.floor(availableWidth / size), 1));
    setHeight(toFieldSize(Math.floor(availableHeight / size), 1));
    setFitMode(mode);
  };

  const changeCellSize = (size) => {
    setCellSize(size);
    if (fitMode) fitField(fitMode, size);
  };

  const setColorPreset = (preset) => {
    setColorOfAliveCell(preset.alive);
    setColorOfDeadCell(preset.dead);
    setColorOfCellSeparator(preset.separator);
  };

  const setRulesPreset = (preset) => {
    setSurvivalRules(preset.survive);
    setBirthRules(preset.birth);
  };

  const isColorPresetActive = (preset) =>
    preset.alive.toLowerCase() === colorOfAliveCell.toLowerCase() &&
    preset.dead.toLowerCase() === colorOfDeadCell.toLowerCase() &&
    preset.separator.toLowerCase() === colorOfCellSeparator.toLowerCase();

  const formatRules = (rules) => [...rules].sort().join('');

  const activeRulesPreset = rulesPresetsList.find(
    (preset) =>
      formatRules(preset.birth) === formatRules(birthRules) &&
      formatRules(preset.survive) === formatRules(survivalRules)
  );

  const toggleSection = (name) => (e) => {
    const open = e.currentTarget.open;
    setOpenSections((prev) => {
      if (prev[name] === open) return prev;
      const next = { ...prev, [name]: open };
      storeSections(next);
      return next;
    });
  };

  const cellFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { cols, rows } = settingsRef.current;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * cols);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * rows);
    return [
      Math.min(Math.max(x, 0), cols - 1),
      Math.min(Math.max(y, 0), rows - 1),
    ];
  };

  const setCell = (x, y, value) => {
    const engine = engineRef.current;
    const { cols } = settingsRef.current;
    if (engine.get(fieldRef.current, x, y, cols) === value) return;
    engine.set(fieldRef.current, x, y, value, cols);
    aliveRef.current += value ? 1 : -1;
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    const [x, y] = cellFromEvent(e);
    const value = engineRef.current.get(
      fieldRef.current,
      x,
      y,
      settingsRef.current.cols
    )
      ? 0
      : 1;
    drawingRef.current = { value, x, y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setCell(x, y, value);
    paint();
    setCellsAlive(aliveRef.current);
  };

  const handlePointerMove = (e) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const [x, y] = cellFromEvent(e);
    if (x === drawing.x && y === drawing.y) return;

    let currentX = drawing.x;
    let currentY = drawing.y;
    const dx = Math.abs(x - currentX);
    const dy = -Math.abs(y - currentY);
    const stepX = currentX < x ? 1 : -1;
    const stepY = currentY < y ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      setCell(currentX, currentY, drawing.value);
      if (currentX === x && currentY === y) break;
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        currentX += stepX;
      }
      if (doubled <= dx) {
        error += dx;
        currentY += stepY;
      }
    }

    drawing.x = x;
    drawing.y = y;
    paint();
    setCellsAlive(aliveRef.current);
  };

  const handlePointerUp = () => {
    drawingRef.current = null;
  };

  useEffect(() => {
    const engine = engineRef.current;
    const previous = dimensionsRef.current;
    fieldRef.current = previous
      ? engine.updateFieldDimensions(
          fieldRef.current,
          rows,
          cols,
          previous.rows,
          previous.cols
        )
      : engine.generateField(cols, rows);
    dimensionsRef.current = { cols, rows };

    const canvas = canvasRef.current;
    canvas.width = cols;
    canvas.height = rows;
    const data = canvas.getContext('2d').createImageData(cols, rows);
    imageRef.current = { data, pixels: new Uint32Array(data.data.buffer) };

    aliveRef.current = engine.countAliveCells(fieldRef.current);
    paint();
    syncStats();
  }, [cols, rows]);

  useEffect(() => {
    const engine = ENGINES[dataStructure];
    if (engine === engineRef.current) return;
    const { cols, rows } = settingsRef.current;
    fieldRef.current = convertField(
      engineRef.current,
      engine,
      fieldRef.current,
      cols,
      rows
    );
    engineRef.current = engine;
    paint();
  }, [dataStructure]);

  useEffect(() => {
    paint();
  }, [colorOfAliveCell, colorOfDeadCell]);

  useEffect(() => {
    fitField(isSettingsOpen ? 'panel' : 'screen', cellSize);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewportSize({ width, height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    let frameId;
    let last = performance.now();
    let pending = 0;
    let windowStart = last;
    let windowSteps = 0;
    let statsSyncedAt = last;

    const tick = (now) => {
      frameId = requestAnimationFrame(tick);
      pending += ((now - last) / 1000) * settingsRef.current.speed;
      last = now;

      const deadline = performance.now() + FRAME_BUDGET;
      let steps = 0;
      while (pending >= 1 && performance.now() < deadline) {
        stepOnce();
        pending -= 1;
        steps += 1;
      }
      if (pending >= 1) pending = 0;

      if (steps) {
        paint();
        windowSteps += steps;
      }
      if (now - windowStart >= 500) {
        setGenesPerSecond((windowSteps * 1000) / (now - windowStart));
        windowStart = now;
        windowSteps = 0;
      }
      if (now - statsSyncedAt >= 100) {
        syncStats();
        statsSyncedAt = now;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      syncStats();
    };
  }, [running]);

  return (
    <div className={styles.theGameOfLifePage}>
      <Header>
        <div className={styles.headerControls}>
          <h2 className={styles.pageTitle}>The Game of Life Ultimate</h2>
          <div className={styles.transport}>
            <button
              className={styles.controlButton}
              aria-label="Step one generation"
              title="Step one generation"
              onClick={stepHandle}
            >
              <IonIcon icon={playSkipForward} />
            </button>
            <button
              className={`${styles.controlButton} ${styles.playButton} ${
                running ? styles.playButton__running : ''
              }`}
              aria-label={running ? 'Pause' : 'Play'}
              title={running ? 'Pause' : 'Play'}
              onClick={() => setRunning((prev) => !prev)}
            >
              {!running ? <IonIcon icon={play} /> : <IonIcon icon={pause} />}
            </button>
            <label className={styles.speed}>
              <span className={styles.speedLabel}>Speed</span>
              <input
                className={styles.speedInput}
                type="number"
                min={0}
                max={MAX_SPEED}
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
              />
              <span className={styles.unit}>gen/s</span>
            </label>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => setSpeed(MAX_SPEED)}
            >
              Max
            </button>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>Generation</dt>
              <dd>{numberOfGenes}</dd>
            </div>
            <div>
              <dt>Gen/s</dt>
              <dd>
                {genesPerSecond >= 100
                  ? Math.round(genesPerSecond)
                  : genesPerSecond.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt>Alive</dt>
              <dd>{cellsAlive}</dd>
            </div>
          </dl>
        </div>
      </Header>
      <main className={styles.main} ref={mainRef}>
        <div className={styles.sidebarWrapper}>
          <aside
            className={`${styles.sidebar} ${
              isSettingsOpen && styles.sidebar__active
            }`}
            aria-label="Settings"
            inert={isSettingsOpen ? undefined : ''}
          >
            <div className={styles.sidebarContent}>
              <section className={styles.sidebarParam}>
                <h3 className={styles.paramTitle}>Fill</h3>
                <label className={styles.rangeField}>
                  <span className={styles.rangeHead}>
                    <span>Density</span>
                    <output>{Math.round(randomIndex * 100)}%</output>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    style={{ '--fill': `${randomIndex * 100}%` }}
                    value={randomIndex}
                    onChange={(e) => setRandomIndex(e.target.value)}
                  />
                </label>
                <div className={styles.buttonRow}>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={randomClickHandle}
                  >
                    Randomize
                  </button>
                  <button className={styles.btn} onClick={clearHandle}>
                    Clear
                  </button>
                </div>
              </section>
              <details
                className={styles.panel}
                open={openSections.field}
                onToggle={toggleSection('field')}
              >
                <summary className={styles.panelHead}>Field</summary>
                <div className={styles.panelBody}>
                  <div className={styles.sizeRow}>
                    <label className={styles.numberField}>
                      <span>Width</span>
                      <input
                        type="number"
                        min={1}
                        max={MAX_FIELD_SIZE}
                        value={width}
                        onChange={(e) => {
                          setWidth(e.target.value);
                          setFitMode(null);
                        }}
                      />
                    </label>
                    <span className={styles.times} aria-hidden="true">
                      ×
                    </span>
                    <label className={styles.numberField}>
                      <span>Height</span>
                      <input
                        type="number"
                        min={1}
                        max={MAX_FIELD_SIZE}
                        value={height}
                        onChange={(e) => {
                          setHeight(e.target.value);
                          setFitMode(null);
                        }}
                      />
                    </label>
                  </div>
                  <label className={styles.rangeField}>
                    <span className={styles.rangeHead}>
                      <span>Cell size</span>
                      <output>{cellSize} px</output>
                    </span>
                    <input
                      type="range"
                      min={MIN_CELL_SIZE}
                      max={MAX_CELL_SIZE}
                      step={1}
                      style={{
                        '--fill': `${
                          ((cellSize - MIN_CELL_SIZE) /
                            (MAX_CELL_SIZE - MIN_CELL_SIZE)) *
                          100
                        }%`,
                      }}
                      value={cellSize}
                      onChange={(e) => changeCellSize(Number(e.target.value))}
                    />
                  </label>
                  <div className={styles.fieldGroup}>
                    <span id="fit-title">Fit to free space</span>
                    <div
                      className={styles.segmented}
                      role="group"
                      aria-labelledby="fit-title"
                    >
                      <button
                        className={fitMode === 'screen' ? styles.isActive : ''}
                        aria-pressed={fitMode === 'screen'}
                        onClick={() => fitField('screen', cellSize)}
                      >
                        Panel closed
                      </button>
                      <button
                        className={fitMode === 'panel' ? styles.isActive : ''}
                        aria-pressed={fitMode === 'panel'}
                        onClick={() => fitField('panel', cellSize)}
                      >
                        Panel open
                      </button>
                    </div>
                    <p className={styles.paramNote}>
                      While a fit is on, cell size changes how many cells fit.
                    </p>
                  </div>
                </div>
              </details>
              <details
                className={styles.panel}
                open={openSections.simulation}
                onToggle={toggleSection('simulation')}
              >
                <summary className={styles.panelHead}>Simulation</summary>
                <div className={styles.panelBody}>
                  <div className={styles.fieldGroup}>
                    <span id="edges-title">Edges</span>
                    <div
                      className={styles.segmented}
                      role="radiogroup"
                      aria-labelledby="edges-title"
                    >
                      <label>
                        <input
                          type="radio"
                          name="fieldType"
                          value="limited"
                          checked={fieldType === 'limited'}
                          onChange={(e) => setFieldType(e.target.value)}
                        />
                        <span>Walls</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="fieldType"
                          value="closed"
                          checked={fieldType === 'closed'}
                          onChange={(e) => setFieldType(e.target.value)}
                        />
                        <span>Wrap around</span>
                      </label>
                    </div>
                  </div>
                  <label className={styles.fieldGroup}>
                    <span className={styles.rangeHead}>
                      <span>Rule</span>
                      <span className={styles.ruleCode}>
                        B{formatRules(birthRules)}/S{formatRules(survivalRules)}
                      </span>
                    </span>
                    <span className={styles.select}>
                      <select
                        value={activeRulesPreset?.name ?? 'custom'}
                        onChange={(e) =>
                          setRulesPreset(
                            rulesPresetsList.find(
                              (preset) => preset.name === e.target.value
                            )
                          )
                        }
                      >
                        {rulesPresetsList.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.name}
                          </option>
                        ))}
                        {!activeRulesPreset && (
                          <option value="custom" disabled>
                            Custom
                          </option>
                        )}
                      </select>
                      <IonIcon icon={chevronDown} aria-hidden="true" />
                    </span>
                  </label>
                  <details
                    className={styles.subPanel}
                    open={openSections.rules}
                    onToggle={toggleSection('rules')}
                  >
                    <summary className={styles.subPanelHead}>Edit rule</summary>
                    <div className={styles.subPanelBody}>
                      {[
                        ['Birth', 'B', birthRules, setBirthRules],
                        ['Survive', 'S', survivalRules, setSurvivalRules],
                      ].map(([label, letter, rules, setRules]) => (
                        <div
                          className={styles.ruleRow}
                          role="group"
                          aria-label={label}
                          key={letter}
                        >
                          <span className={styles.ruleLetter} aria-hidden="true">
                            {letter}
                          </span>
                          {NEIGHBOR_COUNTS.map((n) => (
                            <label className={styles.ruleCell} key={n}>
                              <input
                                type="checkbox"
                                checked={rules.includes(n)}
                                aria-label={`${label} with ${n} neighbors`}
                                onChange={() => setRules(toggleRule(rules, n))}
                              />
                              <span>{n}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                      <p className={styles.paramNote}>
                        Neighbor counts that bring a dead cell to life (B) and
                        keep a live cell alive (S).
                      </p>
                    </div>
                  </details>
                </div>
              </details>
              <details
                className={styles.panel}
                open={openSections.look}
                onToggle={toggleSection('look')}
              >
                <summary className={styles.panelHead}>Look</summary>
                <div className={styles.panelBody}>
                  <div className={styles.presetGrid}>
                    {colorPresetsList.map((preset) => (
                      <button
                        className={`${styles.colorPreset} ${
                          isColorPresetActive(preset) ? styles.isActive : ''
                        }`}
                        aria-pressed={isColorPresetActive(preset)}
                        onClick={() => setColorPreset(preset)}
                        key={preset.name}
                      >
                        <span
                          className={styles.presetCells}
                          style={{
                            '--alive': preset.alive,
                            '--dead': preset.dead,
                            '--grid': preset.separator,
                          }}
                          aria-hidden="true"
                        >
                          {PRESET_PREVIEW.map((alive, i) => (
                            <span
                              key={i}
                              className={
                                alive ? styles.presetCellAlive : undefined
                              }
                            />
                          ))}
                        </span>
                        <span className={styles.presetName}>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.switchField}>
                      <span>Grid lines</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                      />
                    </label>
                    {showGrid && cellSize < MIN_GRID_CELL_SIZE && (
                      <p className={styles.paramNote}>
                        Hidden while cells are smaller than {MIN_GRID_CELL_SIZE}{' '}
                        px.
                      </p>
                    )}
                  </div>
                  <details
                    className={styles.subPanel}
                    open={openSections.colors}
                    onToggle={toggleSection('colors')}
                  >
                    <summary className={styles.subPanelHead}>
                      Custom colors
                    </summary>
                    <div className={styles.subPanelBody}>
                      <div className={styles.colorRow}>
                        <label className={styles.colorField}>
                          <span>Alive</span>
                          <input
                            type="color"
                            value={colorOfAliveCell}
                            onChange={(e) => setColorOfAliveCell(e.target.value)}
                          />
                        </label>
                        <label className={styles.colorField}>
                          <span>Dead</span>
                          <input
                            type="color"
                            value={colorOfDeadCell}
                            onChange={(e) => setColorOfDeadCell(e.target.value)}
                          />
                        </label>
                        <label className={styles.colorField}>
                          <span>Grid</span>
                          <input
                            type="color"
                            value={colorOfCellSeparator}
                            onChange={(e) =>
                              setColorOfCellSeparator(e.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </details>
                </div>
              </details>
              <details
                className={styles.panel}
                open={openSections.engine}
                onToggle={toggleSection('engine')}
              >
                <summary className={styles.panelHead}>Engine</summary>
                <div className={styles.panelBody}>
                  <div className={styles.fieldGroup}>
                    <span id="structure-title">Data structure</span>
                    <div
                      className={`${styles.segmented} ${styles.segmentedTall}`}
                      role="radiogroup"
                      aria-labelledby="structure-title"
                    >
                      {DATA_STRUCTURES.map(({ value, label, slowdown, range }) => (
                        <label
                          key={value}
                          title={
                            range
                              ? `${range[fieldType]} slower than the bit array on fields from 76×33 to 800×600`
                              : undefined
                          }
                        >
                          <input
                            type="radio"
                            name="dataStructure"
                            value={value}
                            checked={dataStructure === value}
                            onChange={(e) => setDataStructure(e.target.value)}
                          />
                          <span>
                            {label}
                            <small className={styles.speedTag}>
                              {slowdown
                                ? `${slowdown[fieldType]} slower`
                                : 'fastest'}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className={styles.paramNote}>
                      Bit array packs 32 cells into one number and updates them
                      all at once with bitwise math. Tags compare step time with
                      it for the current edge mode.
                    </p>
                  </div>
                  <button
                    ref={explainerButtonRef}
                    className={styles.explainerLink}
                    onClick={() => setIsExplainerOpen(true)}
                  >
                    <IonIcon icon={informationCircleOutline} aria-hidden="true" />
                    How the bit array works
                  </button>
                </div>
              </details>
            </div>
          </aside>
          <div className={styles.sidebarToggleWrapper}>
            <Tooltip text={isSettingsOpen ? 'Close settings' : 'Open settings'}>
              <button
                className={`${styles.sidebarToggle} ${
                  !isSettingsOpen && styles.closed
                }`}
                aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
                aria-expanded={isSettingsOpen}
                onClick={() => setIsSettingsOpen((prev) => !prev)}
              >
                <span className={styles.toggleTop}></span>
                <span className={styles.toggleBottom}></span>
              </button>
            </Tooltip>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.viewport} ref={viewportRef}>
            <div
              className={`${styles.stage} ${
                fieldType === 'limited'
                  ? styles.field__limited
                  : styles.field__closed
              }`}
              style={{
                width: stageWidth,
                height: stageHeight,
                '--cell-width': `${stageWidth / cols}px`,
                '--cell-height': `${stageHeight / rows}px`,
                '--grid-color': colorOfCellSeparator,
              }}
            >
              <canvas
                className={styles.field}
                ref={canvasRef}
                role="img"
                aria-label="Game field. Click or drag to draw cells."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              ></canvas>
              {showGrid && cellSize >= MIN_GRID_CELL_SIZE && (
                <div className={styles.grid} />
              )}
            </div>
          </div>
        </div>
      </main>
      <BitArrayExplainer
        open={isExplainerOpen}
        onClose={() => {
          setIsExplainerOpen(false);
          explainerButtonRef.current?.focus();
        }}
        cols={cols}
        rows={rows}
        fieldType={fieldType}
        birthRules={birthRules}
        survivalRules={survivalRules}
      />
    </div>
  );
}
