import type { Fact, Probe } from './types';
import { nav } from './browser';
import { languageNames, listText, withTimeout } from './utils';

// Chrome's built-in AI: a language model and translation and speech packs it
// downloads on demand. Asking whether each is there downloads nothing.

type Availability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';
type Asks = { availability: (options?: object) => Promise<Availability> };

const api = (name: string) =>
  (window as unknown as Record<string, Asks | undefined>)[name];

const speech = () => {
  const w = window as unknown as Record<
    string,
    { available?: (o: object) => Promise<Availability> } | undefined
  >;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition)?.available;
};

// the languages Chrome translates and recognises on the device
const TRANSLATE = [
  'ar',
  'bg',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'fi',
  'fr',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'kn',
  'ko',
  'lt',
  'mr',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
];
const SPEECH = [
  'en-US',
  'en-GB',
  'de-DE',
  'es-ES',
  'fr-FR',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'pt-BR',
  'ru-RU',
  'zh-CN',
  'hi-IN',
];

// Only Chrome and Edge ship a model behind these. Elsewhere, and where the
// model service is off, asking still answers but warns in the console.
const shipsModel = () =>
  (nav().userAgentData?.brands ?? []).some(
    ({ brand }) => brand === 'Google Chrome' || brand === 'Microsoft Edge'
  );

const ENGLISH = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

const ask = async (question: () => Promise<Availability>) => {
  try {
    return await withTimeout(question(), 1500);
  } catch {
    return null;
  }
};

const STATE: Record<Availability, string> = {
  available: 'Downloaded',
  downloading: 'Downloading now',
  downloadable: 'Not downloaded yet',
  unavailable: 'Not on this device',
};

const EMPTY: Fact[] = [
  ['On-device AI model', null],
  ['Translation packs', null],
  ['Language detection', null],
  ['Speech on the device', null],
];

const ai: Probe = {
  id: 'ai',
  title: 'Built-in AI',
  category: 'Browser',
  access: 'none',
  weight: 5,
  heavy: true,
  compat: [
    'api.LanguageModel',
    'api.Translator.availability_static',
    'api.LanguageDetector',
    'api.SpeechRecognition.available_static',
  ],
  how: 'availability() of LanguageModel and LanguageDetector (in Chrome and Edge, which ship a model) and of Translator for each language pair, and SpeechRecognition.available() with processLocally for each language. Nothing is downloaded.',
  why: 'Chrome downloads its AI model and each translation or speech pack only when someone uses them. A pack already on the device means you, or a site you used, needed that language: one more clue to the languages you live in.',
  async collect() {
    const ships = shipsModel();
    const model = ships ? api('LanguageModel') : undefined;
    const translator = api('Translator');
    const detector = ships ? api('LanguageDetector') : undefined;
    const local = speech();
    if (!model && !translator && !detector && !local)
      return { lead: 'Not in this browser', guarded: true, facts: EMPTY };
    const [modelState, detectorState, pairs, voices] = await Promise.all([
      model ? ask(() => model.availability(ENGLISH)) : null,
      detector ? ask(() => detector.availability()) : null,
      translator
        ? Promise.all(
            TRANSLATE.map((target) =>
              ask(() =>
                translator.availability({
                  sourceLanguage: 'en',
                  targetLanguage: target,
                })
              )
            )
          )
        : null,
      local
        ? Promise.all(
            SPEECH.map((lang) =>
              ask(() => local({ langs: [lang], processLocally: true }))
            )
          )
        : null,
    ]);
    const packs = pairs && TRANSLATE.filter((_, i) => pairs[i] === 'available');
    const spoken = voices && SPEECH.filter((_, i) => voices[i] === 'available');
    const named = (codes: string[] | null) =>
      codes === null
        ? null
        : codes.length
          ? listText(languageNames(codes))
          : 'None downloaded';
    return {
      lead:
        modelState === 'available'
          ? 'An AI model on this device'
          : packs?.length
            ? `Translates ${listText(languageNames(packs))} offline`
            : modelState === 'downloading'
              ? 'Downloading its AI model now'
              : modelState === 'unavailable'
                ? 'No AI model on this device'
                : 'Nothing downloaded yet',
      facts: [
        ['On-device AI model', modelState && STATE[modelState]],
        ['Translation packs', named(packs)],
        ['Language detection', detectorState && STATE[detectorState]],
        ['Speech on the device', named(spoken)],
      ],
    };
  },
};

export default ai;
