/**
 * MP2000 Pallet Verifier - PUDU 3D LiDAR Holographic Scan Visualizer
 * Animates a sweeping laser perception cone projecting from the MP2000 LiDAR mast.
 */

window.LidarScanner = class LidarScanner {
  constructor(scene, robot) {
    this.scene = scene;
    this.robot = robot;
    this.THREE = window.THREE;
    this.group = new this.THREE.Group();
    this.group.name = 'PUDU_LiDAR_Perception_Mesh';
    this.scene.add(this.group);

    this.visible = true;
    this.sweepTime = 0;

    this.buildLidarCone();
  }

  buildLidarCone() {
    const THREE = this.THREE;
    this.group.clear();

    // 1. Semi-transparent laser cone / pyramid
    const length = 2.4;
    const width = 1.6;
    const height = 1.8;

    const coneGeom = new THREE.BufferGeometry();
    // Apex at (0, 1.87, 0) - sensor tower
    const apex = [ -0.25, 1.87, 0 ];
    // Base corners on floor
    const bl = [ -0.25 + length, 0.01, -width / 2 ];
    const br = [ -0.25 + length, 0.01, width / 2 ];

    const vertices = new Float32Array([
      // Triangle 1: Apex -> BL -> BR
      apex[0], apex[1], apex[2],
      bl[0], bl[1], bl[2],
      br[0], br[1], br[2],
      // Double sided
      apex[0], apex[1], apex[2],
      br[0], br[1], br[2],
      bl[0], bl[1], bl[2]
    ]);

    coneGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    coneGeom.computeVertexNormals();

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.laserMesh = new THREE.Mesh(coneGeom, coneMat);
    this.group.add(this.laserMesh);

    // 2. Cyan Scanning Laser Boundary Lines
    const linePoints = [
      new THREE.Vector3(apex[0], apex[1], apex[2]),
      new THREE.Vector3(bl[0], bl[1], bl[2]),
      new THREE.Vector3(br[0], br[1], br[2]),
      new THREE.Vector3(apex[0], apex[1], apex[2]),
      new THREE.Vector3(br[0], br[1], br[2])
    ];

    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65
    });

    this.lineSegments = new THREE.Line(lineGeom, lineMat);
    this.group.add(this.lineSegments);

    // 3. Projected Floor Laser Arc
    const arcPoints = [];
    for (let a = -0.4; a <= 0.4; a += 0.05) {
      const x = -0.25 + Math.cos(a) * length;
      const z = Math.sin(a) * length;
      arcPoints.push(new THREE.Vector3(x, 0.015, z));
    }
    const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      linewidth: 3,
      transparent: true,
      opacity: 0.85
    });
    this.floorArc = new THREE.Line(arcGeom, arcMat);
    this.group.add(this.floorArc);
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }

  toggle() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  tick(delta) {
    if (!this.visible) return;

    this.sweepTime += delta * 3.5;

    // Follow the robot position in world coordinates
    if (this.robot && this.robot.group) {
      this.group.position.x = this.robot.group.position.x;
      this.group.position.z = this.robot.group.position.z;
    }

    // Gentle sweeping animation
    const sweepAngle = Math.sin(this.sweepTime) * 0.15;
    this.group.rotation.y = sweepAngle;

    // Pulse laser opacity
    if (this.laserMesh) {
      this.laserMesh.material.opacity = 0.12 + Math.sin(this.sweepTime * 2.0) * 0.06;
    }
  }
};
