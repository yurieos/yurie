// ============================================
// Centralized Icon Exports
// Standardizes on lucide-react for consistency
// ============================================

// Re-export all icons from single source for consistency
export {
  // Navigation
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  CornerRightUp,
  
  // Actions
  Plus,
  Trash2,
  Settings,
  LogOut,
  X,
  Menu,
  ExternalLink,
  Copy,
  
  // Status
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  
  // Content
  FileText,
  MessageCircle,
  Clock,
  
  // Search/Providers
  Search,
  Zap,
  FlaskConical,
  Flame,
  Globe,
  
  // Misc
  User,
  Image,
  Link,
  BookOpen,
} from 'lucide-react';

// ============================================
// Icon Size Classes (matching globals.css tokens)
// ============================================
export const ICON_SIZE = {
  '2xs': 'w-2.5 h-2.5',  // 10px
  'xs': 'w-3 h-3',       // 12px
  'sm': 'w-4 h-4',       // 16px
  'md': 'w-5 h-5',       // 20px
  'lg': 'w-6 h-6',       // 24px
} as const;

export type IconSize = keyof typeof ICON_SIZE;

// ============================================
// Icon Mapping: Phosphor -> Lucide equivalents
// For reference when migrating from @phosphor-icons/react
// ============================================
// CaretRight -> ChevronRight
// CaretDown -> ChevronDown
// ChatTeardropText -> MessageCircle
// ClockCounterClockwise -> Clock
// Plus -> Plus
// Trash -> Trash2
// SignOut -> LogOut
// Gear -> Settings
// X -> X
// MagnifyingGlass -> Search

