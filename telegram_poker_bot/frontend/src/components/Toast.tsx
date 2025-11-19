interface ToastProps {
  message: string
  visible: boolean
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <div
      className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all duration-200 dark:bg-[#2B2B2B] dark:text-gray-100 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      {message}
    </div>
  )
}
