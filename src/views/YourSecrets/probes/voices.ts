import type { Probe } from './types';
import { languageNames } from './utils';

const loadVoices = () =>
  new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    const done = () => {
      clearTimeout(timer);
      speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(speechSynthesis.getVoices());
    };
    const timer = setTimeout(done, 1500);
    speechSynthesis.addEventListener('voiceschanged', done);
  });

const EXTRA = /\((Premium|Enhanced)\)|Natural|Neural|Siri/;

const voices: Probe = {
  id: 'voices',
  title: 'Voices',
  category: 'Media',
  access: 'none',
  weight: 5,
  heavy: true,
  compat: [
    'api.SpeechSynthesis.getVoices',
    'api.SpeechSynthesisVoice.localService',
  ],
  how: 'speechSynthesis.getVoices(). Nothing is spoken.',
  why: 'The voice list mirrors your system: each OS ships its own voices, and the extra ones you downloaded and the languages you added show up too.',
  async collect() {
    if (typeof speechSynthesis === 'undefined')
      return {
        lead: null,
        facts: [
          ['Default voice', null],
          ['On this device', null],
          ['From the cloud', null],
          ['Languages', null],
          ['Added by you', null],
        ],
      };
    const list = await loadVoices();
    const local = list.filter((v) => v.localService);
    const extra = [
      ...new Set(list.filter((v) => EXTRA.test(v.name)).map((v) => v.name)),
    ];
    const languages = [...new Set(list.map((v) => v.lang.split(/[-_]/)[0]))];
    const fallback = list.find((v) => v.default) ?? null;
    return {
      lead: list.length ? `${list.length} voices` : 'No voices',
      facts: [
        ['Default voice', fallback && fallback.name],
        ['On this device', String(local.length)],
        ['From the cloud', String(list.length - local.length)],
        [
          'Languages',
          languages.length
            ? `${languages.length}: ${languageNames(languages).slice(0, 4).join(', ')}${languages.length > 4 ? '…' : ''}`
            : 'None',
        ],
        [
          'Added by you',
          extra.length
            ? `${extra.slice(0, 3).join(', ')}${extra.length > 3 ? ` and ${extra.length - 3} more` : ''}`
            : 'None',
        ],
      ],
      raw: list
        .map((v) => `${v.name} · ${v.lang}${v.localService ? '' : ' · cloud'}`)
        .join('\n'),
    };
  },
};

export default voices;
