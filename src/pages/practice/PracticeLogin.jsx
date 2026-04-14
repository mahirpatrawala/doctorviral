import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function PracticeLogin() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/practices/login', { pin_code: pin })
      sessionStorage.setItem('practice', JSON.stringify(res.data.practice))
      navigate(`/practice/dashboard/${res.data.practice.id}`)
    } catch {
      setError('Invalid PIN. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Staff Login</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your practice PIN</p>
        </div>

        <form onSubmit={login} className="card space-y-4">
          <div>
            <label className="label">Practice PIN</label>
            <input
              type="password"
              className="input text-center text-2xl tracking-widest"
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={8}
              autoFocus
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading || !pin} className="btn-primary w-full py-3">
            {loading ? 'Logging in...' : 'Enter Dashboard'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Demo: use PIN <strong>1234</strong> (run seed first)
        </p>
        <button onClick={() => navigate('/')} className="block text-center text-sm text-blue-600 mt-4 mx-auto">← Patient view</button>
      </div>
    </div>
  )
}
