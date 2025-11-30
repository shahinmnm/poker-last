import NeonPokerTable from '@/components/tables/NeonPokerTable'

const samplePlayers = [
  {
    id: 'hero',
    name: 'You',
    chips: 134000.3,
    isHero: true,
    isTurn: true,
    showCards: true,
    cards: ['Kh', 'Js'],
  },
  {
    id: 'p2',
    name: 'Aleksei',
    chips: 4000.5,
    isSB: true,
    cards: ['9c', '9s'],
  },
  {
    id: 'p3',
    name: 'Valeria',
    chips: 8,
    isBB: true,
    isFolded: false,
    cards: ['Qc', 'Jh'],
  },
  {
    id: 'p4',
    name: 'Marcus',
    chips: 22800.12,
    isFolded: true,
    cards: ['Ad', 'Td'],
  },
  {
    id: 'p5',
    name: 'Nina',
    chips: 6400.9,
    isTurn: false,
    cards: ['8s', '8d'],
  },
]

export default function NeonTableDemoPage() {
  return (
    <div className="neon-table-screen">
      <NeonPokerTable
        players={samplePlayers}
        communityCards={['Qs', '2h', 'Tc', null, null]}
        potAmount={8000.9}
      />
    </div>
  )
}
