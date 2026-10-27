export type Access = 'none' | 'gesture' | 'permission';

export type Category =
  | 'Behaviour'
  | 'Browser'
  | 'Device'
  | 'Locale'
  | 'Location'
  | 'Media'
  | 'Network'
  | 'Privacy'
  | 'Screen';

export type Fact = [label: string, value: string | null];

export type ProbeMeta = {
  city?: string | null;
  languages?: string[];
  codes?: readonly string[];
  canvas?: string | null;
  audio?: string | null;
  webgl?: string | null;
  fonts?: string[];
  timeZone?: string;
  country?: string | null;
  behind?: number | null;
  version?: string;
  newest?: string;
};

export type ProbeResult = {
  lead: string | null;
  facts: Fact[];
  raw?: string | null;
  meta?: ProbeMeta;
  guarded?: boolean;
  final?: boolean;
  link?: { href: string; label: string };
  image?: { src: string; alt: string };
  failed?: boolean;
};

export type ProbeContext = {
  hasServer: boolean;
};

export type Probe = {
  id: string;
  title: string;
  category: Category;
  access: Access;
  weight: number;
  how: string;
  why: string;
  collect: (context: ProbeContext) => Promise<ProbeResult>;
  heavy?: boolean;
  live?: boolean;
  watch?: () => () => void;
  watchWhenSettled?: boolean;
  request?: () => Promise<ProbeResult>;
  action?: string;
  note?: string;
  readFile?: (file: File) => Promise<ProbeResult>;
  accept?: string;
  permission?: PermissionName;
  compat?: string[];
};
