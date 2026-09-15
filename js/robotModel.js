/**
 * MP2000 Pallet Verifier - PUDU MP2000 3D Robot Model
 * Prioritizes loading authentic MP2000-optimized.glb 3D CAD model.
 * Features realistic hydraulic fork-only elevation (chassis stays firmly on ground).
 */

window.RobotModel = class RobotModel {
  constructor(modelCode = 'WPID01-M') {
    this.modelCode = modelCode;
    this.THREE = window.THREE;
    this.group = new this.THREE.Group();
    this.group.name = 'PUDU_MP2000_Root';

    this.forkSpreadB1 = modelCode === 'WPID01-N' ? 0.550 : 0.620;
    this.forkCarriageY = 0.080;
    this.forkElevation = 0;
    this.isGlbActive = false;
    this.baseY = 0.952; // model space Y offset so wheels touch floor at Y=0

    this.glbRoot = new this.THREE.Group();
    this.glbChassisGroup = new this.THREE.Group();
    this.glbForkGroup = new this.THREE.Group();
    this.glbRoot.add(this.glbChassisGroup);
    this.glbRoot.add(this.glbForkGroup);

    this.proceduralGroup = new this.THREE.Group();
    this.group.add(this.glbRoot);
    this.group.add(this.proceduralGroup);

    // Build procedural fallback initially (hidden once GLB is loaded)
    this.buildProceduralRobot();
  }

  /**
   * Prioritized GLB Loader with progress & completion callbacks
   */
  loadGlb(onProgress, onComplete) {
    const THREE = this.THREE;

    if (!THREE.GLTFLoader || !THREE.DRACOLoader) {
      console.warn('GLTFLoader or DRACOLoader not loaded. Using procedural CAD fallback.');
      if (onComplete) onComplete(false, 'Loaders unavailable');
      return;
    }

    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('js/libs/draco/');

    const loader = new THREE.GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'models/MP2000-optimized.glb',
      (gltf) => {
        let originalMesh = null;
        gltf.scene.traverse((node) => {
          if (node.isMesh && !originalMesh) {
            originalMesh = node;
          }
        });

        if (!originalMesh) {
          console.warn('No mesh found in GLB. Falling back to procedural model.');
          if (onComplete) onComplete(false, 'Mesh not found');
          return;
        }

        // Enable shadows and enhance PBR metallic-roughness
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              node.material.roughness = Math.max(0.2, node.material.roughness || 0.35);
              node.material.metalness = Math.min(0.85, node.material.metalness || 0.6);
            }
          }
        });

        // Compute CAD bounding box
        const box = new THREE.Box3().setFromObject(gltf.scene);
        this.baseY = -box.min.y;

        // Split geometry into Chassis Mesh and Fork Mesh
        this.splitRobotMesh(originalMesh, this.baseY);

        this.proceduralGroup.visible = false;
        this.isGlbActive = true;

        console.log('✅ Prioritized MP2000-optimized.glb loaded and separated into Chassis & Elevating Forks!');
        if (onComplete) onComplete(true, null);
      },
      (xhr) => {
        if (onProgress && xhr.total) {
          const percent = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          onProgress(percent, xhr.loaded, xhr.total);
        } else if (onProgress) {
          onProgress(50, xhr.loaded, 817388);
        }
      },
      (err) => {
        console.warn('GLB load failed (using procedural fallback):', err.message);
        this.proceduralGroup.visible = true;
        this.isGlbActive = false;
        if (onComplete) onComplete(false, err);
      }
    );
  }

  /**
   * Separates authentic CAD model into stationary chassis and elevating forks
   */
  splitRobotMesh(mesh, baseY) {
    const THREE = this.THREE;
    const geom = mesh.geometry;
    if (!geom || !geom.index) return;

    const index = geom.index;
    const pos = geom.attributes.position;

    const chassisIndices = [];
    const forkIndices = [];

    // In MP2000 CAD coordinates:
    // Mast / chassis front face is at X = -0.335m.
    // Forks extend forward from X = -0.32m to +0.757m with low Y (Y < -0.62m).
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      const avgX = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const avgY = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;

      if (avgX > -0.32 && avgY < -0.62) {
        forkIndices.push(a, b, c);
      } else {
        chassisIndices.push(a, b, c);
      }
    }

    // 1. Stationary Chassis Mesh (wheels, body, mast, LiDAR)
    const chassisGeom = geom.clone();
    chassisGeom.setIndex(chassisIndices);
    const chassisMesh = new THREE.Mesh(chassisGeom, mesh.material);
    chassisMesh.castShadow = true;
    chassisMesh.receiveShadow = true;

    // 2. Elevating Forks Mesh (left/right tines and load rollers)
    const forksGeom = geom.clone();
    forksGeom.setIndex(forkIndices);
    const forksMesh = new THREE.Mesh(forksGeom, mesh.material);
    forksMesh.castShadow = true;
    forksMesh.receiveShadow = true;

    // Assign to groups
    this.glbChassisGroup.clear();
    this.glbChassisGroup.position.set(0, baseY, 0);
    this.glbChassisGroup.add(chassisMesh);

    this.glbForkGroup.clear();
    this.glbForkGroup.position.set(0, baseY, 0);
    this.glbForkGroup.add(forksMesh);
  }

  buildProceduralRobot() {
    const THREE = this.THREE;
    this.proceduralGroup.clear();

    const bodyCharcoal = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.4,
      roughness: 0.35
    });

    const bodySilver = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.7,
      roughness: 0.3
    });

    const puduCyan = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });

    const forkSteel = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.25
    });

    const rollerRubber = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9
    });

    // 1. Chassis Body (length 1.58m, width 0.90m, height 1.87m)
    this.proceduralChassis = new THREE.Group();
    const bodyL = 0.720;
    const bodyW = 0.860;
    const bodyH = 1.100;
    const bodyBaseY = 0.080;

    const bodyGeom = new THREE.BoxGeometry(bodyL, bodyH, bodyW);
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyCharcoal);
    bodyMesh.position.set(-0.420, bodyBaseY + bodyH / 2, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.proceduralChassis.add(bodyMesh);

    // Front curved bumper
    const bumperGeom = new THREE.CylinderGeometry(bodyW / 2, bodyW / 2, bodyH * 0.4, 32, 1, false, 0, Math.PI);
    const bumperMesh = new THREE.Mesh(bumperGeom, bodySilver);
    bumperMesh.rotation.z = Math.PI / 2;
    bumperMesh.rotation.y = Math.PI / 2;
    bumperMesh.position.set(-0.780, bodyBaseY + bodyH * 0.3, 0);
    this.proceduralChassis.add(bumperMesh);

    // Cyan Status Lightbar
    const lightbarGeom = new THREE.BoxGeometry(0.04, 0.03, bodyW * 0.8);
    const lightbarMesh = new THREE.Mesh(lightbarGeom, puduCyan);
    lightbarMesh.position.set(-0.06, bodyBaseY + bodyH * 0.85, 0);
    this.proceduralChassis.add(lightbarMesh);

    // Mast & LiDAR Tower
    const mastHeight = 0.690;
    const mastGeom = new THREE.CylinderGeometry(0.04, 0.05, mastHeight, 16);
    const mastMesh = new THREE.Mesh(mastGeom, bodySilver);
    mastMesh.position.set(-0.25, bodyBaseY + bodyH + mastHeight / 2, 0);
    this.proceduralChassis.add(mastMesh);

    const lidarGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.08, 24);
    const lidarMesh = new THREE.Mesh(lidarGeom, bodyCharcoal);
    lidarMesh.position.set(-0.25, 1.870 - 0.04, 0);
    this.proceduralChassis.add(lidarMesh);

    this.proceduralGroup.add(this.proceduralChassis);

    // 2. Dual Fork Tines (Separate Elevating Carriage)
    this.forkCarriage = new THREE.Group();
    const tineL = 1.150;
    const tineW = 0.160;
    const tineThk = 0.045;

    this.leftTine = this.createTineMesh(tineL, tineW, tineThk, forkSteel, rollerRubber);
    this.rightTine = this.createTineMesh(tineL, tineW, tineThk, forkSteel, rollerRubber);
    this.forkCarriage.add(this.leftTine);
    this.forkCarriage.add(this.rightTine);
    this.proceduralGroup.add(this.forkCarriage);

    this.setForkSpacing(this.forkSpreadB1);
  }

  createTineMesh(length, width, thickness, steelMat, rubberMat) {
    const THREE = this.THREE;
    const group = new THREE.Group();

    const tineGeom = new THREE.BoxGeometry(length, thickness, width);
    const tineMesh = new THREE.Mesh(tineGeom, steelMat);
    // Fork tips reach +0.757m, so heel is at +0.757 - 1.150 = -0.393m
    tineMesh.position.set(0.757 - length / 2, thickness / 2, 0);
    tineMesh.castShadow = true;
    group.add(tineMesh);

    const tipLen = 0.06;
    const tipGeom = new THREE.ConeGeometry(thickness / 2, tipLen, 4);
    const tipMesh = new THREE.Mesh(tipGeom, steelMat);
    tipMesh.rotation.z = -Math.PI / 2;
    tipMesh.rotation.y = Math.PI / 4;
    tipMesh.position.set(0.757 + tipLen / 2, thickness / 2, 0);
    group.add(tipMesh);

    const rollerGeom = new THREE.CylinderGeometry(0.038, 0.038, width * 0.7, 16);
    const rollerMesh = new THREE.Mesh(rollerGeom, rubberMat);
    rollerMesh.rotation.x = Math.PI / 2;
    rollerMesh.position.set(0.757 - 0.08, -0.01, 0);
    group.add(rollerMesh);

    return group;
  }

  setForkSpacing(b1Meters) {
    this.forkSpreadB1 = b1Meters;
    const tineWidth = 0.160;
    const centerOffset = (b1Meters - tineWidth) / 2;

    if (this.leftTine && this.rightTine) {
      this.leftTine.position.z = -centerOffset;
      this.rightTine.position.z = centerOffset;
    }
  }

  /**
   * Elevates ONLY the fork carriage. Chassis remains firmly parked on the ground.
   */
  setLiftElevation(elevationMeters) {
    this.forkElevation = elevationMeters;

    // 1. Elevate procedural forks (procedural chassis stays at y=0)
    if (this.forkCarriage) {
      this.forkCarriage.position.y = elevationMeters;
    }

    // 2. Elevate authentic GLB forks (GLB chassis stays at y=this.baseY on the ground)
    if (this.isGlbActive && this.glbForkGroup) {
      this.glbForkGroup.position.y = this.baseY + elevationMeters;
    }
  }

  setModel(modelCode) {
    this.modelCode = modelCode;
    const b1 = modelCode === 'WPID01-N' ? 0.550 : 0.620;
    this.setForkSpacing(b1);
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }
};
