import {
  HOME_ROUTE,
  THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
  FIND_NUMBER_IN_PI_ROUTE,
  EYE_CONTROL_ROUTE,
} from '@/utils/constants/routes';
import {
  Home,
  TheGameOfLifeUltimate,
  FindNumberInPi,
  EyeControl,
} from '@/pages';

export const publicRoutes = [
  {
    path: HOME_ROUTE,
    component: Home,
  },
  {
    path: THE_GAME_OF_LIFE_ULTIMATE_ROUTE,
    component: TheGameOfLifeUltimate,
  },
  {
    path: FIND_NUMBER_IN_PI_ROUTE,
    component: FindNumberInPi,
  },
  {
    path: EYE_CONTROL_ROUTE,
    component: EyeControl,
  },
];
