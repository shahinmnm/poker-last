export interface MenuNode {
  key: string
  path: string
  icon: string
  labelKey: string
  descriptionKey?: string
  children?: MenuNodeChild[]
}

export interface MenuNodeChild {
  key: string
  path: string
  labelKey: string
  descriptionKey?: string
}

export const menuTree: MenuNode[] = [
  {
    key: 'home',
    path: '/',
    icon: '🏠',
    labelKey: 'menu.home.label',
    descriptionKey: 'menu.home.description',
  },
  {
    key: 'lobby',
    path: '/lobby',
    icon: '🎲',
    labelKey: 'menu.lobby.label',
    descriptionKey: 'menu.lobby.description',
    children: [
      {
        key: 'activeTables',
        path: '/lobby#active-tables',
        labelKey: 'menu.lobby.children.activeTables',
      },
      {
        key: 'tournaments',
        path: '/lobby#tournaments',
        labelKey: 'menu.lobby.children.tournaments',
      },
      {
        key: 'invitations',
        path: '/lobby#invitations',
        labelKey: 'menu.lobby.children.invitations',
      },
    ],
  },
  {
    key: 'createGame',
    path: '/games/create',
    icon: '🃏',
    labelKey: 'menu.createGame.label',
    descriptionKey: 'menu.createGame.description',
    children: [
      {
        key: 'privateTable',
        path: '/games/create#private',
        labelKey: 'menu.createGame.children.privateTable',
      },
      {
        key: 'publicListing',
        path: '/games/create#public',
        labelKey: 'menu.createGame.children.publicListing',
      },
      {
        key: 'tournament',
        path: '/games/create#tournament',
        labelKey: 'menu.createGame.children.tournament',
      },
    ],
  },
  {
    key: 'joinGame',
    path: '/games/join',
    icon: '➕',
    labelKey: 'menu.joinGame.label',
    descriptionKey: 'menu.joinGame.description',
    children: [
      {
        key: 'inviteCode',
        path: '/games/join#code',
        labelKey: 'menu.joinGame.children.inviteCode',
      },
      {
        key: 'qrScan',
        path: '/games/join#qr',
        labelKey: 'menu.joinGame.children.qrScan',
      },
    ],
  },
  {
    key: 'profile',
    path: '/profile',
    icon: '👤',
    labelKey: 'menu.profile.label',
    descriptionKey: 'menu.profile.description',
    children: [
      {
        key: 'overview',
        path: '/profile',
        labelKey: 'menu.profile.children.overview',
      },
      {
        key: 'stats',
        path: '/profile/stats',
        labelKey: 'menu.profile.children.stats',
      },
      {
        key: 'achievements',
        path: '/profile#achievements',
        labelKey: 'menu.profile.children.achievements',
      },
    ],
  },
  {
    key: 'wallet',
    path: '/wallet',
    icon: '💰',
    labelKey: 'menu.wallet.label',
    descriptionKey: 'menu.wallet.description',
    children: [
      {
        key: 'balance',
        path: '/wallet#balance',
        labelKey: 'menu.wallet.children.balance',
      },
      {
        key: 'history',
        path: '/wallet#history',
        labelKey: 'menu.wallet.children.history',
      },
      {
        key: 'deposit',
        path: '/wallet#deposit',
        labelKey: 'menu.wallet.children.deposit',
      },
      {
        key: 'withdraw',
        path: '/wallet#withdraw',
        labelKey: 'menu.wallet.children.withdraw',
      },
    ],
  },
  {
    key: 'settings',
    path: '/settings',
    icon: '⚙️',
    labelKey: 'menu.settings.label',
    descriptionKey: 'menu.settings.description',
    children: [
      {
        key: 'preferences',
        path: '/settings#preferences',
        labelKey: 'menu.settings.children.preferences',
      },
      {
        key: 'notifications',
        path: '/settings#notifications',
        labelKey: 'menu.settings.children.notifications',
      },
      {
        key: 'language',
        path: '/settings#language',
        labelKey: 'menu.settings.children.language',
      },
    ],
  },
  {
    key: 'help',
    path: '/help',
    icon: '❓',
    labelKey: 'menu.help.label',
    descriptionKey: 'menu.help.description',
    children: [
      {
        key: 'howToPlay',
        path: '/help#how-to-play',
        labelKey: 'menu.help.children.howToPlay',
      },
      {
        key: 'faq',
        path: '/help#faq',
        labelKey: 'menu.help.children.faq',
      },
      {
        key: 'support',
        path: '/help#support',
        labelKey: 'menu.help.children.support',
      },
    ],
  },
]
