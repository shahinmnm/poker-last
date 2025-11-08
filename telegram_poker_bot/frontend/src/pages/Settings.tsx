export default function SettingsPage() {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings ⚙️</h1>
        <div className="space-y-4">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="font-semibold mb-2">Language 🌍</h2>
            <select className="w-full p-2 border rounded">
              <option>English</option>
              <option>فارسی</option>
              <option>Español</option>
            </select>
          </div>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="font-semibold mb-2">Notifications 🔔</h2>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Enable notifications
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
