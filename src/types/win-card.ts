/**
 * Win Card Type Definitions
 *
 * Consolidated types for Win Card components across the application.
 * This is the single source of truth for win card theming and aspect ratios.
 */

// =============================================================================
// ASPECT RATIOS
// =============================================================================

export type AspectRatioName = 'story' | 'post' | 'square' | 'responsive';

export interface AspectRatioOption {
  name: AspectRatioName;
  width: number;
  height: number;
  ratio: string;
  label: string;
  /** CSS class for the aspect ratio (optional, for component styling) */
  cssClass?: string;
}

/**
 * Standard aspect ratios for social media export
 */
export const ASPECT_RATIOS: AspectRatioOption[] = [
  {
    name: 'story',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    label: 'Instagram Story',
    cssClass: 'aspect-[9/16]',
  },
  {
    name: 'post',
    width: 1080,
    height: 1350,
    ratio: '4:5',
    label: 'Instagram Post',
    cssClass: 'aspect-[4/5]',
  },
  {
    name: 'square',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    label: 'Square',
    cssClass: 'aspect-square',
  },
  {
    name: 'responsive',
    width: 400,
    height: 500,
    ratio: 'auto',
    label: 'Responsive',
    cssClass: '',
  },
];

// =============================================================================
// WIN CARD THEMES
// =============================================================================

export interface WinCardTheme {
  name: string;
  backgroundColor: string;
  headerBg: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  glowColor: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export type WinCardThemeName = 'gold' | 'platinum' | 'emerald' | 'ruby';

/**
 * Win card theme configurations
 *
 * Note: These use hardcoded hex colors for PNG export compatibility.
 * html-to-image may not resolve CSS variables correctly.
 */
export const WIN_CARD_THEMES: Record<WinCardThemeName, WinCardTheme> = {
  gold: {
    name: 'Gold & Black',
    backgroundColor: '#0A0A0A',
    headerBg: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
    accentColor: '#FFD700',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    borderColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.3)',
    gradientFrom: '#FFD700',
    gradientTo: '#B8860B',
  },
  platinum: {
    name: 'Platinum',
    backgroundColor: '#0F0F0F',
    headerBg: 'linear-gradient(135deg, #E5E4E2 0%, #9E9E9E 100%)',
    accentColor: '#E5E4E2',
    textPrimary: '#FFFFFF',
    textSecondary: '#808080',
    borderColor: '#E5E4E2',
    glowColor: 'rgba(229, 228, 226, 0.3)',
    gradientFrom: '#E5E4E2',
    gradientTo: '#9E9E9E',
  },
  emerald: {
    name: 'Emerald',
    backgroundColor: '#0A1F0A',
    headerBg: 'linear-gradient(135deg, #50C878 0%, #2E8B57 100%)',
    accentColor: '#50C878',
    textPrimary: '#FFFFFF',
    textSecondary: '#7CB68B',
    borderColor: '#50C878',
    glowColor: 'rgba(80, 200, 120, 0.3)',
    gradientFrom: '#50C878',
    gradientTo: '#2E8B57',
  },
  ruby: {
    name: 'Ruby',
    backgroundColor: '#1A0A0A',
    headerBg: 'linear-gradient(135deg, #E0115F 0%, #9B111E 100%)',
    accentColor: '#E0115F',
    textPrimary: '#FFFFFF',
    textSecondary: '#C08080',
    borderColor: '#E0115F',
    glowColor: 'rgba(224, 17, 95, 0.3)',
    gradientFrom: '#E0115F',
    gradientTo: '#9B111E',
  },
};

// =============================================================================
// WIN TYPES
// =============================================================================

export type WinType =
  | 'course_completed'
  | 'module_completed'
  | 'quiz_passed'
  | 'streak_milestone'
  | 'xp_milestone'
  | 'first_trade'
  | 'profit_milestone'
  | 'consistency_award'
  | 'trade'
  | 'streak'
  | 'milestone'
  | 'achievement';
