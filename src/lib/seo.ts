import type { Metadata } from 'next';
import type { Graph, WebApplication } from 'schema-dts';
import {
  EYE_CONTROL_ROUTE,
  FIND_NUMBER_IN_PI_ROUTE,
  HOME_ROUTE,
  THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
  YOUR_SECRETS_ROUTE,
} from '@/utils/constants/routes';
import {
  AUTHOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  pageUrl,
} from './site';

export type Experiment = {
  path: string;
  name: string;
  description: string;
  category: NonNullable<WebApplication['applicationCategory']>;
};

export const EXPERIMENTS = {
  eyeControl: {
    path: EYE_CONTROL_ROUTE,
    name: 'Eye Control',
    description:
      'Steer a web page with your eyes: a webcam, a 30-second calibration and a cursor that snaps to the nearest button. The face model runs in your browser.',
    category: 'UtilitiesApplication',
  },
  gameOfLife: {
    path: THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
    name: 'The Game of Life Ultimate',
    description:
      'Play Conway’s Game of Life in the browser: draw cells, load patterns, change the rules and run a bit-packed engine at tens of thousands of generations a second.',
    category: 'GameApplication',
  },
  findNumberInPi: {
    path: FIND_NUMBER_IN_PI_ROUTE,
    name: 'Find Your Number in Pi',
    description:
      'Search five billion digits of π for a birthday, phone number or PIN, see exactly where it sits, then scroll on through 100 trillion digits.',
    category: 'EntertainmentApplication',
  },
  yourSecrets: {
    path: YOUR_SECRETS_ROUTE,
    name: 'Your Secrets',
    description:
      'See what your browser tells every site without asking: system, graphics card, screen, time zone, fonts and a fingerprint that survives private mode.',
    category: 'SecurityApplication',
  },
} satisfies Record<string, Experiment>;

const WEBSITE_ID = absoluteUrl(`${HOME_ROUTE}#website`);
const PERSON_ID = absoluteUrl(`${HOME_ROUTE}#author`);

const openGraphBase = {
  type: 'website',
  siteName: SITE_NAME,
  locale: 'en_US',
} as const;

export const homeMetadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: HOME_ROUTE },
  openGraph: {
    ...openGraphBase,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: HOME_ROUTE,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const experimentMetadata = ({
  path,
  name,
  description,
}: Experiment): Metadata => ({
  title: name,
  description,
  alternates: { canonical: path },
  openGraph: { ...openGraphBase, title: name, description, url: path },
  twitter: { card: 'summary_large_image', title: name, description },
});

const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: AUTHOR.name,
  url: AUTHOR.url,
} as const;

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: pageUrl(HOME_ROUTE),
} as const;

export const homeJsonLd: Graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      ...website,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      author: { '@id': PERSON_ID },
    },
    person,
    {
      '@type': 'ItemList',
      name: 'Experiments',
      itemListElement: Object.values(EXPERIMENTS).map((experiment, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: experiment.name,
        url: pageUrl(experiment.path),
      })),
    },
  ],
};

export const experimentJsonLd = ({
  path,
  name,
  description,
  category,
}: Experiment): Graph => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name,
      description,
      url: pageUrl(path),
      image: absoluteUrl(`${path}/opengraph-image`),
      applicationCategory: category,
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      inLanguage: 'en',
      author: person,
      isPartOf: { '@id': WEBSITE_ID },
    },
    website,
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: SITE_NAME,
          item: pageUrl(HOME_ROUTE),
        },
        { '@type': 'ListItem', position: 2, name, item: pageUrl(path) },
      ],
    },
  ],
});
