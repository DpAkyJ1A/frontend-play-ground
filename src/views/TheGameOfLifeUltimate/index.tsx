'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './index.module.css';
import { Header } from '@/layout';
import Icon from '@/components/Icon';
import {
  ChevronDownIcon,
  ExpandIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  ScanIcon,
  ShrinkIcon,
  SkipForwardIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  f_2dArray,
  f_1dArray,
  f_bitArray,
  convertField,
  type Engine,
  type Field,
  type FieldType,
} from './functions';
import { colorPresetsList, type ColorPreset } from './colorsPresets';
import { rulesPresetsList, type RulePreset } from './rulesPresets';
import BitArrayExplainer from './BitArrayExplainer';
import AboutDialog from './AboutDialog';
import { getTourSteps } from './tourSteps';
import SharePanel from './SharePanel';
import ImageDialog from './ImageDialog';
import { fadePalette, layerSize, paintFaded, recordLayer } from './fade';
import {
  HASH_KEY,
  LINK_LIMIT,
  createPayload,
  decodeLinkData,
  encodeBoardRle,
  encodeLinkData,
  readBoardRle,
  readHashData,
  readPayload,
  type SharedBoard,
  type ShareSettings,
} from './share';
import PerformanceHud from './PerformanceHud';
import PatternLibrary from './PatternLibrary';
import PlacementBar from './PatternLibrary/PlacementBar';
import PatternShape from './PatternLibrary/PatternShape';
import useCustomPatterns from './PatternLibrary/useCustomPatterns';
import {
  fitsField,
  fitsTurned,
  patternsById,
  type Pattern,
} from './PatternLibrary/library';
import {
  transformShape,
  type Cell,
  type Rule,
  type Shape,
  type Size,
} from './PatternLibrary/rle';
import { recordFrame, type createPerfSample } from './PerformanceHud/meter';
import { Tooltip } from '@/components';
import Tour, { TourInvite, useTourSeen } from '@/components/Tour';

type DataStructure = '2d array' | '1d array' | 'bit array';
type FitMode = 'screen' | 'panel';
type SidebarTab = 'settings' | 'patterns' | 'share';
type ViewportSize = { width: number; height: number };
type Placing = { id: string; rotation: number; flipped: boolean };
type Board = { cols: number; rows: number; cells: Cell[] };
type Drawing = { value: number; x: number; y: number };
type FadeHistory = { layers: Uint32Array[]; scratch: Uint32Array | null };
type PixelImage = { data: ImageData; pixels: Uint32Array };
type PerfSample = ReturnType<typeof createPerfSample>;
type Point = { clientX: number; clientY: number };

// Older Safari only has the prefixed fullscreen API.
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const ENGINES: Record<DataStructure, Engine> = {
  '2d array': f_2dArray,
  '1d array': f_1dArray,
  'bit array': f_bitArray,
};

const DATA_STRUCTURES: {
  value: DataStructure;
  label: string;
  slowdown?: Record<FieldType, string>;
  range?: Record<FieldType, string>;
}[] = [
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
const COMPACT_QUERY = '(max-width: 640px)';
const MAX_FIELD_SIZE = 4000;
const MIN_CELL_SIZE = 1;
const MAX_CELL_SIZE = 40;
const MAX_SPEED = 100000;
const MAX_FADE = 8;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const NOTICE_MS = 5000;
const SHARE_LIMITS = {
  maxSize: MAX_FIELD_SIZE,
  minCellSize: MIN_CELL_SIZE,
  maxCellSize: MAX_CELL_SIZE,
  maxSpeed: MAX_SPEED,
  maxFade: MAX_FADE,
};
const FRAME_BUDGET = 10;
const MIN_GRID_CELL_SIZE = 4;
const TOOLBAR_IDLE_MS = 2500;
const SECTIONS_KEY = 'game-of-life-sections';
const SIDEBAR_TABS: [SidebarTab, string][] = [
  ['settings', 'Settings'],
  ['patterns', 'Patterns'],
  ['share', 'Share'],
];
const WRAP_COPIES = [
  [0, 0],
  [-1, 0],
  [0, -1],
  [-1, -1],
];
const ARROW_MOVES: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
const SECTION_DEFAULTS = {
  field: true,
  simulation: true,
  rules: false,
  look: false,
  colors: false,
  engine: false,
};

type SectionName = keyof typeof SECTION_DEFAULTS;
type Sections = Record<SectionName, boolean>;
type TourSnapshot = {
  isSettingsOpen: boolean;
  sidebarTab: SidebarTab;
  openSections: Sections;
};

const SECTION_NAMES = Object.keys(SECTION_DEFAULTS) as SectionName[];

// Stored by this page, but read back as untrusted: only known names with
// boolean values make it into the state.
const readSections = (): Sections => {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(SECTIONS_KEY) ?? 'null'
    );
    const sections = { ...SECTION_DEFAULTS };
    if (stored && typeof stored === 'object') {
      const values: Partial<Record<SectionName, unknown>> = stored;
      for (const name of SECTION_NAMES) {
        const open = values[name];
        if (typeof open === 'boolean') sections[name] = open;
      }
    }
    return sections;
  } catch {
    return SECTION_DEFAULTS;
  }
};

const storeSections = (sections: Sections) => {
  try {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
    return true;
  } catch {
    return false;
  }
};

const toPixelColor = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  return (
    (0xff000000 |
      ((value & 0xff) << 16) |
      (value & 0xff00) |
      ((value >> 16) & 0xff)) >>>
    0
  );
};

const toScreenPixel = (ratio: number) =>
  ratio >= 2 && Number.isInteger(ratio) ? 1 / ratio : null;

const toScreenPixels = (size: number, ratio: number) =>
  Math.ceil(size / ratio);

const toFieldSize = (value: number | string, fallback: number) => {
  const size = Math.floor(Number(value));
  return size >= 1 ? Math.min(size, MAX_FIELD_SIZE) : fallback;
};

const getFullscreenElement = () =>
  document.fullscreenElement ??
  (document as WebkitDocument).webkitFullscreenElement ??
  null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const wrapIndex = (value: number, size: number) =>
  ((value % size) + size) % size;

const toggleRule = (rules: number[], n: number) =>
  rules.includes(n)
    ? rules.filter((rule) => rule !== n)
    : [...rules, n].sort((a, b) => a - b);

