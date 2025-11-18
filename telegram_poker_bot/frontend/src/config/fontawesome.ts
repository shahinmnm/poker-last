/**
 * Font Awesome Icon Library Configuration
 * 
 * This file sets up a centralized icon library for the poker mini-app.
 * Icons are imported from Font Awesome and registered for use throughout the app.
 * 
 * Icon Categories:
 * - Header: Navigation, user actions, notifications
 * - Footer: Main navigation tabs
 * - Profile: User stats, account settings, social features
 * - Game: Poker-related actions and states
 */

import { library } from '@fortawesome/fontawesome-svg-core'

// Solid icons (most common style for primary UI elements)
import {
  faHouse,              // Home
  faDice,               // Lobby/Games
  faTableCellsLarge,    // Tables list
  faCirclePlus,         // Create/Add
  faRightToBracket,     // Join/Enter
  faUser,               // Profile/Account
  faUserCircle,         // Avatar alternative
  faUserGear,           // Profile settings
  faWallet,             // Wallet/Balance
  faCoins,              // Chips/Currency
  faChartLine,          // Stats/Analytics
  faArrowTrendUp,       // Wins/Gains
  faArrowTrendDown,     // Losses
  faTrophy,             // Achievements/Wins
  faRankingStar,        // Ranking/Leaderboard
  faCrown,              // Premium/VIP
  faGear,               // Settings
  faBell,               // Notifications
  faCircleQuestion,     // Help/Info
  faLanguage,           // Language selector
  faMoon,               // Dark mode
  faSun,                // Light mode
  faLock,               // Private/Security
  faShieldHalved,       // Security/Protected
  faSliders,            // Preferences/Controls
  faShareNodes,         // Share/Invite
  faUserGroup,          // Friends/Social
  faPlay,               // Play/Resume
  faPause,              // Pause
  faCircleDollarToSlot, // Betting/Gambling
  faHandHoldingDollar,  // Money/Payment
  faClockRotateLeft,    // History/Past games
  faEllipsisVertical,   // More options/Menu
  faXmark,              // Close/Cancel
  faArrowLeft,          // Back
  faCheck,              // Confirm/Success
  faCircle,             // Status indicator
  faStar,               // Favorite/Featured
  faFire,               // Hot/Trending
  faBolt,               // Fast/Quick
  faSpinner,            // Loading
} from '@fortawesome/free-solid-svg-icons'

// Regular icons (outlined style for secondary elements)
import {
  faCircle as faCircleRegular,
  faStar as faStarRegular,
  faUser as faUserRegular,
  faBell as faBellRegular,
} from '@fortawesome/free-regular-svg-icons'

// Brand icons (for social/platform integrations)
import {
  faTelegram,
} from '@fortawesome/free-brands-svg-icons'

// Register all icons in the library
library.add(
  // Solid icons
  faHouse,
  faDice,
  faTableCellsLarge,
  faCirclePlus,
  faRightToBracket,
  faUser,
  faUserCircle,
  faUserGear,
  faWallet,
  faCoins,
  faChartLine,
  faArrowTrendUp,
  faArrowTrendDown,
  faTrophy,
  faRankingStar,
  faCrown,
  faGear,
  faBell,
  faCircleQuestion,
  faLanguage,
  faMoon,
  faSun,
  faLock,
  faShieldHalved,
  faSliders,
  faShareNodes,
  faUserGroup,
  faPlay,
  faPause,
  faCircleDollarToSlot,
  faHandHoldingDollar,
  faClockRotateLeft,
  faEllipsisVertical,
  faXmark,
  faArrowLeft,
  faCheck,
  faCircle,
  faStar,
  faFire,
  faBolt,
  faSpinner,
  // Regular icons
  faCircleRegular,
  faStarRegular,
  faUserRegular,
  faBellRegular,
  // Brand icons
  faTelegram,
)

/**
 * Export icon references for use in components
 * This allows for type-safe icon usage throughout the app
 */
export const icons = {
  // Navigation
  home: faHouse,
  lobby: faDice,
  tables: faTableCellsLarge,
  create: faCirclePlus,
  join: faRightToBracket,
  profile: faUser,
  wallet: faWallet,
  settings: faGear,
  help: faCircleQuestion,
  
  // User & Account
  user: faUser,
  userCircle: faUserCircle,
  userGear: faUserGear,
  userGroup: faUserGroup,
  
  // Game & Stats
  play: faPlay,
  pause: faPause,
  coins: faCoins,
  chips: faCircleDollarToSlot,
  chart: faChartLine,
  trendUp: faArrowTrendUp,
  trendDown: faArrowTrendDown,
  trophy: faTrophy,
  ranking: faRankingStar,
  crown: faCrown,
  history: faClockRotateLeft,
  
  // Actions & Controls
  bell: faBell,
  bellRegular: faBellRegular,
  language: faLanguage,
  moon: faMoon,
  sun: faSun,
  lock: faLock,
  shield: faShieldHalved,
  sliders: faSliders,
  share: faShareNodes,
  
  // UI Elements
  close: faXmark,
  back: faArrowLeft,
  check: faCheck,
  circle: faCircle,
  circleRegular: faCircleRegular,
  star: faStar,
  starRegular: faStarRegular,
  fire: faFire,
  bolt: faBolt,
  more: faEllipsisVertical,
  spinner: faSpinner,
  
  // Brands
  telegram: faTelegram,
} as const

export default icons
