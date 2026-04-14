const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'printable-qr');

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateForPractice(practice) {
  ensureDir();

  const url = `http://localhost:5173/patient/${practice.id}`;

  // Save standalone PNG (just the QR code)
  const pngPath = path.join(OUTPUT_DIR, `qr-${practice.id}.png`);
  await QRCode.toFile(pngPath, url, {
    width: 600,
    margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  // Save printable HTML sign
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Queue Sign — ${practice.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { width: 148mm; padding: 16mm 12mm; border: 2px solid #e5e7eb; border-radius: 16px; text-align: center; page-break-inside: avoid; }
    .header-icon { font-size: 40px; margin-bottom: 8px; }
    .clinic-name { font-size: 22px; font-weight: 900; color: #1e3a5f; margin-bottom: 4px; }
    .tagline { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
    .instruction-box { background: #eff6ff; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
    .instruction-box h2 { font-size: 17px; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; }
    .steps { list-style: none; text-align: left; }
    .steps li { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #374151; margin-bottom: 8px; line-height: 1.4; }
    .step-num { background: #1e3a5f; color: white; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .qr-wrapper { background: #f9fafb; border-radius: 12px; padding: 16px; display: inline-block; margin-bottom: 16px; }
    .qr-wrapper img { width: 180px; height: 180px; display: block; }
    .scan-label { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; }
    .url { font-size: 11px; color: #9ca3af; word-break: break-all; margin-bottom: 20px; }
    .benefit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    .benefit { background: #f9fafb; border-radius: 8px; padding: 8px; font-size: 12px; color: #374151; }
    .benefit .icon { font-size: 18px; display: block; margin-bottom: 3px; }
    .footer { font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; }
    @media print { body { min-height: unset; } .card { border: 1.5px solid #d1d5db; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header-icon">🏥</div>
    <div class="clinic-name">${practice.name}</div>
    <div class="tagline">${practice.address || 'Virtual Queue System'}</div>
    <div class="instruction-box">
      <h2>Skip the waiting room!</h2>
      <ul class="steps">
        <li><span class="step-num">1</span><span>Scan the QR code with your phone camera</span></li>
        <li><span class="step-num">2</span><span>Enter your name and reason for visit</span></li>
        <li><span class="step-num">3</span><span>Go home or wait nearby — we'll notify you when it's your turn</span></li>
        <li><span class="step-num">4</span><span>Come to reception only when called</span></li>
      </ul>
    </div>
    <div class="scan-label">Scan to join the queue</div>
    <div class="qr-wrapper"><img src="${qrDataUrl}" alt="QR Code" /></div>
    <div class="url">${url}</div>
    <div class="benefit-grid">
      <div class="benefit"><span class="icon">🏠</span>Wait from anywhere</div>
      <div class="benefit"><span class="icon">⏱️</span>Live wait updates</div>
      <div class="benefit"><span class="icon">📱</span>No app to install</div>
      <div class="benefit"><span class="icon">🔔</span>Get notified</div>
    </div>
    <div class="footer">Powered by Waitwell &nbsp;·&nbsp; ${practice.phone || ''}</div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(OUTPUT_DIR, `queue-sign-${practice.id}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`[QR] Generated for "${practice.name}" → ${OUTPUT_DIR}`);
  return { pngPath, htmlPath };
}

module.exports = { generateForPractice };
