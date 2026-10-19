import { Courier_Prime } from 'next/font/google';
import { fontFamily } from './family';

// The line-printer face of Find Your Number in Pi, shared by the page and its
// preview card. Turbopack preloads every next/font face on every route, so
// this one skips the preload and loads with the pages that use it.
const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  preload: false,
});

export const PRINTOUT_FONT = `${fontFamily(courierPrime)}, 'Courier New', ui-monospace, monospace`;
