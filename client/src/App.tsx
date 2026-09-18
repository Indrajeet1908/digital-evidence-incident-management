import { useEffect, useState } from 'react'

/**
 * Simple landing page to confirm the frontend is running.
 * This will be replaced with a proper layout and routing in later milestones.
 */
function App() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...')

  useEffect(() => {
    // Test the API proxy by calling the backend health endpoint
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data.status))
      .catch(() => setHealthStatus('unreachable'))
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        {/* Shield icon */}
        <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          Digital Evidence Platform
        </h1>
        <p className="text-slate-400 mb-8">
          AI-Assisted Digital Evidence & Incident Management
        </p>

        {/* API Status indicator */}
        <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
          <span
            className={`w-2 h-2 rounded-full ${
              healthStatus === 'ok'
                ? 'bg-green-500'
                : healthStatus === 'checking...'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-slate-300 text-sm">
            API Status:{' '}
            <span
              className={
                healthStatus === 'ok' ? 'text-green-400' : 'text-yellow-400'
              }
            >
              {healthStatus}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
