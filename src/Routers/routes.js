import {
  HOME_ROUTE,
  THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
} from '@/utils/constants/routes';
import { Home, TheGameOfLifeUltimate } from '@/pages';

export const publicRoutes = [
  {
    path: HOME_ROUTE,
    component: Home,
  },
  {
    path: THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
    component: TheGameOfLifeUltimate,
  },
];
