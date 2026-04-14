import { useEffect, useState } from 'react'
import axios from 'axios'

export default function QRSection({ practiceId }) {
  const [qr, setQr] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    axios.get(`/api/practices/${practiceId}/qr`).then(r => setQr(r.data))
  }, [practiceId])

  const copy = () => {
    navigator.clipboard.writeText(qr.patientUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!qr) return <div className="text-center py-16 text-gray-400">Loading QR codes...</div>

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="font-semibold text-gray-900">QR Code</h2>
        <p className="text-sm text-gray-500 mt-0.5">Print and place this at your reception desk. Patients scan to join the virtual queue.</p>
      </div>

      {/* Main QR card */}
      <div className="card flex flex-col items-center py-8 gap-4">
        <img
          src={qr.qrDataUrl}
          alt="Queue QR Code"
          className="w-52 h-52 rounded-xl shadow-sm border border-gray-100"
        />
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-sm">Scan to join queue</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{qr.patientUrl}</p>
        </div>
        <button onClick={copy} className="btn-secondary text-sm px-4 py-1.5 flex items-center gap-2">
          {copied ? '✓ Copied!' : '📋 Copy link'}
        </button>
      </div>

      {/* Download options */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Download & Print</h3>
        <div className="space-y-3">

          {/* Printable sign */}
          <a
            href={qr.signUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition group"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
              🖨️
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">Printable Reception Sign</div>
              <div className="text-xs text-gray-500">Full A5 sign with instructions, QR code, and clinic name. Open → Cmd+P to print.</div>
            </div>
            <span className="text-gray-300 group-hover:text-gray-500 text-lg">→</span>
          </a>

          {/* PNG download */}
          <a
            href={qr.pngUrl}
            download={`qr-practice-${practiceId}.png`}
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition group"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
              🖼️
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">QR Code Image (PNG)</div>
              <div className="text-xs text-gray-500">600×600px image. Drop into Word, Canva, or any design tool.</div>
            </div>
            <span className="text-gray-300 group-hover:text-gray-500 text-lg">↓</span>
          </a>

        </div>
      </div>

      {/* Usage tips */}
      <div className="card bg-amber-50 border border-amber-100">
        <h3 className="font-semibold text-amber-900 mb-3">Where to place this</h3>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex gap-2"><span>🚪</span> Front entrance / main door</li>
          <li className="flex gap-2"><span>🪑</span> Reception desk counter</li>
          <li className="flex gap-2"><span>💺</span> Waiting area seats</li>
          <li className="flex gap-2"><span>🅿️</span> Parking area (patients can join before walking in)</li>
        </ul>
      </div>

    </div>
  )
}
