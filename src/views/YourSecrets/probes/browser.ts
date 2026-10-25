type HighEntropyValues = {
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
  formFactors?: string[];
  fullVersionList?: { brand: string; version: string }[];
};

type NavigatorExtras = {
  keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> };
  userAgentData?: {
    platform: string;
    mobile: boolean;
    brands?: { brand: string; version: string }[];
    getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyValues>;
  };
  deviceMemory?: number;
  connection?: {
    downlink: number;
    effectiveType: string;
    rtt: number;
    saveData: boolean;
  };
  getBattery?: () => Promise<{
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
  }>;
  globalPrivacyControl?: boolean;
  xr?: { isSessionSupported: (mode: string) => Promise<boolean> };
  devicePosture?: { type: string };
  userActivation?: { hasBeenActive: boolean };
  gpu?: {
    requestAdapter: () => Promise<{
      info?: { vendor?: string; architecture?: string };
    } | null>;
  };
};

type ScreenExtras = {
  isExtended?: boolean;
};

export const nav = () => navigator as unknown as Navigator & NavigatorExtras;

export const display = () => screen as Screen & ScreenExtras;
