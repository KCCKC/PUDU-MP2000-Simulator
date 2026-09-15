/**
 * MP2000 Pallet Verifier - 3D Turning Radius & Maneuvering Envelope Visualizer
 *
 * Implements official PUDU MP2000 engineering specifications:
 * - Minimum 90° Stacking Aisle Width (Ast):
 *     • For 1200 x 1000 mm pallets: Ast <= 2,000 mm (2.0 m)
 *     • For 1200 x 800 mm pallets:  Ast <= 1,960 mm (1.96 m)
 * - Minimum Turning Radius (R_min):
 *     • Bare robot chassis (unloaded): ~1,480 mm (1.48 m)
 *     • Standard pallet loaded (1200x1000): 2,000 mm (2.00 m)
 *     • Narrow pallet loaded (1200x800):    1,960 mm (1.96 m)
 * - Recommended Turning Radius (R_rec):
 *     • Compliant with DIN EN ISO 3691-4 industrial safety standard:
 *       Adds 200 mm safety clearance buffer per side:
 *       R_rec = R_min + 200 mm (e.g. 2,200 mm / 2.20 m)
 *       Recommended Aisle: Ast_rec >= 2,400 mm (2.40 m)
 */

(function() {
  const THREE = window.THREE;

  class TurningRadiusVisualizer {
    constructor(scene, robot) {
      this.scene = scene;
      this.robot = robot;
      this.visible = true;

      this.group = new THREE.Group();
      this.group.name = 'Turning_Radius_Visualizer';
      this.scene.add(this.group);

      this.sprites = [];
      this.animTime = 0;

      // Robot steer / drive wheel pivot offset relative to robot group origin
      // Robot chassis center is near (0, 0, 0); drive axle is slightly rearward at X = -0.22m
      this.pivotOffset = new THREE.Vector3(-0.22, 0, 0);

      this.currentPallet = null;
      this.currentModel = null;
      this.currentSpecs = null;
    }

    setVisible(visible) {
      this.visible = visible;
      this.group.visible = visible;
    }

    toggle() {
      this.setVisible(!this.visible);
      return this.visible;
    }

    /**
     * Computes verified turning radius & aisle metrics based on official Pudu specifications.
     */
    static computeMetrics(palletData, puduModel) {
      const L = Number(palletData?.dimensions?.length ?? 1200);
      const W = Number(palletData?.dimensions?.width ?? 1000);

      // Official PUDU MP2000 Baseline:
      // 1200 x 1000 mm -> Ast <= 2000 mm (R_min = 2.00 m)
      // 1200 x 800 mm  -> Ast <= 1960 mm (R_min = 1.96 m)
      // Bare robot unloaded -> R_bare = 1.48 m
      let rMin;
      let astMin;

      if (L === 1200 && W === 1000) {
        rMin = 2.00;
        astMin = 2000;
      } else if (L === 1200 && W === 800) {
        rMin = 1.96;
        astMin = 1960;
      } else {
        // Geometric AMR kinematic formulation calibrated against PUDU empirical benchmarks
        // Distance from drive steer pivot to outer pallet corner:
        const pivotToFront = 1.85 + (L - 1200) / 1000;
        const halfWidth = (W / 2) / 1000;
        const rawRadius = Math.sqrt(pivotToFront * pivotToFront + halfWidth * halfWidth);
        // Calibrate so 1200x1000 = 2.00m
        rMin = Math.max(1.48, Math.round((rawRadius * 1.043) * 100) / 100);
        astMin = Math.round(rMin * 1000);
      }

      // DIN EN ISO 3691-4 industrial safety envelope: +200 mm radial buffer
      const safetyBuffer = 0.20; // 200 mm
      const rRec = Math.round((rMin + safetyBuffer) * 100) / 100;
      const astRec = Math.round(astMin + (safetyBuffer * 2 * 1000)); // +400mm aisle width

      return {
        rMinMeters: rMin,
        rRecMeters: rRec,
        astMinMm: astMin,
        astRecMm: astRec,
        rBareMeters: 1.48,
        safetyBufferMm: 200,
        palletL: L,
        palletW: W,
        modelCode: puduModel?.code || 'WPID01-M'
      };
    }

    /**
     * Creates high-resolution 2D canvas billboard sprite badge.
     */
    createBadgeSprite(lines, colorHex, bgHex = 'rgba(15, 23, 42, 0.92)') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 140;
      const ctx = canvas.getContext('2d');

      // Rounded container box
      ctx.fillStyle = bgHex;
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 5;

      const r = 16;
      const x = 5, y = 5, w = 502, h = 130;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top line (Header / Value)
      ctx.fillStyle = colorHex;
      ctx.font = 'bold 34px -apple-system, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lines[0], 256, 44);

      // Subtitle / Specs line
      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px -apple-system, sans-serif';
      ctx.fillText(lines[1] || '', 256, 82);

      // Regulatory / standard note
      if (lines[2]) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(lines[2], 256, 112);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.68, 0.185, 1);
      this.sprites.push(sprite);
      return sprite;
    }

    /**
     * Creates a circular dashed ring on the XZ ground plane.
     */
    createDashedRing(radius, colorHex, segments = 128, dashSegments = 4) {
      const points = [];
      const dTheta = (Math.PI * 2) / segments;

      for (let i = 0; i < segments; i++) {
        if (Math.floor(i / dashSegments) % 2 === 0) {
          const theta1 = i * dTheta;
          const theta2 = (i + 1) * dTheta;
          points.push(
            new THREE.Vector3(Math.cos(theta1) * radius, 0.003, Math.sin(theta1) * radius),
            new THREE.Vector3(Math.cos(theta2) * radius, 0.003, Math.sin(theta2) * radius)
          );
        }
      }

      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      return new THREE.LineSegments(geom, mat);
    }

    /**
     * Builds full 3D visual scene nodes for turning radius & aisle envelope.
     */
    update(palletData, puduModel) {
      this.currentPallet = palletData;
      this.currentModel = puduModel;
      this.group.clear();
      this.sprites = [];

      if (!palletData || !palletData.dimensions) return;

      const specs = TurningRadiusVisualizer.computeMetrics(palletData, puduModel);
      this.currentSpecs = specs;

      const rMin = specs.rMinMeters;
      const rRec = specs.rRecMeters;

      const colorAmber = 0xf59e0b;
      const colorAmberHex = '#f59e0b';
      const colorCyan = 0x06b6d4;
      const colorCyanHex = '#06b6d4';

      // 1. PIVOT CENTER BULLSEYE MARKER (Floor drive wheel pivot)
      const bullseyeGroup = new THREE.Group();
      bullseyeGroup.name = 'Pivot_Center_Marker';

      const centerDotGeom = new THREE.CircleGeometry(0.06, 32);
      const centerDotMat = new THREE.MeshBasicMaterial({
        color: colorCyan,
        depthWrite: false,
        transparent: true,
        opacity: 0.95
      });
      const centerDot = new THREE.Mesh(centerDotGeom, centerDotMat);
      centerDot.rotation.x = -Math.PI / 2;
      centerDot.position.y = 0.004;
      bullseyeGroup.add(centerDot);

      const pivotRingGeom = new THREE.RingGeometry(0.12, 0.14, 32);
      const pivotRingMat = new THREE.MeshBasicMaterial({
        color: colorCyan,
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
      });
      const pivotRing = new THREE.Mesh(pivotRingGeom, pivotRingMat);
      pivotRing.rotation.x = -Math.PI / 2;
      pivotRing.position.y = 0.004;
      bullseyeGroup.add(pivotRing);

      this.group.add(bullseyeGroup);

      // 2. MINIMUM TURNING RADIUS DISK & DASHED BOUNDARY (R_min)
      const innerDiskGeom = new THREE.RingGeometry(0.15, rMin, 64);
      const innerDiskMat = new THREE.MeshBasicMaterial({
        color: colorAmber,
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
        opacity: 0.05
      });
      const innerDisk = new THREE.Mesh(innerDiskGeom, innerDiskMat);
      innerDisk.rotation.x = -Math.PI / 2;
      innerDisk.position.y = 0.002;
      this.group.add(innerDisk);

      const rMinRing = this.createDashedRing(rMin, colorAmber, 160, 4);
      this.group.add(rMinRing);

      // 3. SAFETY BUFFER ENVELOPE RING (Between R_min and R_rec, 200mm zone)
      const bufferGeom = new THREE.RingGeometry(rMin, rRec, 64);
      const bufferMat = new THREE.MeshBasicMaterial({
        color: colorCyan,
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
        opacity: 0.09
      });
      this.bufferMesh = new THREE.Mesh(bufferGeom, bufferMat);
      this.bufferMesh.rotation.x = -Math.PI / 2;
      this.bufferMesh.position.y = 0.0025;
      this.group.add(this.bufferMesh);

      const rRecRing = this.createDashedRing(rRec, colorCyan, 160, 4);
      this.group.add(rRecRing);

      // 4. RADIAL MEASUREMENT CALIPERS & DIMENSION LABELS
      // (a) Caliper to Minimum Turning Boundary (at angle ~50 deg)
      const angMin = Math.PI * 0.28;
      const dirMin = new THREE.Vector3(Math.cos(angMin), 0, Math.sin(angMin));
      const minPointOnCirc = dirMin.clone().multiplyScalar(rMin);
      minPointOnCirc.y = 0.005;

      const caliperMinPoints = [
        new THREE.Vector3(0, 0.005, 0),
        minPointOnCirc
      ];
      const caliperMinGeom = new THREE.BufferGeometry().setFromPoints(caliperMinPoints);
      const caliperMinMat = new THREE.LineDashedMaterial({
        color: colorAmber,
        dashSize: 0.08,
        gapSize: 0.04,
        depthWrite: false,
        transparent: true,
        opacity: 0.9
      });
      const caliperMinLine = new THREE.Line(caliperMinGeom, caliperMinMat);
      caliperMinLine.computeLineDistances();
      this.group.add(caliperMinLine);

      // 3D Billboard Badge: MIN TURNING RADIUS
      const badgeMin = this.createBadgeSprite(
        [
          `MIN RADIUS: ${rMin.toFixed(2)}m`,
          `90° Stacking Aisle: Ast ≤ ${specs.astMinMm}mm`,
          `PUDU OFFICIAL SPECIFICATION`
        ],
        colorAmberHex
      );
      badgeMin.position.set(
        minPointOnCirc.x * 0.72,
        0.35,
        minPointOnCirc.z * 0.72
      );
      this.group.add(badgeMin);

      // (b) Caliper to Recommended Turning Boundary (at angle ~ -50 deg)
      const angRec = -Math.PI * 0.28;
      const dirRec = new THREE.Vector3(Math.cos(angRec), 0, Math.sin(angRec));
      const recPointOnCirc = dirRec.clone().multiplyScalar(rRec);
      recPointOnCirc.y = 0.005;

      const caliperRecPoints = [
        new THREE.Vector3(0, 0.005, 0),
        recPointOnCirc
      ];
      const caliperRecGeom = new THREE.BufferGeometry().setFromPoints(caliperRecPoints);
      const caliperRecMat = new THREE.LineDashedMaterial({
        color: colorCyan,
        dashSize: 0.08,
        gapSize: 0.04,
        depthWrite: false,
        transparent: true,
        opacity: 0.9
      });
      const caliperRecLine = new THREE.Line(caliperRecGeom, caliperRecMat);
      caliperRecLine.computeLineDistances();
      this.group.add(caliperRecLine);

      // 3D Billboard Badge: RECOMMENDED TURNING RADIUS
      const badgeRec = this.createBadgeSprite(
        [
          `RECOMMENDED: ${rRec.toFixed(2)}m`,
          `Safe Operating Aisle: ≥ ${specs.astRecMm}mm`,
          `ISO 3691-4 (+200mm Safety Margin)`
        ],
        colorCyanHex
      );
      badgeRec.position.set(
        recPointOnCirc.x * 0.78,
        0.35,
        recPointOnCirc.z * 0.78
      );
      this.group.add(badgeRec);

      // 5. WAREHOUSE AISLE CORRIDOR GUIDE LINES
      const halfAst = specs.astMinMm / 2000;
      const halfAstRec = specs.astRecMm / 2000;
      const aisleLength = Math.max(rRec * 2.2, 4.8);

      const aislePoints = [
        new THREE.Vector3(-aisleLength / 2, 0.003, halfAst),
        new THREE.Vector3(aisleLength / 2, 0.003, halfAst),
        new THREE.Vector3(-aisleLength / 2, 0.003, -halfAst),
        new THREE.Vector3(aisleLength / 2, 0.003, -halfAst),

        new THREE.Vector3(-aisleLength / 2, 0.003, halfAstRec),
        new THREE.Vector3(aisleLength / 2, 0.003, halfAstRec),
        new THREE.Vector3(-aisleLength / 2, 0.003, -halfAstRec),
        new THREE.Vector3(aisleLength / 2, 0.003, -halfAstRec)
      ];

      const aisleGeom = new THREE.BufferGeometry().setFromPoints(aislePoints);
      const aisleMat = new THREE.LineBasicMaterial({
        color: 0x334155,
        linewidth: 1,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      const aisleLines = new THREE.LineSegments(aisleGeom, aisleMat);
      this.group.add(aisleLines);

      this.syncPosition();
    }

    syncPosition() {
      if (!this.robot || !this.robot.group) return;
      const robotPos = this.robot.group.position;
      this.group.position.set(
        robotPos.x + this.pivotOffset.x,
        0,
        robotPos.z + this.pivotOffset.z
      );
    }

    tick(deltaSeconds) {
      if (!this.visible) return;
      this.syncPosition();
      this.animTime += deltaSeconds;
      if (this.bufferMesh && this.bufferMesh.material) {
        const pulse = 0.095 + 0.025 * Math.sin(this.animTime * 2.5);
        this.bufferMesh.material.opacity = pulse;
      }
    }
  }

  window.TurningRadiusVisualizer = TurningRadiusVisualizer;
})();
