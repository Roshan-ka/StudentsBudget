import {
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CalendarClockIcon,
  CircleDotIcon,
  CoinsIcon,
  DumbbellIcon,
  GiftIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  PartyPopperIcon,
  PillIcon,
  PlaneIcon,
  RepeatIcon,
  ShapesIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SofaIcon,
  SparklesIcon,
  TicketIcon,
  UtensilsIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';

/**
 * One icon per built-in category (redesign, chunk 4). An icon only decorates: the category's name is always written
 * next to it, so it is `aria-hidden` wherever it shows. Every category in `CATEGORIES` has one (tested).
 */
export const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  food: ShoppingCartIcon,
  'eating-out': UtensilsIcon,
  'going-out': PartyPopperIcon,
  transport: BusIcon,
  shopping: ShoppingBagIcon,
  health: PillIcon,
  'personal-care': SparklesIcon,
  study: BookOpenIcon,
  household: SofaIcon,
  travel: PlaneIcon,
  gifts: GiftIcon,
  other: ShapesIcon,
  rent: KeyRoundIcon,
  phone: SmartphoneIcon,
  insurance: ShieldCheckIcon,
  subscriptions: RepeatIcon,
  'transport-pass': TicketIcon,
  gym: DumbbellIcon,
  utilities: ZapIcon,
  'one-off': CalendarClockIcon,
  'income-job': BriefcaseIcon,
  'income-parents': HeartHandshakeIcon,
  'income-bafoeg': LandmarkIcon,
  'income-sperrkonto': LockKeyholeIcon,
  'income-scholarship': GraduationCapIcon,
  'income-other': CoinsIcon,
};

/**
 * The icon of anything that is not a built-in category. A screen looks an icon up as `CATEGORY_ICONS[id] ?? OTHER_ICON`
 * while it renders: a function that hands back a component would trip React's static-components lint rule.
 */
export const OTHER_ICON: LucideIcon = CircleDotIcon;
