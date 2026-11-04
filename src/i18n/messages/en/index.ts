import { account } from './account';
import { accounts } from './accounts';
import { auth } from './auth';
import { backup } from './backup';
import { badges } from './badges';
import { categories } from './categories';
import { charts } from './charts';
import { checkIn } from './check-in';
import { common } from './common';
import { entries } from './entries';
import { home } from './home';
import { language } from './language';
import { profile } from './profile';
import { recurring } from './recurring';
import { reveal } from './reveal';
import { setup } from './setup';
import { shell } from './shell';
import { sync } from './sync';
import { theme } from './theme';
import { tips } from './tips';

/**
 * English, the reference dictionary: every other language has exactly its keys (`Messages`), area by area. A text
 * that takes values is a function, so a translation can't drop one.
 */
export const en = {
  shell,
  language,
  theme,
  common,
  categories,
  home,
  entries,
  setup,
  profile,
  recurring,
  accounts,
  backup,
  sync,
  account,
  auth,
  checkIn,
  charts,
  badges,
  reveal,
  tips,
};

export type Messages = typeof en;
