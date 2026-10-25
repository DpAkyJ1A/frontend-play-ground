import type { Probe } from './types';
import { nav } from './browser';
import { withTimeout, yesNo } from './utils';

export const parseUA = (ua: string) => {
  const pick = (re: RegExp) => (ua.match(re) || [])[1];
  let browser: string | null = null;
  let version: string | undefined;
  if (/Edg\//.test(ua)) [browser, version] = ['Edge', pick(/Edg\/(\d+)/)];
  else if (/OPR\//.test(ua)) [browser, version] = ['Opera', pick(/OPR\/(\d+)/)];
  else if (/Firefox\//.test(ua))
    [browser, version] = ['Firefox', pick(/Firefox\/(\d+)/)];
  else if (/Chrome\//.test(ua))
    [browser, version] = ['Chrome', pick(/Chrome\/(\d+)/)];
  else if (/Safari\//.test(ua))
    [browser, version] = ['Safari', pick(/Version\/([\d.]+)/)];
  let os: string | null = null;
  if (/iPhone|iPad/.test(ua))
    os = `iOS ${(pick(/OS ([\d_]+)/) || '').split('_')[0]}`;
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = `Android ${pick(/Android ([\d]+)/) || ''}`;
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let engine: string | null = null;
  if (/Firefox\//.test(ua)) engine = 'Gecko';
  else if (/Chrome\//.test(ua)) engine = 'Blink';
  else if (/AppleWebKit/.test(ua)) engine = 'WebKit';
  return { browser, version, os: os && os.trim(), engine };
};

const system: Probe = {
  id: 'system',
  title: 'System',
  category: 'Device',
  access: 'none',
  weight: 9,
  compat: [
    'api.Navigator.userAgent',
    'api.Navigator.userAgentData',
    'api.NavigatorUAData.getHighEntropyValues',
  ],
  how: 'navigator.userAgent, navigator.userAgentData.getHighEntropyValues() with platformVersion, architecture, bitness, fullVersionList, formFactors and model',
  why: 'Every request your browser makes carries its name, version and OS. Chromium browsers will also tell the exact OS version and CPU architecture to any page that asks.',
  async collect() {
    const ua = parseUA(navigator.userAgent);
    let os = ua.os;
    let arch: string | null = null;
    let full: string | null = null;
    let form: string | null = null;
    let model: string | null = null;
    const data = nav().userAgentData;
    if (data?.getHighEntropyValues) {
      const v = await withTimeout(
        data.getHighEntropyValues([
          'platformVersion',
          'architecture',
          'bitness',
          'fullVersionList',
          'formFactors',
          'model',
        ]),
        800
      );
      if (v) {
        const major = parseInt(v.platformVersion ?? '', 10);
        if (data.platform === 'macOS') os = `macOS ${major}`;
        else if (data.platform === 'Windows')
          os = major >= 13 ? 'Windows 11' : 'Windows 10';
        else if (data.platform)
          os = `${data.platform} ${v.platformVersion || ''}`.trim();
        if (v.architecture)
          arch = `${v.architecture === 'arm' ? 'ARM' : v.architecture}, ${v.bitness}-bit`;
        const brand = (v.fullVersionList || []).find(
          (b) => !/Not.?A.?Brand|Chromium/i.test(b.brand)
        );
        if (v.formFactors?.length) form = v.formFactors.join(', ');
        model = v.model || null;
        if (brand)
          full = `${brand.brand.replace('Google ', '')} ${brand.version
            .split('.')
            .slice(0, 2)
            .join('.')}`;
      }
    }
    const browser =
      full || (ua.browser && `${ua.browser} ${ua.version || ''}`.trim());
    return {
      lead: os,
      facts: [
        ['Browser', browser],
        ['Engine', ua.engine],
        ['CPU architecture', arch],
        [
          'Mobile',
          yesNo(data ? data.mobile : /Mobi/.test(navigator.userAgent)),
        ],
        ['Form factor', form],
        ...(data?.mobile ? [['Model', model] as [string, string | null]] : []),
      ],
      raw: navigator.userAgent,
    };
  },
};

export default system;
