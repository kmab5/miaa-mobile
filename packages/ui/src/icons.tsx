import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Bike,
  Check,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  House,
  Info,
  Layers,
  MapPin,
  MessageCircle,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  Wallet,
  Wifi,
  WifiOff,
  BarChart3,
  type LucideProps,
} from 'lucide-react-native';
const icons = {
  home: House,
  workspace: Layers,
  settings: Settings2,
  back: ArrowLeft,
  arrow: ArrowRight,
  chevron: ChevronRight,
  archive: Archive,
  cyclist: Bike,
  check: Check,
  list: ClipboardList,
  mother: HeartHandshake,
  info: Info,
  location: MapPin,
  support: MessageCircle,
  package: Package,
  admin: ShieldCheck,
  people: Users,
  client: UtensilsCrossed,
  money: Wallet,
  connected: Wifi,
  disconnected: WifiOff,
  reports: BarChart3,
};
export type IconName = keyof typeof icons;
export function Icon({ name, ...props }: LucideProps & { name: IconName }) {
  const Component = icons[name];
  return (
    <Component
      size={22}
      color="#000000"
      strokeWidth={1.8}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no"
      {...props}
    />
  );
}
