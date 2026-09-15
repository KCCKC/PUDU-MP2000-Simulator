/**
 * MP2000 Pallet Verifier - 3D Procedural Pathway Corridor Model
 *
 * Generates an interactive 3D warehouse aisle with:
 * - High-contrast industrial floor boundary markings & hazard stripes
 * - Directional navigation centerline
 * - Semi-transparent acrylic & steel guardrail boundary walls
 * - Dynamic 3D caliper arrows displaying exact aisle width & lateral margins
 * - Smooth kinematic trajectory generator for 5-second dynamic simulations
 */

(function() {
  const THREE = window.THREE;

  class PathwayModel {
    constructor(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      this.group.name = 'PUDU_MP2000_Pathway_Root';
      this.scene.add(this.group);

      this.lengthMeters = 8.0;
      this.widthMeters = 2.2;
      this.maneuverType = 'straight';
      this.isFeasible = true;
      this.visible = false;
      this.group.visible = false;

      this.wallMeshes = [];
      this.stripeMeshes = [];
      this.caliperGroup = new THREE.Group();
      this.group.add(this.caliperGroup);

      this.rebuild(this.lengthMeters, this.widthMeters * 1000, this.maneuverType, true);
    }

    setVisible(visible) {
      this.visible = visible;
      this.group.visible = visible;
    }

    rebuild(lengthMeters, widthMm, maneuverType = 'straight', isFeasible = true) {
      this.lengthMeters = Math.max(3.0, Math.min(25.0, Number(lengthMeters || 8.0)));
      this.widthMeters = Math.max(1.0, Math.min(5.0, Number(widthMm || 2200) / 1000));
      this.maneuverType = maneuverType || 'straight';
      this.isFeasible = isFeasible;

      // Clear existing geometry
      while (this.group.children.length > 0) {
        const obj = this.group.children[0];
        this.group.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      }

      this.wallMeshes = [];
      this.stripeMeshes = [];
      this.caliperGroup = new THREE.Group();
      this.group.add(this.caliperGroup);

      if (this.maneuverType === 'straight') {
        this.buildStraightPathway();
      } else if (this.maneuverType === 'turn90') {
        this.build90DegreeTurnPathway();
      } else if (this.maneuverType === 'turn180') {
        this.build180DegreeTurnPathway();
      }

      this.buildCaliperOverlays();
      this.setCollisionHighlight(!this.isFeasible);
    }

    buildStraightPathway() {
      const L = this.lengthMeters;
      const W = this.widthMeters;
      const halfW = W / 2;
      const halfL = L / 2;

      // 1. Aisle Floor Slab
      const floorGeom = new THREE.PlaneGeometry(L, W);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x131d2e,
        roughness: 0.7,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, 0.001, 0);
      floorMesh.receiveShadow = true;
      this.group.add(floorMesh);

      // 2. Dashed Centerline (Navigation Track)
      const centerLineGeom = new THREE.BufferGeometry();
      const points = [];
      const dashSegments = Math.floor(L * 1.5);
      const segLen = L / dashSegments;
      for (let i = 0; i < dashSegments; i++) {
        if (i % 2 === 0) {
          const x1 = -halfL + (i * segLen);
          const x2 = -halfL + ((i + 0.6) * segLen);
          points.push(new THREE.Vector3(x1, 0.004, 0));
          points.push(new THREE.Vector3(x2, 0.004, 0));
        }
      }
      centerLineGeom.setFromPoints(points);
      const centerLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
      const centerLine = new THREE.LineSegments(centerLineGeom, centerLineMat);
      this.group.add(centerLine);

      // 3. Boundary Hazard Stripes (Yellow / Black Edges)
      const stripeW = 0.08;
      const stripeGeom = new THREE.PlaneGeometry(L, stripeW);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

      const leftStripe = new THREE.Mesh(stripeGeom, stripeMat);
      leftStripe.rotation.x = -Math.PI / 2;
      leftStripe.position.set(0, 0.003, halfW - (stripeW / 2));
      this.group.add(leftStripe);

      const rightStripe = new THREE.Mesh(stripeGeom, stripeMat);
      rightStripe.rotation.x = -Math.PI / 2;
      rightStripe.position.set(0, 0.003, -halfW + (stripeW / 2));
      this.group.add(rightStripe);

      // 4. Start & End Gate Lines
      const gateGeom = new THREE.PlaneGeometry(0.12, W);
      const startGateMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const endGateMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

      const startGate = new THREE.Mesh(gateGeom, startGateMat);
      startGate.rotation.x = -Math.PI / 2;
      startGate.position.set(-halfL + 0.6, 0.004, 0);
      this.group.add(startGate);

      const endGate = new THREE.Mesh(gateGeom, endGateMat);
      endGate.rotation.x = -Math.PI / 2;
      endGate.position.set(halfL - 0.6, 0.004, 0);
      this.group.add(endGate);

      // 5. Guardrail Boundary Walls (Left & Right)
      const wallH = 0.55;
      const wallGeom = new THREE.BoxGeometry(L, wallH, 0.04);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.8
      });

      const topRailGeom = new THREE.CylinderGeometry(0.02, 0.02, L, 16);
      const topRailMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 });

      // Left Wall (+Z)
      const leftWall = new THREE.Mesh(wallGeom, wallMat.clone());
      leftWall.position.set(0, wallH / 2, halfW);
      this.group.add(leftWall);
      this.wallMeshes.push(leftWall);

      const leftRail = new THREE.Mesh(topRailGeom, topRailMat);
      leftRail.rotation.z = Math.PI / 2;
      leftRail.position.set(0, wallH, halfW);
      this.group.add(leftRail);

      // Right Wall (-Z)
      const rightWall = new THREE.Mesh(wallGeom, wallMat.clone());
      rightWall.position.set(0, wallH / 2, -halfW);
      this.group.add(rightWall);
      this.wallMeshes.push(rightWall);

      const rightRail = new THREE.Mesh(topRailGeom, topRailMat);
      rightRail.rotation.z = Math.PI / 2;
      rightRail.position.set(0, wallH, -halfW);
      this.group.add(rightRail);
    }

    build90DegreeTurnPathway() {
      const W = this.widthMeters;
      const L_arm = Math.max(3.5, this.lengthMeters / 2);
      const halfW = W / 2;
      const wallH = 0.55;

      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x131d2e,
        roughness: 0.7,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });

      // Entry Arm (along X axis from -L_arm to +halfW)
      const entryGeom = new THREE.PlaneGeometry(L_arm + halfW, W);
      const entryFloor = new THREE.Mesh(entryGeom, floorMat);
      entryFloor.rotation.x = -Math.PI / 2;
      entryFloor.position.set((-L_arm + halfW) / 2, 0.001, 0);
      this.group.add(entryFloor);

      // Exit Arm (along Z axis from +halfW to +L_arm)
      const exitGeom = new THREE.PlaneGeometry(W, L_arm - halfW);
      const exitFloor = new THREE.Mesh(exitGeom, floorMat);
      exitFloor.rotation.x = -Math.PI / 2;
      exitFloor.position.set(0, 0.001, (L_arm + halfW) / 2);
      this.group.add(exitFloor);

      // Center Turn Sector
      const cornerGeom = new THREE.PlaneGeometry(W, W);
      const cornerFloor = new THREE.Mesh(cornerGeom, floorMat);
      cornerFloor.rotation.x = -Math.PI / 2;
      cornerFloor.position.set(0, 0.001, 0);
      this.group.add(cornerFloor);

      // Centerline Navigation Curve
      const curve = new THREE.CurvePath();
      const line1 = new THREE.LineCurve3(new THREE.Vector3(-L_arm, 0.004, 0), new THREE.Vector3(-0.5, 0.004, 0));
      const arc = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.5, 0.004, 0),
        new THREE.Vector3(0, 0.004, 0),
        new THREE.Vector3(0, 0.004, 0.5)
      );
      const line2 = new THREE.LineCurve3(new THREE.Vector3(0, 0.004, 0.5), new THREE.Vector3(0, 0.004, L_arm));
      curve.add(line1);
      curve.add(arc);
      curve.add(line2);

      const pts = curve.getPoints(40);
      const trackGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const trackMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
      const trackLine = new THREE.Line(trackGeom, trackMat);
      this.group.add(trackLine);

      // Boundary Walls
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.8
      });

      // Outer Corner Wall (+X side and +Z side)
      const outerWall1 = new THREE.Mesh(new THREE.BoxGeometry(L_arm + W, wallH, 0.04), wallMat.clone());
      outerWall1.position.set((-L_arm + W) / 2, wallH / 2, -halfW);
      this.group.add(outerWall1);
      this.wallMeshes.push(outerWall1);

      const outerWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, wallH, L_arm + W), wallMat.clone());
      outerWall2.position.set(halfW, wallH / 2, (L_arm - W) / 2 + W);
      this.group.add(outerWall2);
      this.wallMeshes.push(outerWall2);

      // Inner Corner Wall (-X side and +Z side)
      const innerWall1 = new THREE.Mesh(new THREE.BoxGeometry(L_arm - halfW, wallH, 0.04), wallMat.clone());
      innerWall1.position.set(-L_arm / 2, wallH / 2, halfW);
      this.group.add(innerWall1);
      this.wallMeshes.push(innerWall1);

      const innerWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, wallH, L_arm - halfW), wallMat.clone());
      innerWall2.position.set(-halfW, wallH / 2, L_arm / 2);
      this.group.add(innerWall2);
      this.wallMeshes.push(innerWall2);
    }

    build180DegreeTurnPathway() {
      const W = this.widthMeters;
      const L = Math.max(4.0, this.lengthMeters);
      const halfW = W / 2;
      const halfL = L / 2;
      const wallH = 0.55;

      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x131d2e,
        roughness: 0.7,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });

      // Broad U-turn Turnaround Bay
      const bayGeom = new THREE.PlaneGeometry(L, W);
      const bayFloor = new THREE.Mesh(bayGeom, floorMat);
      bayFloor.rotation.x = -Math.PI / 2;
      bayFloor.position.set(0, 0.001, 0);
      this.group.add(bayFloor);

      // Walls for U-Turn enclosure
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.8
      });

      // Side Walls
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(L, wallH, 0.04), wallMat.clone());
      leftWall.position.set(0, wallH / 2, halfW);
      this.group.add(leftWall);
      this.wallMeshes.push(leftWall);

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(L, wallH, 0.04), wallMat.clone());
      rightWall.position.set(0, wallH / 2, -halfW);
      this.group.add(rightWall);
      this.wallMeshes.push(rightWall);

      // End Cap Wall
      const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.04, wallH, W), wallMat.clone());
      endWall.position.set(halfL, wallH / 2, 0);
      this.group.add(endWall);
      this.wallMeshes.push(endWall);
    }

    buildCaliperOverlays() {
      const W = this.widthMeters;
      const halfW = W / 2;
      const halfL = this.lengthMeters / 2;

      // Dimension Caliper Line across entrance
      const caliperMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
      const caliperGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfL + 0.3, 0.08, -halfW),
        new THREE.Vector3(-halfL + 0.3, 0.08, halfW)
      ]);
      const caliperLine = new THREE.Line(caliperGeom, caliperMat);
      this.caliperGroup.add(caliperLine);

      // End tick marks
      const tickGeom1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfL + 0.2, 0.08, -halfW),
        new THREE.Vector3(-halfL + 0.4, 0.08, -halfW)
      ]);
      const tick1 = new THREE.Line(tickGeom1, caliperMat);
      this.caliperGroup.add(tick1);

      const tickGeom2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfL + 0.2, 0.08, halfW),
        new THREE.Vector3(-halfL + 0.4, 0.08, halfW)
      ]);
      const tick2 = new THREE.Line(tickGeom2, caliperMat);
      this.caliperGroup.add(tick2);

      // Text Sprite for Aisle Width
      const canvas = document.createElement('canvas');
      canvas.width = 380;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
      ctx.roundRect(0, 0, 380, 90, 10);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.roundRect(0, 0, 380, 90, 10);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Times New Roman", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PATHWAY WIDTH: ${(W * 1000).toFixed(0)} mm`, 190, 38);

      ctx.fillStyle = this.isFeasible ? '#10b981' : '#ef4444';
      ctx.font = 'bold 20px "Times New Roman", sans-serif';
      ctx.fillText(this.isFeasible ? 'CLEARANCE: FEASIBLE' : 'COLLISION: INFEASIBLE', 190, 68);

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.4, 0.35, 1);
      sprite.position.set(-halfL + 0.3, 0.45, 0);
      this.caliperGroup.add(sprite);
    }

    setCollisionHighlight(isColliding) {
      const color = isColliding ? 0xef4444 : 0x0284c7;
      const opacity = isColliding ? 0.65 : 0.35;
      this.wallMeshes.forEach(mesh => {
        if (mesh.material) {
          mesh.material.color.setHex(color);
          mesh.material.opacity = opacity;
        }
      });
    }

    /**
     * Trajectory Solver for 5-Second Simulation
     * @param {number} t - time in seconds (0.0 to 5.0)
     * @returns {Object} { x, y, z, rotationY, speed }
     */
    getTrajectory(t) {
      const duration = 5.0;
      const progress = Math.max(0, Math.min(1, t / duration));

      // S-curve velocity profile: accelerate (0-1s), cruise (1-4s), decelerate (4-5s)
      const accelPhase = 0.20; // 1s / 5s
      const decelPhase = 0.80; // 4s / 5s
      let eased;

      if (progress < accelPhase) {
        // Quadratic acceleration
        eased = 0.5 * Math.pow(progress / accelPhase, 2) * accelPhase / (1 - (accelPhase + (1 - decelPhase)) * 0.5);
      } else if (progress < decelPhase) {
        // Constant velocity
        const constSpeed = 1 / (1 - (accelPhase + (1 - decelPhase)) * 0.5);
        const accelDist = 0.5 * accelPhase * constSpeed;
        eased = accelDist + (progress - accelPhase) * constSpeed;
      } else {
        // Quadratic deceleration
        const constSpeed = 1 / (1 - (accelPhase + (1 - decelPhase)) * 0.5);
        const decelProgress = (progress - decelPhase) / (1 - decelPhase);
        const decelDist = constSpeed * (decelProgress - 0.5 * Math.pow(decelProgress, 2)) * (1 - decelPhase);
        const cruiseDist = 1 - 0.5 * (1 - decelPhase) * constSpeed;
        eased = cruiseDist + decelDist;
      }

      // Clamp normalized distance to [0, 1]
      const s = Math.max(0, Math.min(1, eased));

      // Instantaneous speed readout (m/s)
      let currentSpeed;
      const MAX_SPEED = 1.6; // m/s
      if (progress < accelPhase) {
        currentSpeed = (progress / accelPhase) * MAX_SPEED;
      } else if (progress < decelPhase) {
        currentSpeed = MAX_SPEED;
      } else {
        currentSpeed = (1 - (progress - decelPhase) / (1 - decelPhase)) * MAX_SPEED;
      }

      const halfL = this.lengthMeters / 2;

      if (this.maneuverType === 'straight') {
        const startX = -halfL + 1.2;
        const endX = halfL - 1.2;
        const posX = startX + (endX - startX) * s;
        return {
          x: posX,
          y: 0,
          z: 0,
          rotationY: 0,
          speed: currentSpeed
        };
      } else if (this.maneuverType === 'turn90') {
        const L_arm = Math.max(3.5, this.lengthMeters / 2);
        const startX = -L_arm + 1.0;
        const pivotX = 0;
        const pivotZ = 0;
        const exitZ = L_arm - 1.0;

        // Divide path into 3 segments: straight in (0 to 0.35), arc turn (0.35 to 0.70), straight out (0.70 to 1.0)
        if (s < 0.35) {
          const segS = s / 0.35;
          const posX = startX + (pivotX - 0.8 - startX) * segS;
          return { x: posX, y: 0, z: 0, rotationY: 0, speed: currentSpeed };
        } else if (s < 0.70) {
          const segS = (s - 0.35) / 0.35;
          const angle = segS * (Math.PI / 2);
          const R = 0.8;
          const posX = -0.8 + Math.sin(angle) * R;
          const posZ = 0.8 - Math.cos(angle) * R;
          return { x: posX, y: 0, z: posZ, rotationY: angle, speed: currentSpeed * 0.75 };
        } else {
          const segS = (s - 0.70) / 0.30;
          const posZ = 0.8 + (exitZ - 0.8) * segS;
          return { x: 0, y: 0, z: posZ, rotationY: Math.PI / 2, speed: currentSpeed };
        }
      } else if (this.maneuverType === 'turn180') {
        // U-turn loop
        if (s < 0.30) {
          const segS = s / 0.30;
          const posX = -halfL + 1.2 + (halfL - 2.5) * segS;
          return { x: posX, y: 0, z: -this.widthMeters * 0.25, rotationY: 0, speed: currentSpeed };
        } else if (s < 0.70) {
          const segS = (s - 0.30) / 0.40;
          const angle = segS * Math.PI;
          const R = this.widthMeters * 0.25;
          const centerX = halfL - 2.5;
          const posX = centerX + Math.sin(angle) * R;
          const posZ = -R + (1 - Math.cos(angle)) * R;
          return { x: posX, y: 0, z: posZ, rotationY: angle, speed: currentSpeed * 0.6 };
        } else {
          const segS = (s - 0.70) / 0.30;
          const posX = (halfL - 2.5) - (halfL - 1.3) * segS;
          return { x: posX, y: 0, z: this.widthMeters * 0.25, rotationY: Math.PI, speed: currentSpeed };
        }
      }

      return { x: 0, y: 0, z: 0, rotationY: 0, speed: 0 };
    }
  }

  window.PathwayModel = PathwayModel;
})();
