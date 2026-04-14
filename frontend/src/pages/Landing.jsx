import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Landing() {
  const [practices, setPractices] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    axios.get('/api/practices').then(r => setPractices(r.data))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🏥</div>
          <h1 className="text-4xl font-bold text-gray-900">Waitwell</h1>
          <p className="text-gray-500 mt-2 text-lg">Smart queue & appointment management for healthcare practices</p>
        </div>

        {/* Practice selection */}
        {practices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Select your practice</h2>
            <div className="space-y-3">
              {practices.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/patient/${p.id}`)}
                  className="w-full card hover:shadow-md transition cursor-pointer text-left flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0">
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.address}</div>
                  </div>
                  <div className="ml-auto text-gray-300">→</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center"><span className="bg-gradient-to-br from-blue-50 to-indigo-100 px-3 text-sm text-gray-400">or</span></div>
        </div>

        {/* Practice login */}
        <button
          onClick={() => navigate('/practice')}
          className="w-full btn-secondary py-3 flex items-center justify-center gap-2"
        >
          <span>🔒</span> Practice Staff Login
        </button>

        <p className="text-center text-xs text-gray-400 mt-8">
          Waitwell — Reducing wait frustration, one queue at a time
        </p>
      </div>
    </div>
  )
}
