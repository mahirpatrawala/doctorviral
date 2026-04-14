import QRCode from 'qrcode'
import supabase from './supabase.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const BUCKET = 'qr-codes'

export async function generateForPractice(practice) {
  const url = `${FRONTEND_URL}/patient/${practice.id}`

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400, margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  // PNG buffer
  const pngBuffer = await QRCode.toBuffer(url, {
    width: 600, margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  const html = buildSignHtml(practice, qrDataUrl, url)

  // Upload to Supabase Storage
  await supabase.storage.from(BUCKET).upload(
    `qr-${practice.id}.png`, pngBuffer,
    { contentType: 'image/png', upsert: true }
  )
  await supabase.storage.from(BUCKET).upload(
    `queue-sign-${practice.id}.html`, Buffer.from(html),
    { contentType: 'text/html', upsert: true }
  )

  const { data: pngData } = supabase.storage.from(BUCKET).getPublicUrl(`qr-${practice.id}.png`)
  const { data: signData } = supabase.storage.from(BUCKET).getPublicUrl(`queue-sign-${practice.id}.html`)

  console.log(`[QR] Generated for "${practice.name}"`)
  return { pngUrl: pngData.publicUrl, signUrl: signData.publicUrl, qrDataUrl }
}

function buildSignHtml(practice, qrDataUrl, url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Queue Sign — ${practice.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{width:148mm;padding:16mm 12mm;border:2px solid #e5e7eb;border-radius:16px;text-align:center}
    .icon{font-size:40px;margin-bottom:8px}
    .name{font-size:22px;font-weight:900;color:#1e3a5f;margin-bottom:4px}
    .tag{font-size:13px;color:#6b7280;margin-bottom:20px}
    .box{background:#eff6ff;border-radius:10px;padding:14px 16px;margin-bottom:20px}
    .box h2{font-size:17px;font-weight:700;color:#1e3a5f;margin-bottom:10px}
    .steps{list-style:none;text-align:left}
    .steps li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#374151;margin-bottom:8px;line-height:1.4}
    .num{background:#1e3a5f;color:#fff;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .qr{background:#f9fafb;border-radius:12px;padding:16px;display:inline-block;margin-bottom:16px}
    .qr img{width:180px;height:180px;display:block}
    .scan{font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:4px}
    .url{font-size:11px;color:#9ca3af;word-break:break-all;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
    .benefit{background:#f9fafb;border-radius:8px;padding:8px;font-size:12px;color:#374151}
    .benefit .i{font-size:18px;display:block;margin-bottom:3px}
    .footer{font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px}
    @media print{body{min-height:unset}.card{border:1.5px solid #d1d5db}}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🏥</div>
    <div class="name">${practice.name}</div>
    <div class="tag">${practice.address || 'Virtual Queue System'}</div>
    <div class="box">
      <h2>Skip the waiting room!</h2>
      <ul class="steps">
        <li><span class="num">1</span><span>Scan the QR code with your phone camera</span></li>
        <li><span class="num">2</span><span>Enter your name and reason for visit</span></li>
        <li><span class="num">3</span><span>Go home or wait nearby — we'll notify you when it's your turn</span></li>
        <li><span class="num">4</span><span>Come to reception only when called</span></li>
      </ul>
    </div>
    <div class="scan">Scan to join the queue</div>
    <div class="qr"><img src="${qrDataUrl}" alt="QR"/></div>
    <div class="url">${url}</div>
    <div class="grid">
      <div class="benefit"><span class="i">🏠</span>Wait from anywhere</div>
      <div class="benefit"><span class="i">⏱️</span>Live wait updates</div>
      <div class="benefit"><span class="i">📱</span>No app to install</div>
      <div class="benefit"><span class="i">🔔</span>Get notified</div>
    </div>
    <div class="footer">Powered by Waitwell &nbsp;·&nbsp; ${practice.phone || ''}</div>
  </div>
</body>
</html>`
}
