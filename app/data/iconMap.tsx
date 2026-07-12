// Centralized icon system - Replace ALL emoji with Lucide SVG icons
// Single source of truth for all icons across the app
import {
  Dumbbell, Shirt, Film, Plane, Glasses,
  Music, Ticket, Home, BookOpen, MapPin,
  Star, CheckCircle, Clock, Users, ArrowRight,
  Sparkles, Search, Bell, MessageCircle, CreditCard,
  TrendingUp, Zap, Shield, ChevronRight, ChevronLeft,
  X, Menu, LogOut, User, Settings, HelpCircle,
  Camera, Upload, Phone, Mail, Globe, Heart,
  ShoppingBag, Coffee, Utensils, Briefcase, GraduationCap,
  Car, Train, Wallet, Gift, Percent,
  Sun, Moon, Loader, AlertCircle, Check,
  ThumbsUp, Award, Target, Activity, Flag,
  Eye, EyeOff, Edit, Trash2, Plus, Minus,
  ExternalLink, Copy, Download, RefreshCw,
  Folder, FileText, Image as ImageIcon,
  Lock, Unlock, AlertTriangle, Info,
  Send, Paperclip, Smile, Mic,
  Users2, UserPlus, UserCheck, UserX,
  List, Grid, SlidersHorizontal, Filter,
  type LucideIcon,
} from "lucide-react";

// Map semantic names to Lucide SVG icon components
// Usage: <Icon name="gym" className="w-5 h-5 text-[#D4AF37]" />
const iconMap: Record<string, LucideIcon> = {
  // === CATEGORY ICONS ===
  gym: Dumbbell,
  workout: Dumbbell,
  fashion: Shirt,
  clothing: Shirt,
  movies: Film,
  cinema: Film,
  "local-travel": Plane,
  travel: Plane,
  lenskart: Glasses,
  eyewear: Glasses,
  events: Music,
  concert: Music,
  coupons: Ticket,
  deals: Percent,
  villas: Home,
  hotel: Home,
  books: BookOpen,
  reading: BookOpen,
  food: Utensils,
  restaurants: Coffee,
  dining: Utensils,
  marketplace: ShoppingBag,
  shopping: ShoppingBag,
  education: GraduationCap,
  learning: BookOpen,
  sports: Activity,
  fitness: Dumbbell,
  beauty: Sparkles,
  electronics: Briefcase,
  music: Music,
  gaming: Target,
  pets: Heart,
  health: Heart,
  automotive: Car,
  salon: Sparkles,
  café: Coffee,

  // === NAVIGATION ICONS ===
  "arrow-right": ArrowRight,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  search: Search,
  close: X,
  menu: Menu,
  back: ChevronLeft,
  forward: ChevronRight,

  // === ACTION ICONS ===
  logout: LogOut,
  settings: Settings,
  help: HelpCircle,
  profile: User,
  user: User,
  notification: Bell,
  alerts: Bell,
  chat: MessageCircle,
  message: MessageCircle,
  messages: MessageCircle,
  payment: CreditCard,
  pay: CreditCard,
  wallet: Wallet,
  upload: Upload,
  camera: Camera,
  photo: ImageIcon,
  image: ImageIcon,
  phone: Phone,
  call: Phone,
  mail: Mail,
  email: Mail,
  globe: Globe,
  website: Globe,
  heart: Heart,
  love: Heart,
  gift: Gift,
  percent: Percent,
  discount: Percent,
  star: Star,
  favorite: Star,
  plus: Plus,
  add: Plus,
  minus: Minus,
  remove: Minus,
  edit: Edit,
  pencil: Edit,
  delete: Trash2,
  trash: Trash2,
  copy: Copy,
  download: Download,
  refresh: RefreshCw,
  reload: RefreshCw,
  external: ExternalLink,
  link: ExternalLink,
  send: Send,
  paperclip: Paperclip,
  attachment: Paperclip,
  smile: Smile,
  emoji: Smile,
  mic: Mic,
  voice: Mic,

  // === STATUS ICONS ===
  verified: CheckCircle,
  approved: CheckCircle,
  confirmed: Check,
  complete: Check,
  check: Check,
  done: Check,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  alert: AlertCircle,
  info: Info,
  expired: Clock,
  pending: Clock,
  waiting: Clock,
  clock: Clock,
  time: Clock,
  active: Zap,
  live: Activity,
  online: Activity,
  "in-progress": Activity,
  cancelled: X,
  denied: X,
  locked: Lock,
  unlock: Unlock,
  unlocked: Unlock,
  secure: Shield,
  protected: Shield,
  shield: Shield,
  target: Target,
  goal: Target,

  // === PEOPLE ICONS ===
  users: Users,
  people: Users,
  group: Users2,
  team: Users2,
  partner: UserPlus,
  "add-user": UserPlus,
  collaborator: UserCheck,
  "verified-user": UserCheck,
  "remove-user": UserX,
  follower: Users,
  avatar: User,

  // === FEATURE ICONS ===
  trending: TrendingUp,
  popular: TrendingUp,
  sparkles: Sparkles,
  feature: Sparkles,
  premium: Award,
  award: Award,
  badge: Award,
  trophy: Award,
  filter: Filter,
  filters: SlidersHorizontal,
  list: List,
  grid: Grid,
  map: MapPin,
  location: MapPin,
  pin: MapPin,
  marker: MapPin,
  folder: Folder,
  file: FileText,
  document: FileText,
  "file-report": FileText,

  // === UI ICONS ===
  "thumbs-up": ThumbsUp,
  flag: Flag,
  "report": Flag,
  "eye": Eye,
  show: Eye,
  "eye-off": EyeOff,
  hide: EyeOff,
  sun: Sun,
  light: Sun,
  moon: Moon,
  dark: Moon,
  loader: Loader,
  loading: Loader,
  spinner: Loader,
};

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  fallback?: string;
}

export default function Icon({ name, className = "w-4 h-4", size, fallback = "✦" }: IconProps) {
  // Look up the icon - try exact match, then lowercase
  const lookup = name?.toLowerCase().replace(/\s+/g, "-") || "";
  const IconComponent = iconMap[lookup] || iconMap[name];

  if (!IconComponent) {
    return <span className={className} style={{ fontSize: size ? `${size}px` : undefined }}>{fallback}</span>;
  }

  return <IconComponent className={className} size={size} />;
}

// Helper: Get icon name from category slug
export function getCategoryIconName(slug: string): string {
  const map: Record<string, string> = {
    gym: "gym",
    fashion: "fashion",
    movies: "movies",
    "local-travel": "travel",
    travel: "travel",
    lenskart: "lenskart",
    events: "events",
    coupons: "coupons",
    villas: "hotel",
    books: "books",
    food: "food",
    restaurants: "restaurants",
    marketplace: "marketplace",
    education: "education",
    sports: "sports",
    beauty: "beauty",
    electronics: "electronics",
  };
  return map[slug] || "sparkles";
}

// Helper: Get status icon name
export function getStatusIconName(status: string): string {
  const map: Record<string, string> = {
    verified: "verified",
    approved: "verified",
    expired: "expired",
    pending: "pending",
    active: "active",
    completed: "complete",
    cancelled: "cancelled",
    denied: "denied",
    waiting: "waiting",
    ready: "check",
    paid: "verified",
    success: "success",
    error: "error",
    warning: "warning",
    info: "info",
  };
  return map[status] || "help";
}

export { iconMap };
export type { LucideIcon };