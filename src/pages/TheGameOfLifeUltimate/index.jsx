import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './index.module.css';
import { Header } from '@/layout';
import { IonIcon } from '@ionic/react';
import { footstepsOutline, playOutline, pauseOutline } from 'ionicons/icons';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

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

  const handleRulesChange = (e) => {
    const input = e.target.value;
    const numbers = input
      .trim()
      .split(' ')
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
          <h2>The Game Of Life Ultimate!</h2>
          <button
            className={styles.controlButton}
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
            <IonIcon icon={footstepsOutline} />
          </button>
          <button
            className={styles.controlButton}
            onClick={() => setRunning((prev) => !prev)}
          >
            {!running ? (
              <IonIcon icon={playOutline} />
            ) : (
              <IonIcon icon={pauseOutline} />
            )}
          </button>
          <label>Speed (gen/sec):</label>
          <input
            className={styles.speedInput}
            type="number"
            min={0}
            max={1000}
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
          <button className={styles.btn} onClick={() => setSpeed(1000)}>
            MAX!
          </button>
          <label>Gen: {numberOfGenes}</label>
          <label>Gens per second: {genesPerSecond}</label>
          <label>Cells alive: {cellsAlive}</label>
        </div>
      </Header>
      <main className={styles.main}>
        <div className={styles.sidebarWrapper}>
          <aside
            className={`${styles.sidebar} ${
              isSettingsOpen && styles.sidebar__active
            }`}
          >
            <div className={styles.sidebarContent}>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Size</h3>
                </div>
                <div className={styles.row}>
                  <label>Field:</label>
                  <input
                    type="number"
                    min={1}
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                  x
                  <input
                    type="number"
                    min={1}
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                  <label>Cell:</label>
                  <input
                    type="number"
                    min={2}
                    value={cellSize}
                    onChange={(e) => setCellSize(e.target.value)}
                  />
                  px
                </div>
              </div>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Fill</h3>
                </div>
                <div className={styles.row}>
                  <label>Random index:</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={randomIndex}
                    onChange={(e) => setRandomIndex(e.target.value)}
                  />
                  <button className={styles.btn} onClick={randomClickHandle}>
                    Make it Random!
                  </button>
                  <button className={styles.btn} onClick={clearHandle}>
                    Clear
                  </button>
                </div>
              </div>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3 className={styles.colors}>Colors!</h3>
                </div>
                <div className={styles.row}>
                  <label>Alive:</label>
                  <input
                    type="color"
                    value={colorOfAliveCell}
                    onChange={(e) => setColorOfAliveCell(e.target.value)}
                  />
                  <label>Dead:</label>
                  <input
                    type="color"
                    value={colorOfDeadCell}
                    onChange={(e) => setColorOfDeadCell(e.target.value)}
                  />
                  <label>Separator:</label>
                  <input
                    type="color"
                    value={colorOfCellSeparator}
                    onChange={(e) => setColorOfCellSeparator(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Color presets:</h3>
                </div>
                <div className={`${styles.row} ${styles.flexWrap}`}>
                  {colorPresetsList.map((preset) => (
                    <button
                      className={`${styles.btn} ${styles.textOutline}`}
                      style={{
                        background: `linear-gradient(90deg, ${preset.alive} 40%, ${preset.separator} 60%, ${preset.dead} 100%)`,
                      }}
                      onClick={() => setColorPreset(preset)}
                      key={preset.name}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* <hr /> */}
              <h3>----- Advanced -----</h3>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Field Type</h3>
                </div>
                <div className={styles.row}>
                  <label>Limited:</label>
                  <input
                    type="radio"
                    value="limited"
                    checked={fieldType === 'limited'}
                    onChange={(e) => setFieldType(e.target.value)}
                  />
                  <label>Closed:</label>
                  <input
                    type="radio"
                    value="closed"
                    checked={fieldType === 'closed'}
                    onChange={(e) => setFieldType(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Rules</h3>
                </div>
                <div className={styles.row}>
                  <label>Survive:</label>
                  <input
                    type="text"
                    value={survivalRules.sort().join(' ') + ' '}
                    onChange={(e) => setSurvivalRules(handleRulesChange(e))}
                  />
                  <label>Birth:</label>
                  <input
                    type="text"
                    value={birthRules.sort().join(' ') + ' '}
                    onChange={(e) => setBirthRules(handleRulesChange(e))}
                  />
                </div>
              </div>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Rules presets:</h3>
                </div>
                <div className={`${styles.row} ${styles.flexWrap}`}>
                  {rulesPresetsList.map((preset) => (
                    <button
                      className={`${styles.btn} ${styles.textOutline}`}
                      onClick={() => setRulesPreset(preset)}
                      key={preset.name}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.sidebarParam}>
                <div className={styles.row}>
                  <h3>Data Structure</h3>
                </div>
                <div className={styles.row}>
                  <label>2d array:</label>
                  <input
                    type="radio"
                    value="2d array"
                    checked={dataStructure === '2d array'}
                    onChange={(e) => setDataStructure(e.target.value)}
                  />
                  <label>1d array:</label>
                  <input
                    type="radio"
                    value="1d array"
                    checked={dataStructure === '1d array'}
                    onChange={(e) => setDataStructure(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </aside>
          <div className={styles.sidebarToggleWrapper}>
            <Tooltip text={isSettingsOpen ? 'Close settings' : 'Open settings'}>
              <div
                className={`${styles.sidebarToggle} ${
                  !isSettingsOpen && styles.closed
                }`}
                onClick={() => setIsSettingsOpen((prev) => !prev)}
              >
                <div className={styles.toggleTop}></div>
                <div className={styles.toggleBottom}></div>
              </div>
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
        </div>
      </main>
    </div>
  );
}
