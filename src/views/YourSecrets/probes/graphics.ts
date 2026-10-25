import type { Probe } from './types';
import { readRendering } from './offscreen';

const textureCompression = (features: string[] | null) => {
  if (!features) return null;
  const formats = [
    features.includes('texture-compression-bc') && 'BC',
    features.includes('texture-compression-etc2') && 'ETC2',
    features.includes('texture-compression-astc') && 'ASTC',
  ].filter(Boolean);
  return formats.length ? formats.join(', ') : 'None';
};

const cleanRenderer = (raw: string | null) => {
  if (!raw) return null;
  const angle = raw.match(/^ANGLE \((.+?), (.+?)(, [^,]+)?\)$/);
  return (angle ? angle[2] : raw)
    .replace(/^ANGLE [^:]+: /, '')
    .replace(/\s*\(0x[0-9a-f]+\).*$/i, '')
    .replace(/ Direct3D.*$/, '')
    .replace(/, or similar$/, '')
    .trim();
};

const graphics: Probe = {
  id: 'graphics',
  title: 'Graphics card',
  category: 'Device',
  access: 'none',
  weight: 8,
  compat: [
    'api.WEBGL_debug_renderer_info',
    'api.EXT_texture_filter_anisotropic',
    'api.Navigator.gpu',
  ],
  how: 'WebGL WEBGL_debug_renderer_info and its limits, navigator.gpu.requestAdapter() and the features of the adapter',
  why: 'The exact GPU model splits people with the same OS and browser into much smaller groups, and its limits split them further. Safari answers "Apple GPU" for everyone on purpose.',
  async collect() {
    const {
      renderer: raw,
      vendor,
      maxTexture,
      maxViewport,
      anisotropy,
      extensions,
      webgpu,
      gpuFamily,
      webgpuFeatures,
    } = await readRendering();
    return {
      lead: cleanRenderer(raw),
      facts: [
        ['Vendor', vendor && vendor.replace(/^Google Inc\. \((.+)\)$/, '$1')],
        ['Largest texture', maxTexture ? `${maxTexture} px` : null],
        ['Largest viewport', maxViewport],
        ['Anisotropic filtering', anisotropy ? `${anisotropy}×` : null],
        ['WebGL extensions', extensions !== null ? String(extensions) : null],
        [
          'WebGPU',
          webgpu
            ? webgpuFeatures
              ? `Yes, with ${webgpuFeatures.length} optional features`
              : 'Yes'
            : 'No',
        ],
        ['GPU family', gpuFamily],
        [
          'Texture compression',
          webgpu ? textureCompression(webgpuFeatures) : null,
        ],
      ],
      raw: webgpuFeatures?.length
        ? `${raw}\n\nWebGPU features:\n${webgpuFeatures.join('\n')}`
        : raw,
    };
  },
};

export default graphics;
