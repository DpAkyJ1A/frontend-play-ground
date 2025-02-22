import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './index.module.css';
import { Header } from '@/layout';
import { IonIcon } from '@ionic/react';
import { play, pause, playSkipForward } from 'ionicons/icons';
import {
  f_2dArray,
  f_1dArray,
  convertTo2DArray,
  convertTo1DArray,
} from './functions';
import { colorPresetsList } from './colorsPresets';
import { rulesPresetsList } from './rulesPresets';
import { isNumber } from '@/utils/helpers';
import { Tooltip } from '@/components';

const PRESET_PREVIEW = [0, 1, 0, 0, 0, 1, 1, 1, 1];

export default function TheGameOfLifeUltimate() {
  const [dataStructure, setDataStructure] = useState('2d array');
  const prevDataStructure = useRef(dataStructure);
  const [dataStructureFunctionsObject, setDataStructureFunctionsObject] =
    useState(f_2dArray);
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(76);
  const [prevWidth, setPrevWidth] = useState(76);
  const [height, setHeight] = useState(33);
  const [prevHeight, setPrevHeight] = useState(33);
  const [cellSize, setCellSize] = useState(14);
  const [fieldType, setFieldType] = useState('limited');
  const [field, setField] = useState([]);
  const [changedCells, setChangedCells] = useState([]);
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
  const [countNeighborsFunction, setCountNeighborsFunction] = useState(
    () => f_2dArray.countNeighborsLimited
  );
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [survivalRules, setSurvivalRules] = useState([2, 3]);
  const [birthRules, setBirthRules] = useState([3]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    () => window.matchMedia('(min-width: 861px)').matches
  );

  const clearHandle = () => {
    dataStructureFunctionsObject.randomFill(0, height, width, setField);
    setNumberOfGenes(0);
    setGenesPerSecond(0);
    setChangedCells([]);
  };

  const randomClickHandle = () => {
    dataStructureFunctionsObject.randomFill(
      randomIndex,
      height,
      width,
      setField
    );
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

  const isRulesPresetActive = (preset) =>
    formatRules(preset.birth) === formatRules(birthRules) &&
    formatRules(preset.survive) === formatRules(survivalRules);

  const handleRulesChange = (e) => {
    const input = e.target.value;
    const numbers = input
      .trim()
      .split('')
      .map(Number)
      .filter((n) => !isNaN(n) && n >= 0 && n <= 8 && isNumber(n));
    return Array.from(new Set(numbers));
  };

  // init field
  useEffect(() => {
    setField(dataStructureFunctionsObject.generateField(width, height));
  }, []);

  // change dataStructureFunctionsObject
  useEffect(() => {
    if (prevDataStructure.current !== dataStructure) {
      if (dataStructure === '2d array') {
        setDataStructureFunctionsObject(f_2dArray);
        setField(convertTo2DArray(field, height, width));
      } else if (dataStructure === '1d array') {
        setDataStructureFunctionsObject(f_1dArray);
        setField(convertTo1DArray(field));
      }
      prevDataStructure.current = dataStructure;
    }
  }, [dataStructure]);

  // change function that count neighbors
  useEffect(() => {
    if (fieldType === 'limited') {
      setCountNeighborsFunction(
        () => dataStructureFunctionsObject.countNeighborsLimited
      );
    } else if (fieldType === 'closed') {
      setCountNeighborsFunction(
        () => dataStructureFunctionsObject.countNeighborsClosed
      );
    }
  }, [dataStructureFunctionsObject, fieldType]);

  // update field dimensions
  useEffect(() => {
    setField((prevField) =>
      dataStructureFunctionsObject.updateFieldDimensions(
        prevField,
        height,
        width,
        prevHeight,
        prevWidth
      )
    );

    setPrevHeight(height);
    setPrevWidth(width);
  }, [width, height]);

  // rebuild canvas
  useEffect(() => {
    if (!running) {
      dataStructureFunctionsObject.rebuildCanvas(
        field,
        width,
        height,
        canvasRef,
        cellSize,
        colorOfAliveCell,
        colorOfDeadCell,
        colorOfCellSeparator
      );
      setChangedCells([]);
    }
  }, [
    field,
    cellSize,
    colorOfAliveCell,
    colorOfDeadCell,
    colorOfCellSeparator,
  ]);

  // update changed cells
  useEffect(() => {
    if (running && changedCells.length > 0) {
      dataStructureFunctionsObject.updateCanvas(
        field,
        changedCells,
        canvasRef,
        cellSize,
        colorOfAliveCell,
        colorOfDeadCell,
        colorOfCellSeparator,
        width
      );
    }
  }, [
    running,
    changedCells,
    dataStructureFunctionsObject,
    cellSize,
    colorOfAliveCell,
    colorOfDeadCell,
    colorOfCellSeparator,
    field,
  ]);

  // startSimulation
  useEffect(() => {
    let intervalId;
    if (running) {
      let newField = field.slice();
      let counter = 0;
      let startTime = 0;
      const updateInterval = () => {
        clearInterval(intervalId);
        intervalId = setInterval(() => {
          if (counter === 0) {
            startTime = new Date();
          }
          newField = dataStructureFunctionsObject.makeAStep(
            newField,
            countNeighborsFunction,
            setField,
            setChangedCells,
            setNumberOfGenes,
            birthRules,
            survivalRules,
            width
          );
          if (counter === 10) {
            const endTime = new Date();
            const timeDiff = endTime - startTime;
            const timeDiffSec = timeDiff / 1000;
            const generationsPerSecond = 10 / timeDiffSec;
            setGenesPerSecond(generationsPerSecond.toFixed(2));
            counter = 0;
          } else {
            counter++;
          }
        }, 1000 / speed);
      };
      updateInterval();
    }
    return () => clearInterval(intervalId);
  }, [running, speed, countNeighborsFunction]);

  // update alive cells counter
  useEffect(() => {
    setCellsAlive(dataStructureFunctionsObject.countAliveCells(field));
  }, [dataStructureFunctionsObject, field]);

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
              onClick={() =>
                dataStructureFunctionsObject.makeAStep(
                  field,
                  countNeighborsFunction,
                  setField,
                  setChangedCells,
                  setNumberOfGenes,
                  birthRules,
                  survivalRules,
                  width
                )
              }
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
                max={1000}
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
              />
              <span className={styles.unit}>gen/s</span>
            </label>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => setSpeed(1000)}
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
              <dd>{genesPerSecond}</dd>
            </div>
            <div>
              <dt>Alive</dt>
              <dd>{cellsAlive}</dd>
            </div>
          </dl>
        </div>
      </Header>
      <main className={styles.main}>
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
                <h3 className={styles.paramTitle}>Field</h3>
                <div className={styles.sizeRow}>
                  <label className={styles.numberField}>
                    <span>Width</span>
                    <input
                      type="number"
                      min={1}
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
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
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </label>
                  <label className={`${styles.numberField} ${styles.cellField}`}>
                    <span>Cell, px</span>
                    <input
                      type="number"
                      min={2}
                      value={cellSize}
                      onChange={(e) => setCellSize(e.target.value)}
                    />
                  </label>
                </div>
              </section>
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
              <section className={styles.sidebarParam}>
                <h3 className={styles.paramTitle}>Colors</h3>
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
                      onChange={(e) => setColorOfCellSeparator(e.target.value)}
                    />
                  </label>
                </div>
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
                            className={alive ? styles.presetCellAlive : undefined}
                          />
                        ))}
                      </span>
                      <span className={styles.presetName}>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </section>
              <div className={styles.divider}>
                <span>Advanced</span>
              </div>
              <section className={styles.sidebarParam}>
                <h3 className={styles.paramTitle} id="edges-title">
                  Edges
                </h3>
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
              </section>
              <section className={styles.sidebarParam}>
                <h3 className={styles.paramTitle}>Rules</h3>
                <div className={styles.ruleInputs}>
                  <label className={styles.ruleField}>
                    <span className={styles.ruleLetter}>B</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Birth: neighbor counts that bring a dead cell to life"
                      value={birthRules.sort().join('')}
                      onChange={(e) => setBirthRules(handleRulesChange(e))}
                    />
                  </label>
                  <span className={styles.ruleSlash} aria-hidden="true">
                    /
                  </span>
                  <label className={styles.ruleField}>
                    <span className={styles.ruleLetter}>S</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Survive: neighbor counts that keep a live cell alive"
                      value={survivalRules.sort().join('')}
                      onChange={(e) => setSurvivalRules(handleRulesChange(e))}
                    />
                  </label>
                </div>
                <p className={styles.paramNote}>
                  Neighbor counts that bring a cell to life (B) and keep it
                  alive (S).
                </p>
                <div className={styles.ruleList}>
                  {rulesPresetsList.map((preset) => (
                    <button
                      className={`${styles.rulePreset} ${
                        isRulesPresetActive(preset) ? styles.isActive : ''
                      }`}
                      aria-pressed={isRulesPresetActive(preset)}
                      onClick={() => setRulesPreset(preset)}
                      key={preset.name}
                    >
                      <span>{preset.name}</span>
                      <span className={styles.ruleCode}>
                        B{formatRules(preset.birth)}/S
                        {formatRules(preset.survive)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className={styles.sidebarParam}>
                <h3 className={styles.paramTitle} id="structure-title">
                  Data structure
                </h3>
                <div
                  className={styles.segmented}
                  role="radiogroup"
                  aria-labelledby="structure-title"
                >
                  <label>
                    <input
                      type="radio"
                      name="dataStructure"
                      value="2d array"
                      checked={dataStructure === '2d array'}
                      onChange={(e) => setDataStructure(e.target.value)}
                    />
                    <span>2D array</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="dataStructure"
                      value="1d array"
                      checked={dataStructure === '1d array'}
                      onChange={(e) => setDataStructure(e.target.value)}
                    />
                    <span>1D array</span>
                  </label>
                </div>
              </section>
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
          <canvas
            className={`${styles.field} ${
              fieldType === 'limited'
                ? styles.field__limited
                : styles.field__closed
            }`}
            onClick={(e) =>
              dataStructureFunctionsObject.handleCanvasClick(
                e,
                canvasRef,
                cellSize,
                field,
                setField,
                width
              )
            }
            ref={canvasRef}
          ></canvas>
          <p className={styles.caption}>
            {fieldType === 'limited'
              ? 'Edges are walls.'
              : 'Edges wrap around to the opposite side.'}{' '}
            Click a cell to toggle it.
          </p>
        </div>
      </main>
    </div>
  );
}
