/**
 * MP2000 Pallet Verifier - 4K Verification Snapshot Exporter
 * Captures high-res canvas view and overlays an engineering certification banner.
 */

window.VerificationExporter = class VerificationExporter {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  exportSnapshot(palletData, puduModel, evalResult) {
    // 1. Force a clean render
    this.renderer.render(this.scene, this.camera);

    // 2. Capture WebGL canvas
    const webglCanvas = this.renderer.domElement;
    const w = webglCanvas.width;
    const h = webglCanvas.height;

    // 3. Create 2D compositing canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext('2d');

    // Draw 3D scene
    ctx.drawImage(webglCanvas, 0, 0);

    // Overlay Top Gradient Banner
    const topGrad = ctx.createLinearGradient(0, 0, 0, 110);
    topGrad.addColorStop(0, 'rgba(11, 15, 25, 0.95)');
    topGrad.addColorStop(1, 'rgba(11, 15, 25, 0.0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, 110);

    // Brand Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.fillText('🤖 PUDU MP2000 PALLET VERIFIER', 32, 42);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px -apple-system, sans-serif';
    const palletTitle = `${palletData.flag || '📦'} ${palletData.name} (${palletData.dimensions.length}x${palletData.dimensions.width}x${palletData.dimensions.height}mm)`;
    ctx.fillText(palletTitle, 32, 68);

    // Overlay Bottom Result Card
    const cardH = 90;
    const cardY = h - cardH - 24;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = evalResult.isCompatible ? '#10b981' : '#ef4444';
    ctx.lineWidth = 3;

    // Rounded rectangle card
    const cardW = Math.min(w - 64, 700);
    const cardX = 32;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // Verdict Badge
    const badgeColor = evalResult.isCompatible ? '#10b981' : '#ef4444';
    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText(`VERDICT: ${evalResult.verdict.badge}`, cardX + 24, cardY + 36);

    // Details Text
    ctx.fillStyle = '#f8fafc';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText(evalResult.verdict.explanation, cardX + 24, cardY + 62);

    // Watermark Date
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    const timeString = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
    ctx.textAlign = 'right';
    ctx.fillText(`Verified via PUDU AMR Engineering Engine | ${timeString}`, w - 32, h - 20);

    // 4. Download Image
    const link = document.createElement('a');
    const safeName = palletData.name.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `MP2000_Verification_${safeName}_${puduModel.code}.png`;
    link.href = outCanvas.toDataURL('image/png');
    link.click();
  }
};
