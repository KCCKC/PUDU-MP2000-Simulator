/**
 * MP2000 Pallet Verifier - Interactive 3D CAD Measurement Caliper Overlay
 * Renders floating dimension lines, tick brackets, and measurement callouts in 3D.
 */

window.CadDimensions = class CadDimensions {
  constructor(scene) {
    this.scene = scene;
    this.THREE = window.THREE;
    this.group = new this.THREE.Group();
    this.group.name = 'CAD_Dimensions_Overlay';
    this.scene.add(this.group);

    this.visible = true;
    this.sprites = [];
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }

  toggle() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  createTextSprite(text, colorHex, bgColorHex = '#0f172a') {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Rounded background box
    ctx.fillStyle = bgColorHex;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    this.roundRect(ctx, 4, 4, 376, 88, 16);
    ctx.fill();
    ctx.stroke();

    // Text label
    ctx.fillStyle = colorHex;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 192, 48);

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.minFilter = this.THREE.LinearFilter;
    const spriteMat = new this.THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true
    });
    const sprite = new this.THREE.Sprite(spriteMat);
    sprite.scale.set(0.38, 0.095, 1);
    this.sprites.push(sprite);
    return sprite;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  createCaliperLine(startVec, endVec, colorHex, tickLen = 0.04, isVertical = false) {
    const THREE = this.THREE;
    const points = [];

    // Main span line
    points.push(startVec, endVec);

    // End ticks
    if (!isVertical) {
      points.push(
        new THREE.Vector3(startVec.x, startVec.y - tickLen / 2, startVec.z),
        new THREE.Vector3(startVec.x, startVec.y + tickLen / 2, startVec.z),
        new THREE.Vector3(endVec.x, endVec.y - tickLen / 2, endVec.z),
        new THREE.Vector3(endVec.x, endVec.y + tickLen / 2, endVec.z)
      );
    } else {
      points.push(
        new THREE.Vector3(startVec.x, startVec.y, startVec.z - tickLen / 2),
        new THREE.Vector3(startVec.x, startVec.y, startVec.z + tickLen / 2),
        new THREE.Vector3(endVec.x, endVec.y, endVec.z - tickLen / 2),
        new THREE.Vector3(endVec.x, endVec.y, endVec.z + tickLen / 2)
      );
    }

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.85
    });

    return new THREE.LineSegments(geom, mat);
  }

  update(palletData, puduModel, evalResult) {
    const THREE = this.THREE;
    this.group.clear();
    this.sprites = [];

    if (!palletData || !palletData.dimensions) return;

    const L = (palletData.dimensions.length || 1200) / 1000;
    const H = (palletData.dimensions.height || 162) / 1000;
    const palletFrontX = -L / 2;

    const W1 = (palletData.openings.W1 || 760) / 1000;
    const W2 = (palletData.openings.W2 || 145) / 1000;
    const Ch = (palletData.openings.Ch || 100) / 1000;
    const B1 = (puduModel.B1 || 620) / 1000;

    const passOuter = evalResult ? evalResult.metrics.outer.pass : true;
    const passInner = evalResult ? evalResult.metrics.inner.pass : true;
    const passHeight = evalResult ? evalResult.metrics.height.pass : true;

    const colorGreen = '#10b981';
    const colorRed = '#ef4444';
    const colorCyan = '#38bdf8';

    // 1. DIMENSION W1 (Outer Pallet Opening)
    const w1Y = H + 0.09;
    const w1Color = passOuter ? colorGreen : colorRed;
    const w1Line = this.createCaliperLine(
      new THREE.Vector3(palletFrontX, w1Y, -W1 / 2),
      new THREE.Vector3(palletFrontX, w1Y, W1 / 2),
      passOuter ? 0x10b981 : 0xef4444
    );
    this.group.add(w1Line);

    const w1Label = this.createTextSprite(`W₁: ${(W1 * 1000).toFixed(0)}mm ${passOuter ? '[OK]' : '[WARN]'}`, w1Color);
    w1Label.position.set(palletFrontX, w1Y + 0.05, 0);
    this.group.add(w1Label);

    // 2. DIMENSION W2 (Center Block Width)
    const w2Y = H + 0.02;
    const w2Color = passInner ? colorGreen : colorRed;
    const w2Line = this.createCaliperLine(
      new THREE.Vector3(palletFrontX, w2Y, -W2 / 2),
      new THREE.Vector3(palletFrontX, w2Y, W2 / 2),
      passInner ? 0x10b981 : 0xef4444
    );
    this.group.add(w2Line);

    const w2Label = this.createTextSprite(`W₂: ${(W2 * 1000).toFixed(0)}mm ${passInner ? '[OK]' : '[WARN]'}`, w2Color);
    w2Label.position.set(palletFrontX, w2Y + 0.05, 0);
    this.group.add(w2Label);

    // 3. DIMENSION Ch (Vertical Pocket Height)
    const chZ = W1 / 2 - 0.08;
    const chColor = passHeight ? colorGreen : colorRed;
    const chLine = this.createCaliperLine(
      new THREE.Vector3(palletFrontX, 0, chZ),
      new THREE.Vector3(palletFrontX, Ch, chZ),
      passHeight ? 0x10b981 : 0xef4444,
      0.03,
      true
    );
    this.group.add(chLine);

    const chLabel = this.createTextSprite(`Cₕ: ${(Ch * 1000).toFixed(0)}mm`, chColor);
    chLabel.position.set(palletFrontX, Ch / 2, chZ + 0.12);
    this.group.add(chLabel);

    // 4. DIMENSION B1 (Robot Outer Fork Spread)
    const b1Y = 0.15;
    const b1Line = this.createCaliperLine(
      new THREE.Vector3(palletFrontX - 0.25, b1Y, -B1 / 2),
      new THREE.Vector3(palletFrontX - 0.25, b1Y, B1 / 2),
      0x38bdf8
    );
    this.group.add(b1Line);

    const b1Label = this.createTextSprite(`B₁: ${(B1 * 1000).toFixed(0)}mm [${puduModel.code === 'WPID01-M' ? 'Std' : 'Narrow'}]`, colorCyan);
    b1Label.position.set(palletFrontX - 0.25, b1Y + 0.05, 0);
    this.group.add(b1Label);
  }
};
