import { useTelegram } from '../hooks/useTelegram'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const { user, ready } = useTelegram()

  if (!ready) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">
          🎰 Poker Bot
        </h1>

        <div className="space-y-4">
          <Link
            to="/table/new?mode=anonymous"
            className="block w-full p-4 bg-blue-500 text-white rounded-lg text-center font-semibold hover:bg-blue-600 transition"
          >
            Play Anonymous ♣️
          </Link>

          <Link
            to="/table/new?mode=group"
            className="block w-full p-4 bg-green-500 text-white rounded-lg text-center font-semibold hover:bg-green-600 transition"
          >
            Play in Group ♠️
          </Link>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <Link
              to="/stats"
              className="p-4 bg-gray-200 dark:bg-gray-700 rounded-lg text-center font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              My Stats 📊
            </Link>

            <Link
              to="/settings"
              className="p-4 bg-gray-200 dark:bg-gray-700 rounded-lg text-center font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Settings ⚙️
            </Link>
          </div>

          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="font-semibold mb-2">How to Play 📘</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              1. Join a game (Anonymous or Group)<br />
              2. Wait for players to join<br />
              3. Make your decisions when it's your turn<br />
              4. Win pots by having the best hand!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