export default function TheGameOfLifeUltimate() {
  const [dataStructure, setDataStructure] =
    useState<DataStructure>('bit array');
  // Width, height and speed hold the raw input text while it's being typed.
  const [width, setWidth] = useState<number | string>(76);
  const [height, setHeight] = useState<number | string>(33);
  const [cellSize, setCellSize] = useState(14);
  const [pixelRatio, setPixelRatio] = useState(
    () => window.devicePixelRatio || 1
  );
  const [fitMode, setFitMode] = useState<FitMode | null>(null);
  const [fieldType, setFieldType] = useState<FieldType>('limited');
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
  const [speed, setSpeed] = useState<number | string>(10);
  const [survivalRules, setSurvivalRules] = useState([2, 3]);
  const [birthRules, setBirthRules] = useState([3]);
  const [viewportSize, setViewportSize] = useState<ViewportSize | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourSeen, markTourSeen] = useTourSeen('game-of-life');
  const [showGrid, setShowGrid] = useState(true);
  const [fade, setFade] = useState(0);
  const [openSections, setOpenSections] = useState(readSections);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isToolbarIdle, setIsToolbarIdle] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('settings');
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isDroppingFile, setIsDroppingFile] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [customPatterns, addCustomPattern, removeCustomPattern] =
    useCustomPatterns(MAX_FIELD_SIZE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    () => window.matchMedia('(min-width: 861px)').matches
  );
  const [isCompact, setIsCompact] = useState(
    () => window.matchMedia(COMPACT_QUERY).matches
  );

  const pageRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wasFullscreenRef = useRef(false);
  const settingsBeforeFullscreenRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const explainerButtonRef = useRef<HTMLButtonElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tourSnapshotRef = useRef<TourSnapshot | null>(null);
  const pendingBoardRef = useRef<Board | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const loadFromHashRef = useRef<(() => Promise<void>) | null>(null);
  // The field and its size are set by the size effect on mount. Handlers and
  // the loop only run after it, so they read both with `!`.
  const fieldRef = useRef<Field | null>(null);
  const dimensionsRef = useRef<{ cols: number; rows: number } | null>(null);
  const fadeRef = useRef<FadeHistory>({ layers: [], scratch: null });
  const engineRef = useRef<Engine>(ENGINES[dataStructure]);
  const imageRef = useRef<PixelImage | null>(null);
  const generationRef = useRef(0);
  const aliveRef = useRef(0);
  const drawingRef = useRef<Drawing | null>(null);
  const lastSizeRef = useRef({ cols: 76, rows: 33 });
  const perfRef = useRef<PerfSample | null>(null);
  const placementRef = useRef<{ pattern: Pattern; shape: Shape } | null>(
    null
  );
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostCellRef = useRef<Cell | null>(null);
  const placingPointerRef = useRef<number | null>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const dragPointRef = useRef([0, 0]);

  const cols = toFieldSize(width, lastSizeRef.current.cols);
  const rows = toFieldSize(height, lastSizeRef.current.rows);
  lastSizeRef.current = { cols, rows };

  const screenPixel = toScreenPixel(pixelRatio);
  const isScreenPixel = cellSize < 1;
  const cellSizeMin = screenPixel ? 0 : MIN_CELL_SIZE;
  const cellSizeStep = isScreenPixel ? 0 : cellSize;
  const fillsWidth =
    viewportSize && Math.floor(viewportSize.width / cellSize) === cols;
  const fillsHeight =
    viewportSize && Math.floor(viewportSize.height / cellSize) === rows;
  const scalesToFit =
    isFullscreen && viewportSize && !(fillsWidth && fillsHeight);
  const fitScale = scalesToFit
    ? Math.min(viewportSize.width / cols, viewportSize.height / rows)
    : cellSize;
  const isPixelPerfect = isScreenPixel && !scalesToFit;
  const stageWidth = scalesToFit
    ? cols * fitScale
    : isScreenPixel
    ? toScreenPixels(cols, pixelRatio)
    : fillsWidth
    ? viewportSize.width
    : cols * cellSize;
  const stageHeight = scalesToFit
    ? rows * fitScale
    : isScreenPixel
    ? toScreenPixels(rows, pixelRatio)
    : fillsHeight
    ? viewportSize.height
    : rows * cellSize;
  const findPattern = (id: string) =>
    patternsById.get(id) ??
    customPatterns.find((pattern) => pattern.id === id);
  const placingPattern = placing ? findPattern(placing.id) : null;
  const placingShape =
    placing && placingPattern
      ? transformShape(placingPattern, placing.rotation, placing.flipped)
      : null;
  placementRef.current =
    placingPattern && placingShape
      ? { pattern: placingPattern, shape: placingShape }
      : null;
  const placingId = placing?.id;
  const currentRule = { birth: birthRules, survival: survivalRules };
  const genesPerSecondLabel =
    genesPerSecond >= 100
      ? Math.round(genesPerSecond)
      : genesPerSecond.toFixed(1);

  const runSettings = {
    cols,
    rows,
    speed: Math.min(Math.max(Number(speed) || 0, 0), MAX_SPEED),
    wrap: fieldType === 'closed',
    birthRules,
    survivalRules,
    aliveColor: toPixelColor(colorOfAliveCell),
    deadColor: toPixelColor(colorOfDeadCell),
    fade,
  };
  const settingsRef = useRef(runSettings);
  settingsRef.current = runSettings;

  const paint = () => {
    const image = imageRef.current;
    if (!image || !fieldRef.current) return;
    const { aliveColor, deadColor, fade } = settingsRef.current;
    const history = fadeRef.current;
    if (fade && history.layers.length) {
      const { cols, rows } = dimensionsRef.current!;
      history.scratch ??= new Uint32Array(layerSize(cols, rows));
      engineRef.current.toBits(fieldRef.current, cols, rows, history.scratch);
      paintFaded(
        history.scratch,
        history.layers,
        fadePalette(aliveColor, deadColor, fade),
        deadColor,
        image.pixels,
        cols,
        rows
      );
    } else {
      engineRef.current.paint(
        fieldRef.current,
        image.pixels,
        aliveColor,
        deadColor
      );
    }
    canvasRef.current!.getContext('2d')!.putImageData(image.data, 0, 0);
  };

  const syncStats = () => {
    setNumberOfGenes(generationRef.current);
    setCellsAlive(aliveRef.current);
  };

  const stepOnce = () => {
    const { cols, rows, wrap, birthRules, survivalRules, fade } =
      settingsRef.current;
    if (fade) {
      const { cols: width, rows: height } = dimensionsRef.current!;
      recordLayer(
        fadeRef.current.layers,
        fade,
        layerSize(width, height),
        (layer) =>
          engineRef.current.toBits(fieldRef.current!, width, height, layer)
      );
    }
    const result = engineRef.current.makeAStep(fieldRef.current!, {
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

  const replaceField = (field: Field) => {
    fieldRef.current = field;
    fadeRef.current.layers.length = 0;
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

  const fitField = (mode: FitMode, size: number) => {
    const main = mainRef.current!.getBoundingClientRect();
    const viewport = getComputedStyle(viewportRef.current!);
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

  const wakeToolbar = () => {
    setIsToolbarIdle(false);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(
      () => setIsToolbarIdle(true),
      TOOLBAR_IDLE_MS
    );
  };

  const enterFullscreen = () => {
    settingsBeforeFullscreenRef.current = isSettingsOpen;
    setIsSettingsOpen(false);
    setIsFullscreen(true);
    wakeToolbar();
    const page: WebkitElement = pageRef.current!;
    const request = page.requestFullscreen ?? page.webkitRequestFullscreen;
    if (request) Promise.resolve(request.call(page)).catch(() => {});
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    clearTimeout(idleTimerRef.current);
    if (!getFullscreenElement()) return;
    const doc: WebkitDocument = document;
    const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    if (exit) Promise.resolve(exit.call(document)).catch(() => {});
  };

  const fillScreen = () => {
    fitField('screen', cellSize);
    setFitMode(null);
  };

  const changeCellSize = (size: number) => {
    setCellSize(size);
    if (fitMode) fitField(fitMode, size);
  };

  const setColorPreset = (preset: ColorPreset) => {
    setColorOfAliveCell(preset.alive);
    setColorOfDeadCell(preset.dead);
    setColorOfCellSeparator(preset.separator);
  };

  const setRulesPreset = (preset: RulePreset) => {
    setSurvivalRules(preset.survive);
    setBirthRules(preset.birth);
  };

  const isColorPresetActive = (preset: ColorPreset) =>
    preset.alive.toLowerCase() === colorOfAliveCell.toLowerCase() &&
    preset.dead.toLowerCase() === colorOfDeadCell.toLowerCase() &&
    preset.separator.toLowerCase() === colorOfCellSeparator.toLowerCase();

  const formatRules = (rules: number[]) => [...rules].sort().join('');

  const activeRulesPreset = rulesPresetsList.find(
    (preset) =>
      formatRules(preset.birth) === formatRules(birthRules) &&
      formatRules(preset.survive) === formatRules(survivalRules)
  );

  const toggleSection =
    (name: SectionName) => (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      const open = e.currentTarget.open;
      setOpenSections((prev) => {
        if (prev[name] === open) return prev;
        const next = { ...prev, [name]: open };
        storeSections(next);
        return next;
      });
    };

  const cellFromEvent = (e: Point): Cell => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cols, rows } = settingsRef.current;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(
      ((e.clientY - rect.top) / rect.height) * canvas.height
    );
    return [
      Math.min(Math.max(x, 0), cols - 1),
      Math.min(Math.max(y, 0), rows - 1),
    ];
  };

  const setCell = (x: number, y: number, value: number) => {
    const engine = engineRef.current;
    const { cols } = settingsRef.current;
    if (engine.get(fieldRef.current!, x, y, cols) === value) return;
    engine.set(fieldRef.current!, x, y, value, cols);
    aliveRef.current += value ? 1 : -1;
  };

  const getOrigin = ([x, y]: Cell, shape: Size): Cell => {
    const { cols, rows, wrap } = settingsRef.current;
    const left = x - Math.floor(shape.width / 2);
    const top = y - Math.floor(shape.height / 2);
    if (wrap) return [wrapIndex(left, cols), wrapIndex(top, rows)];
    return [
      clamp(left, 0, Math.max(cols - shape.width, 0)),
      clamp(top, 0, Math.max(rows - shape.height, 0)),
    ];
  };

  const showGhost = (cell: Cell) => {
    ghostCellRef.current = cell;
    const ghost = ghostRef.current;
    const placement = placementRef.current;
    if (!ghost || !placement) return;
    const [left, top] = getOrigin(cell, placement.shape);
    ghost.style.setProperty('--x', String(left));
    ghost.style.setProperty('--y', String(top));
    ghost.dataset.visible = 'true';
  };

  const hideGhost = () => {
    if (ghostRef.current) ghostRef.current.dataset.visible = 'false';
  };

  const getFieldCenter = (): Cell => {
    const { cols, rows } = settingsRef.current;
    return [Math.floor(cols / 2), Math.floor(rows / 2)];
  };

  const stampAt = (cell: Cell) => {
    const placement = placementRef.current;
    if (!placement) return;
    const { cols, rows, wrap } = settingsRef.current;
    const [left, top] = getOrigin(cell, placement.shape);
    for (const [x, y] of placement.shape.cells) {
      const cellX = wrap ? (left + x) % cols : left + x;
      const cellY = wrap ? (top + y) % rows : top + y;
      if (cellX < cols && cellY < rows) setCell(cellX, cellY, 1);
    }
    paint();
    setCellsAlive(aliveRef.current);
  };

  const beginPlacing = (pattern: Pattern) => {
    const { cols, rows } = settingsRef.current;
    ghostCellRef.current = null;
    setPlacing({
      id: pattern.id,
      rotation: fitsField(pattern, cols, rows) ? 0 : 1,
      flipped: false,
    });
  };

  const exitPlacing = () => {
    const id = placementRef.current?.pattern.id;
    setPlacing(null);
    placingPointerRef.current = null;
    if (document.activeElement === canvasRef.current && isSettingsOpen) {
      pageRef.current!
        .querySelector<HTMLElement>(`[data-pattern-id="${id}"]`)
        ?.focus();
    }
  };

  const selectPattern = (pattern: Pattern) => {
    if (placingId === pattern.id) {
      exitPlacing();
      return;
    }
    beginPlacing(pattern);
    if (isFullscreen || window.matchMedia('(max-width: 860px)').matches) {
      setIsSettingsOpen(false);
    }
  };

  const rotatePlacement = () =>
    setPlacing((prev) => {
      if (!prev) return prev;
      const { cols, rows } = settingsRef.current;
      // `placing` always names a pattern that exists: removing a custom
      // pattern clears it first.
      const turned = transformShape(
        findPattern(prev.id)!,
        (prev.rotation + 1) % 4,
        prev.flipped
      );
      const turns = fitsField(turned, cols, rows) ? 1 : 2;
      return { ...prev, rotation: (prev.rotation + turns) % 4 };
    });

  const flipPlacement = () =>
    setPlacing((prev) => prev && { ...prev, flipped: !prev.flipped });

  const growField = (pattern: Size) => {
    setWidth(Math.min(MAX_FIELD_SIZE, Math.max(cols, pattern.width + 16)));
    setHeight(Math.min(MAX_FIELD_SIZE, Math.max(rows, pattern.height + 16)));
    setFitMode(null);
  };

  const addPattern = (text: string, name: string) => {
    const result = addCustomPattern(text, name);
    if (result.pattern && fitsTurned(result.pattern, cols, rows)) {
      selectPattern(result.pattern);
    }
    return result;
  };

  const removePattern = (id: string) => {
    if (placingId === id) setPlacing(null);
    removeCustomPattern(id);
  };

  const applyRule = (rule: Rule) => {
    setBirthRules(rule.birth);
    setSurvivalRules(rule.survival);
  };

  const closeAbout = () => setIsAboutOpen(false);

  const showNotice = (text: string) => {
    setNotice(text);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  const pageUrl = () =>
    `${window.location.origin}${window.location.pathname}${window.location.search}`;

  const shareSettings = (): ShareSettings => ({
    cols,
    rows,
    cellSize,
    speed: settingsRef.current.speed,
    rule: currentRule,
    edges: fieldType === 'closed' ? 'wrap' : 'walls',
    colors: {
      alive: colorOfAliveCell,
      dead: colorOfDeadCell,
      grid: colorOfCellSeparator,
    },
    grid: showGrid,
    fade,
  });

  const boardRle = (withCredit: boolean) => {
    const engine = engineRef.current;
    const field = fieldRef.current!;
    return encodeBoardRle({
      cols,
      rows,
      wrap: fieldType === 'closed',
      rule: currentRule,
      isAlive: (x, y) => engine.get(field, x, y, cols),
      comment: withCredit
        ? `Made with The Game of Life Ultimate, ${pageUrl()}`
        : null,
    });
  };

  const getShareLink = async () => {
    const settings = shareSettings();
    const full = await encodeLinkData(createPayload(settings, boardRle(false)));
    const hasBoard = full.length <= LINK_LIMIT;
    const data = hasBoard
      ? full
      : await encodeLinkData(createPayload(settings));
    return { url: `${pageUrl()}#${HASH_KEY}=${data}`, hasBoard };
  };

  const getShareFile = () => ({
    blob: new Blob(
      [JSON.stringify(createPayload(shareSettings(), boardRle(true)), null, 2)],
      { type: 'application/json' }
    ),
    name: `game-of-life-${cols}x${rows}.json`,
  });

  const buildField = (board: Board) => {
    const engine = engineRef.current;
    const field = engine.generateField(board.cols, board.rows);
    board.cells.forEach(([x, y]) => engine.set(field, x, y, 1, board.cols));
    return field;
  };

  const loadBoard = ({ settings, cells }: Omit<SharedBoard, 'hasBoard'>) => {
    const viewport = viewportRef.current!.getBoundingClientRect();
    setRunning(false);
    if (placing) exitPlacing();
    setFitMode(null);
    setWidth(settings.cols);
    setHeight(settings.rows);
    const fit = Math.min(
      settings.cellSize,
      viewport.width / settings.cols,
      viewport.height / settings.rows
    );
    setCellSize(
      fit >= MIN_CELL_SIZE
        ? Math.floor(fit)
        : screenPixel && fit >= screenPixel
        ? screenPixel
        : MIN_CELL_SIZE
    );
    setSpeed(settings.speed);
    applyRule(settings.rule);
    setFieldType(settings.edges === 'wrap' ? 'closed' : 'limited');
    setColorOfAliveCell(settings.colors.alive);
    setColorOfDeadCell(settings.colors.dead);
    setColorOfCellSeparator(settings.colors.grid);
    setShowGrid(settings.grid);
    setFade(settings.fade);
    generationRef.current = 0;
    setGenesPerSecond(0);
    const board = { cols: settings.cols, rows: settings.rows, cells };
    const current = dimensionsRef.current;
    if (current && board.cols === current.cols && board.rows === current.rows) {
      replaceField(buildField(board));
    } else {
      pendingBoardRef.current = board;
    }
  };

  const openShareFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) return 'This file is too big to open.';
    const text = await file.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (data) {
      const board = readPayload(data, shareSettings(), SHARE_LIMITS);
      if (!board) return "This file isn't a board saved from this page.";
      loadBoard(board);
      return `Opened ${file.name}.`;
    }
    const rleBoard = readBoardRle(text, MAX_FIELD_SIZE);
    if (rleBoard) {
      const { cells, ...rest } = rleBoard;
      loadBoard({ settings: { ...shareSettings(), ...rest }, cells });
      return `Opened ${file.name}.`;
    }
    const hasName = /^(#N|!\s*Name:)/im.test(text);
    const result = addPattern(
      text,
      hasName ? '' : file.name.replace(/\.[^.]+$/, '')
    );
    if (result.error) return result.error;
    return fitsTurned(result.pattern, cols, rows)
      ? `Added ${result.pattern.name} to your patterns. Click the field to place it.`
      : `Added ${result.pattern.name} to your patterns. It needs a bigger field, so use Grow field in Patterns.`;
  };

  const loadFromHash = async () => {
    const data = readHashData(window.location.hash);
    if (!data) return;
    window.history.replaceState(window.history.state, '', pageUrl());
    try {
      const board = readPayload(
        await decodeLinkData(data),
        shareSettings(),
        SHARE_LIMITS
      );
      if (!board) throw new Error('Not a board');
      loadBoard(board);
      showNotice(
        board.hasBoard
          ? 'Opened a shared board.'
          : 'Opened shared settings. The board was too big to fit in the link.'
      );
    } catch {
      showNotice("This link is damaged, so the board couldn't be opened.");
    }
  };
  loadFromHashRef.current = loadFromHash;

  const openImage = (file: File) => {
    setImageFile(file);
    setIsImageOpen(true);
  };

  const closeImage = () => {
    setIsImageOpen(false);
    setImageFile(null);
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) openImage(file);
  };

  const applyImage = (cells: Uint8Array, name: string) => {
    setRunning(false);
    if (placing) exitPlacing();
    const engine = engineRef.current;
    const field = engine.generateField(cols, rows);
    cells.forEach((cell, i) => {
      if (cell) engine.set(field, i % cols, Math.floor(i / cols), 1, cols);
    });
    generationRef.current = 0;
    setGenesPerSecond(0);
    replaceField(field);
    closeImage();
    showNotice(`Replaced the board with ${name}.`);
  };

  const isFileDrag = (e: React.DragEvent) =>
    [...e.dataTransfer.types].includes('Files');

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDroppingFile(true);
  };

  const handleFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDroppingFile(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDroppingFile(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) openImage(file);
    else if (file) showNotice(await openShareFile(file));
  };

  const startTour = () => {
    markTourSeen();
    if (placing) exitPlacing();
    aboutButtonRef.current?.focus({ preventScroll: true });
    tourSnapshotRef.current = { isSettingsOpen, sidebarTab, openSections };
    setIsTourOpen(true);
  };

  const startTourFromAbout = () => {
    setIsAboutOpen(false);
    requestAnimationFrame(startTour);
  };

  const closeTour = () => {
    setIsTourOpen(false);
    const snapshot = tourSnapshotRef.current;
    if (!snapshot) return;
    tourSnapshotRef.current = null;
    setIsSettingsOpen(snapshot.isSettingsOpen);
    setSidebarTab(snapshot.sidebarTab);
    setOpenSections(snapshot.openSections);
  };

  const tourSteps = getTourSteps({
    showPanel: (tab) => {
      setSidebarTab(tab);
      setIsSettingsOpen(true);
      document.getElementById('sidebar-panel')?.scrollTo({ top: 0 });
    },
    hidePanelOnMobile: () => {
      if (window.matchMedia('(max-width: 860px)').matches) {
        setIsSettingsOpen(false);
      }
    },
    openSection: (name) => {
      setSidebarTab('settings');
      setIsSettingsOpen(true);
      setOpenSections((prev) =>
        prev[name] ? prev : { ...prev, [name]: true }
      );
    },
  });

  const browsePatterns = () => {
    setIsAboutOpen(false);
    setSidebarTab('patterns');
    setIsSettingsOpen(true);
    requestAnimationFrame(() =>
      document.getElementById('sidebar-tab-patterns')?.focus()
    );
  };

  const isOverField = (e: Point) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX < rect.right &&
      e.clientY >= rect.top &&
      e.clientY < rect.bottom
    );
  };

  const startTileDrag = (
    e: React.PointerEvent<HTMLButtonElement>,
    pattern: Pattern
  ) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const wasPlacing = placementRef.current?.pattern.id === pattern.id;
    let dragging = false;

    const handleMove = (event: PointerEvent) => {
      dragPointRef.current = [event.clientX, event.clientY];
      if (!dragging) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < 6) {
          return;
        }
        dragging = true;
        if (!wasPlacing) beginPlacing(pattern);
        setDraggedId(pattern.id);
      }
      const overField = isOverField(event);
      if (overField) showGhost(cellFromEvent(event));
      else hideGhost();
      const token = tokenRef.current;
      if (token) {
        token.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
        token.dataset.hidden = String(overField);
      }
    };

    const handleEnd = (event: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      if (!dragging) return;
      setDraggedId(null);
      if (event.type === 'pointerup' && isOverField(event)) {
        stampAt(cellFromEvent(event));
      }
      if (!wasPlacing) setPlacing(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  const handleTabsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = sidebarTab === 'settings' ? 'patterns' : 'settings';
    setSidebarTab(next);
    e.currentTarget.querySelector<HTMLElement>(`#sidebar-tab-${next}`)?.focus();
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!placementRef.current) return;
    const { cols, rows } = settingsRef.current;
    const cell = ghostCellRef.current ?? getFieldCenter();
    const move = ARROW_MOVES[e.key];
    if (move) {
      e.preventDefault();
      const distance = e.shiftKey ? 10 : 1;
      showGhost([
        clamp(cell[0] + move[0] * distance, 0, cols - 1),
        clamp(cell[1] + move[1] * distance, 0, rows - 1),
      ]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showGhost(cell);
      stampAt(cell);
    }
  };

  const handleFieldFocus = () => {
    if (placementRef.current) showGhost(ghostCellRef.current ?? getFieldCenter());
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    if (placementRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      placingPointerRef.current = e.pointerId;
      showGhost(cellFromEvent(e));
      return;
    }
    const [x, y] = cellFromEvent(e);
    const value = engineRef.current.get(
      fieldRef.current!,
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

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (placementRef.current) {
      showGhost(cellFromEvent(e));
      return;
    }
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

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (placingPointerRef.current === e.pointerId) {
      placingPointerRef.current = null;
      stampAt(cellFromEvent(e));
      return;
    }
    drawingRef.current = null;
  };

  const handlePointerCancel = () => {
    placingPointerRef.current = null;
    drawingRef.current = null;
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && placingPointerRef.current === null) {
      hideGhost();
    }
  };

  useEffect(() => {
    const engine = engineRef.current;
    const previous = dimensionsRef.current;
    fieldRef.current = previous
      ? engine.updateFieldDimensions(
          fieldRef.current!,
          rows,
          cols,
          previous.rows,
          previous.cols
        )
      : engine.generateField(cols, rows);
    dimensionsRef.current = { cols, rows };
    fadeRef.current = { layers: [], scratch: null };
    const pending = pendingBoardRef.current;
    if (pending && pending.cols === cols && pending.rows === rows) {
      pendingBoardRef.current = null;
      fieldRef.current = buildField(pending);
    }

    const data = canvasRef.current!
      .getContext('2d')!
      .createImageData(cols, rows);
    imageRef.current = { data, pixels: new Uint32Array(data.data.buffer) };

    aliveRef.current = engine.countAliveCells(fieldRef.current);
    syncStats();
  }, [cols, rows]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = isScreenPixel
      ? toScreenPixels(cols, pixelRatio) * pixelRatio
      : cols;
    canvas.height = isScreenPixel
      ? toScreenPixels(rows, pixelRatio) * pixelRatio
      : rows;
    paint();
  }, [cols, rows, isScreenPixel, pixelRatio]);

  useEffect(() => {
    const engine = ENGINES[dataStructure];
    if (engine === engineRef.current) return;
    const { cols, rows } = settingsRef.current;
    fieldRef.current = convertField(
      engineRef.current,
      engine,
      fieldRef.current!,
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
    const { layers } = fadeRef.current;
    layers.length = Math.min(layers.length, fade);
    paint();
  }, [fade]);

  useEffect(() => {
    fitField(isSettingsOpen ? 'panel' : 'screen', cellSize);
  }, []);

  useEffect(() => {
    const handleHashChange = () => loadFromHashRef.current!();
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewportSize({ width, height });
    });
    observer.observe(viewportRef.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isExplainerOpen || isAboutOpen || isTourOpen) return;
      const target = e.target;
      const isTyping =
        target instanceof Element &&
        (target.closest('textarea, [contenteditable]') ||
          (target instanceof HTMLInputElement &&
            /^(text|number|search)$/.test(target.type)));
      if (isTyping) return;
      const file = [...(e.clipboardData?.files ?? [])].find((item) =>
        item.type.startsWith('image/')
      );
      if (!file) return;
      e.preventDefault();
      openImage(file);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isExplainerOpen, isAboutOpen, isTourOpen]);

  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${pixelRatio}dppx)`);
    const handleChange = () => {
      const ratio = window.devicePixelRatio || 1;
      const pixel = toScreenPixel(ratio);
      setPixelRatio(ratio);
      setCellSize((size) => (size < 1 ? pixel ?? MIN_CELL_SIZE : size));
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [pixelRatio]);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const handleChange = () => setIsCompact(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handleChange = () => {
      if (!getFullscreenElement()) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isExplainerOpen || isAboutOpen || isTourOpen || isImageOpen) return;
      if (e.key === 'Escape' && placing) {
        exitPlacing();
        return;
      }
      if (e.key === 'Escape' && isFullscreen) {
        if (isSettingsOpen) setIsSettingsOpen(false);
        else exitFullscreen();
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable]')
      ) {
        return;
      }
      if (e.code === 'Backquote' || e.key === '`') {
        e.preventDefault();
        setShowPerf((prev) => !prev);
        return;
      }
      if (placing && (e.code === 'KeyR' || e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        rotatePlacement();
        return;
      }
      if (placing && (e.code === 'KeyF' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        flipPlacement();
        return;
      }
      if (e.key !== 'f' && e.key !== 'F') return;
      e.preventDefault();
      if (isFullscreen) exitFullscreen();
      else enterFullscreen();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isFullscreen,
    isExplainerOpen,
    isAboutOpen,
    isTourOpen,
    isImageOpen,
    isSettingsOpen,
    placing,
  ]);

  useEffect(() => {
    if (placingId) canvasRef.current?.focus({ preventScroll: true });
  }, [placingId]);

  useEffect(() => {
    if (ghostCellRef.current && ghostRef.current?.dataset.visible === 'true') {
      showGhost(ghostCellRef.current);
    }
  }, [placing, cols, rows, fieldType]);

  useEffect(() => {
    if (isFullscreen) {
      toolbarRef.current?.querySelector<HTMLElement>('[data-play]')?.focus();
    } else if (wasFullscreenRef.current) {
      setIsSettingsOpen(settingsBeforeFullscreenRef.current);
      fullscreenButtonRef.current?.focus();
    }
    wasFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  useEffect(() => {
    if (!running) return;
    let frameId: number;
    let last = performance.now();
    let pending = 0;
    let windowStart = last;
    let windowSteps = 0;
    let statsSyncedAt = last;

    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick);
      const perf = perfRef.current;
      const elapsed = now - last;
      pending += (elapsed / 1000) * settingsRef.current.speed;
      last = now;

      const start = performance.now();
      const deadline = start + FRAME_BUDGET;
      let steps = 0;
      while (pending >= 1 && performance.now() < deadline) {
        stepOnce();
        pending -= 1;
        steps += 1;
      }
      const capped = pending >= 1;
      if (capped) pending = 0;

      const stepped = perf ? performance.now() : 0;
      if (steps) {
        paint();
        windowSteps += steps;
      }
      if (perf) {
        recordFrame(
          perf,
          elapsed,
          steps,
          stepped - start,
          performance.now() - stepped,
          capped
        );
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

  const transportControls = (
    <>
      <button
        className={`${styles.controlButton} ${styles.clearButton}`}
        aria-label="Clear the field"
        title="Clear the field"
        data-tour="controls"
        onClick={clearHandle}
      >
        <Icon icon={Trash2Icon} aria-hidden="true" />
      </button>
      <button
        className={styles.controlButton}
        aria-label="Step one generation"
        title="Step one generation"
        data-tour="controls"
        onClick={stepHandle}
      >
        <Icon icon={SkipForwardIcon} filled />
      </button>
      <button
        className={`${styles.controlButton} ${styles.playButton} ${
          running ? styles.playButton__running : ''
        }`}
        aria-label={running ? 'Pause' : 'Play'}
        title={running ? 'Pause' : 'Play'}
        data-play
        data-tour="controls"
        onClick={() => setRunning((prev) => !prev)}
      >
        {!running ? (
          <Icon icon={PlayIcon} filled />
        ) : (
          <Icon icon={PauseIcon} filled />
        )}
      </button>
      <label className={styles.speed} data-tour="speed">
        <span className={styles.speedLabel}>Speed</span>
        <input
          className={styles.speedInput}
          type="number"
          aria-label="Speed, generations per second"
          min={0}
          max={MAX_SPEED}
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
        />
        <span className={styles.unit}>gen/s</span>
      </label>
      <button
        className={`${styles.btn} ${styles.btnGhost} ${styles.maxButton}`}
        data-tour="speed"
        onClick={() => setSpeed(MAX_SPEED)}
      >
        Max
      </button>
    </>
  );

  const fullscreenButton = (
    <button
      ref={fullscreenButtonRef}
      className={styles.controlButton}
      data-tour="fullscreen"
      aria-label="Enter fullscreen"
      title="Fullscreen (F)"
      onClick={enterFullscreen}
    >
      <Icon icon={ExpandIcon} aria-hidden="true" />
    </button>
  );

  return (
    <div
      ref={pageRef}
      className={`${styles.theGameOfLifePage} ${
        isFullscreen ? styles.isFullscreen : ''
      } ${
        isFullscreen && isToolbarIdle && !isSettingsOpen ? styles.isIdle : ''
      } ${draggedId ? styles.isDraggingPattern : ''}`}
      onPointerMove={isFullscreen ? wakeToolbar : undefined}
      onPointerDown={isFullscreen ? wakeToolbar : undefined}
      onKeyDown={isFullscreen ? wakeToolbar : undefined}
    >
      <Header>
        <div className={styles.headerControls}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>The Game of Life Ultimate</h1>
            <button
              ref={aboutButtonRef}
              className={styles.aboutButton}
              data-tour="about"
              aria-label="What is the Game of Life?"
              title="What is the Game of Life?"
              onClick={() => setIsAboutOpen(true)}
            >
              <Icon icon={InfoIcon} aria-hidden="true" />
            </button>
          </div>
          {!isCompact && (
            <div className={styles.transport}>
              {transportControls}
              {fullscreenButton}
            </div>
          )}
          <dl className={styles.stats} data-tour="stats">
            <div>
              <dt>Generation</dt>
              <dd>{numberOfGenes}</dd>
            </div>
            <div>
              <dt>Gen/s</dt>
              <dd>{genesPerSecondLabel}</dd>
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
            data-tour="sidebar"
            inert={!isSettingsOpen}
          >
            <div
              className={`${styles.segmented} ${styles.sidebarTabs}`}
              role="tablist"
              aria-label="Sidebar"
              onKeyDown={handleTabsKeyDown}
            >
              {SIDEBAR_TABS.map(([value, label]) => (
                <button
                  key={value}
                  id={`sidebar-tab-${value}`}
                  role="tab"
                  aria-selected={sidebarTab === value}
                  aria-controls="sidebar-panel"
                  tabIndex={sidebarTab === value ? 0 : -1}
                  className={sidebarTab === value ? styles.isActive : ''}
                  onClick={() => setSidebarTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className={styles.sidebarContent}
              id="sidebar-panel"
              role="tabpanel"
              aria-labelledby={`sidebar-tab-${sidebarTab}`}
            >
              {sidebarTab === 'settings' ? (
                <>
                  <section className={styles.sidebarParam} data-tour="fill">
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
                        style={
                          {
                            '--fill': `${randomIndex * 100}%`,
                          } as React.CSSProperties
                        }
                        value={randomIndex}
                        onChange={(e) => setRandomIndex(Number(e.target.value))}
                      />
                    </label>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={randomClickHandle}
                    >
                      Randomize
                    </button>
                    <button
                      className={styles.btn}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      Fill from image
                    </button>
                    <input
                      ref={imageInputRef}
                      className={styles.fileInput}
                      type="file"
                      accept="image/*"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={pickImage}
                    />
                  </section>
                  <details
                    className={styles.panel}
                    data-tour="field-size"
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
                      <div className={styles.fieldGroup}>
                        <label className={styles.rangeField}>
                          <span className={styles.rangeHead}>
                            <span>Cell size</span>
                            <output>
                              {isScreenPixel
                                ? '1 screen pixel'
                                : `${cellSize} px`}
                            </output>
                          </span>
                          <input
                            type="range"
                            min={cellSizeMin}
                            max={MAX_CELL_SIZE}
                            step={1}
                            style={
                              {
                                '--fill': `${
                                  ((cellSizeStep - cellSizeMin) /
                                    (MAX_CELL_SIZE - cellSizeMin)) *
                                  100
                                }%`,
                              } as React.CSSProperties
                            }
                            value={cellSizeStep}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              // 0 is on the slider only when there is a
                              // screen pixel size to fall back to.
                              changeCellSize(value || screenPixel!);
                            }}
                          />
                        </label>
                        {isScreenPixel && (
                          <p className={styles.paramNote}>
                            Each cell is one pixel of your screen.
                          </p>
                        )}
                      </div>
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
                    data-tour="simulation"
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
                              onChange={(e) =>
                                setFieldType(e.target.value as FieldType)
                              }
                            />
                            <span>Walls</span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="fieldType"
                              value="closed"
                              checked={fieldType === 'closed'}
                              onChange={(e) =>
                                setFieldType(e.target.value as FieldType)
                              }
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
                            onChange={(e) => {
                              const picked = rulesPresetsList.find(
                                (preset) => preset.name === e.target.value
                              );
                              if (picked) setRulesPreset(picked);
                            }}
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
                          <Icon icon={ChevronDownIcon} aria-hidden="true" />
                        </span>
                      </label>
                      <details
                        className={styles.subPanel}
                        open={openSections.rules}
                        onToggle={toggleSection('rules')}
                      >
                        <summary className={styles.subPanelHead}>Edit rule</summary>
                        <div className={styles.subPanelBody}>
                          {(
                            [
                              ['Birth', 'B', birthRules, setBirthRules],
                              ['Survive', 'S', survivalRules, setSurvivalRules],
                            ] as const
                          ).map(([label, letter, rules, setRules]) => (
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
                    data-tour="look"
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
                              style={
                                {
                                  '--alive': preset.alive,
                                  '--dead': preset.dead,
                                  '--grid': preset.separator,
                                } as React.CSSProperties
                              }
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
                      <div className={styles.fieldGroup}>
                        <label className={styles.rangeField}>
                          <span className={styles.rangeHead}>
                            <span>Fade</span>
                            <output>
                              {fade
                                ? `${fade} generation${fade === 1 ? '' : 's'}`
                                : 'Off'}
                            </output>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={MAX_FADE}
                            step={1}
                            style={
                              {
                                '--fill': `${(fade / MAX_FADE) * 100}%`,
                              } as React.CSSProperties
                            }
                            value={fade}
                            onChange={(e) => setFade(Number(e.target.value))}
                          />
                        </label>
                        <p className={styles.paramNote}>
                          Dead cells fade out over this many generations, so you
                          can see where life just was.
                        </p>
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
                    data-tour="engine"
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
                                onChange={(e) =>
                                  setDataStructure(
                                    e.target.value as DataStructure
                                  )
                                }
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
                        <Icon icon={InfoIcon} aria-hidden="true" />
                        How the bit array works
                      </button>
                      <div className={styles.fieldGroup}>
                        <label className={styles.switchField}>
                          <span>Performance stats</span>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={showPerf}
                            onChange={(e) => setShowPerf(e.target.checked)}
                          />
                        </label>
                        <p className={styles.paramNote}>
                          Shows what limits the speed right now. Press{' '}
                          <kbd className={styles.kbd}>`</kbd> to toggle.
                        </p>
                      </div>
                    </div>
                  </details>
                </>
              ) : sidebarTab === 'patterns' ? (
                <PatternLibrary
                  cols={cols}
                  rows={rows}
                  aliveColor={colorOfAliveCell}
                  deadColor={colorOfDeadCell}
                  rule={currentRule}
                  selectedId={placingId}
                  customPatterns={customPatterns}
                  onSelect={selectPattern}
                  onAddPattern={addPattern}
                  onRemovePattern={removePattern}
                  onTilePointerDown={startTileDrag}
                  onGrow={growField}
                  onUseRule={applyRule}
                />
              ) : (
                <SharePanel
                  getLink={getShareLink}
                  getFile={getShareFile}
                  getRle={() => boardRle(true)}
                  onOpenFile={openShareFile}
                />
              )}
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
                data-tour="sidebar-toggle"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
              >
                <span className={styles.toggleTop}></span>
                <span className={styles.toggleBottom}></span>
              </button>
            </Tooltip>
          </div>
        </div>
        <div
          className={styles.body}
          onDragEnter={handleFileDragOver}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
        >
          <div className={styles.viewport} ref={viewportRef}>
            <div
              data-tour="field"
              data-screen-pixel={isPixelPerfect ? '' : undefined}
              className={`${styles.stage} ${
                fieldType === 'limited'
                  ? styles.field__limited
                  : styles.field__closed
              }`}
              style={
                {
                  width: stageWidth,
                  height: stageHeight,
                  ...(isPixelPerfect &&
                    viewportSize && {
                      marginLeft: Math.max(
                        0,
                        Math.floor((viewportSize.width - stageWidth) / 2)
                      ),
                      marginTop: Math.max(
                        0,
                        Math.floor((viewportSize.height - stageHeight) / 2)
                      ),
                    }),
                  '--cell-width': `${
                    isPixelPerfect ? cellSize : stageWidth / cols
                  }px`,
                  '--cell-height': `${
                    isPixelPerfect ? cellSize : stageHeight / rows
                  }px`,
                  '--grid-color': colorOfCellSeparator,
                  '--alive-color': colorOfAliveCell,
                } as React.CSSProperties
              }
            >
              <canvas
                className={styles.field}
                ref={canvasRef}
                role="img"
                tabIndex={placingPattern ? 0 : undefined}
                aria-label={
                  placingPattern
                    ? `Game field. Placing ${placingPattern.name}: arrow keys move it, Enter places it, R rotates, F flips, Escape finishes.`
                    : 'Game field. Click or drag to draw cells.'
                }
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerLeave}
                onKeyDown={handleFieldKeyDown}
                onFocus={handleFieldFocus}
              ></canvas>
              {showGrid && stageWidth / cols >= MIN_GRID_CELL_SIZE && (
                <div className={styles.grid} />
              )}
              {placingShape && (
                <div
                  ref={ghostRef}
                  className={styles.ghost}
                  style={
                    {
                      '--w': placingShape.width,
                      '--h': placingShape.height,
                      '--cols': cols,
                      '--rows': rows,
                    } as React.CSSProperties
                  }
                >
                  {(fieldType === 'closed' ? WRAP_COPIES : [[0, 0]]).map(
                    ([dx, dy]) => (
                      <PatternShape
                        key={`${dx} ${dy}`}
                        shape={placingShape}
                        gap={stageWidth / cols >= MIN_GRID_CELL_SIZE ? 0.12 : 0}
                        stretch
                        className={styles.ghostShape}
                        style={
                          { '--dx': dx, '--dy': dy } as React.CSSProperties
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </div>
          {showPerf && (
            <PerformanceHud
              perfRef={perfRef}
              running={running}
              targetSpeed={settingsRef.current.speed}
              budget={FRAME_BUDGET}
              resetKey={`${dataStructure} ${cols}×${rows} ${fieldType} B${birthRules}/S${survivalRules}`}
              memory={ENGINES[dataStructure].memory(cols, rows)}
              pixelBytes={cols * rows * Uint32Array.BYTES_PER_ELEMENT}
              onClose={() => setShowPerf(false)}
            />
          )}
          {placingPattern && placingShape && (
            <PlacementBar
              className={styles.placementBar}
              style={
                {
                  '--alive': colorOfAliveCell,
                  '--dead': colorOfDeadCell,
                } as React.CSSProperties
              }
              pattern={placingPattern}
              shape={placingShape}
              rule={currentRule}
              onRotate={rotatePlacement}
              onFlip={flipPlacement}
              onDone={exitPlacing}
              onUseRule={applyRule}
            />
          )}
          {isDroppingFile && (
            <div className={styles.dropZone}>
              Drop a board, a pattern or an image to open it
            </div>
          )}
          <p
            className={styles.notice}
            role="status"
            data-visible={notice ? '' : undefined}
          >
            {notice}
          </p>
        </div>
        {isFullscreen && (
          <div
            ref={toolbarRef}
            className={styles.toolbar}
            role="group"
            aria-label="Game controls"
          >
            <button
              className={`${styles.controlButton} ${
                isSettingsOpen ? styles.isActive : ''
              }`}
              aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
              aria-expanded={isSettingsOpen}
              title="Settings"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
            >
              <Icon icon={SlidersHorizontalIcon} aria-hidden="true" />
            </button>
            {transportControls}
            <dl className={styles.toolbarStats}>
              <div>
                <dt>Generation</dt>
                <dd>{numberOfGenes}</dd>
              </div>
              <div>
                <dt>Gen/s</dt>
                <dd>{genesPerSecondLabel}</dd>
              </div>
            </dl>
            <button
              className={styles.controlButton}
              aria-label="Fill the screen with cells"
              title="Fill the screen with cells"
              onClick={fillScreen}
            >
              <Icon icon={ScanIcon} aria-hidden="true" />
            </button>
            <button
              className={styles.controlButton}
              aria-label="Exit fullscreen"
              title="Exit fullscreen (Esc)"
              onClick={exitFullscreen}
            >
              <Icon icon={ShrinkIcon} aria-hidden="true" />
            </button>
          </div>
        )}
      </main>
      {isCompact && (
        <div className={styles.footer} role="group" aria-label="Game controls">
          {transportControls}
          {fullscreenButton}
        </div>
      )}
      {draggedId && (
        <div
          ref={tokenRef}
          className={styles.dragToken}
          style={
            {
              transform: `translate(${dragPointRef.current[0]}px, ${dragPointRef.current[1]}px)`,
              '--alive': colorOfAliveCell,
              '--dead': colorOfDeadCell,
            } as React.CSSProperties
          }
        >
          <PatternShape
            shape={findPattern(draggedId)!}
            gap={0.14}
            minWidth={5}
            minHeight={5}
          />
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite">
        {isFullscreen ? 'Fullscreen on. Press Escape to exit.' : ''}
      </p>
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
      <AboutDialog
        open={isAboutOpen}
        onClose={closeAbout}
        onBrowsePatterns={browsePatterns}
        onStartTour={startTourFromAbout}
      />
      <ImageDialog
        open={isImageOpen}
        file={imageFile}
        cols={cols}
        rows={rows}
        aliveColor={colorOfAliveCell}
        deadColor={colorOfDeadCell}
        onFile={openImage}
        onApply={applyImage}
        onClose={closeImage}
      />
      <Tour steps={tourSteps} open={isTourOpen} onClose={closeTour} />
      <TourInvite
        open={
          !tourSeen && !isFullscreen && !isAboutOpen && !isTourOpen && !placing
        }
        title="New here?"
        text="Take a quick tour of the controls."
        className={styles.invite}
        onStart={startTour}
        onDismiss={markTourSeen}
      />
    </div>
  );
}
