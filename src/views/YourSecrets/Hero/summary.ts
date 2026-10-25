import type { ProbeResult } from '../probes/types';
import { hash, listText } from '../probes/utils';

export type Results = ReadonlyMap<string, ProbeResult>;

export const portrait = (results: Results) => {
  const system = results.get('system');
  const graphics = results.get('graphics');
  const locale = results.get('locale');
  const settings = results.get('preferences');
  let text = 'You’re';
  if (system?.lead) text += ` on ${system.lead}`;
  const gpu = graphics?.lead;
  if (gpu && gpu !== 'Apple GPU') {
    const article = /^(?:[aeiou]|nvidia|amd|rtx|m\d)/i.test(gpu) ? 'an' : 'a';
    text += ` with ${article} ${gpu}`;
  }
  if (locale?.meta) {
    if (locale.meta.city) text += `, on ${locale.meta.city} time`;
    if (locale.meta.languages?.length)
      text += `, reading ${listText(locale.meta.languages)}`;
  }
  if (settings?.lead) text += `, with ${settings.lead.toLowerCase()} on`;
  return `${text}.`;
};

export const fingerprintId = (results: Results) => {
  const lead = (id: string) => results.get(id)?.lead ?? null;
  const meta = (id: string) => results.get(id)?.meta;
  const signals = [
    meta('fingerprint')?.canvas ?? null,
    meta('fingerprint')?.audio ?? null,
    results.get('graphics')?.raw ?? null,
    lead('display'),
    lead('locale'),
    meta('locale')?.codes ?? null,
    lead('hardware'),
    meta('fonts')?.fonts ?? null,
    lead('system'),
  ];
  const id = hash(JSON.stringify(signals)).slice(0, 12);
  return id.match(/.{4}/g)!.join(' ');
};
