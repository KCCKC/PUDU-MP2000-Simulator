/**
 * MP2000 Pallet Verifier - Parametric 3D Pallet Generator
 * Compatible with local file:/// execution and web hosting.
 */

window.PalletModel = class PalletModel {
  constructor(palletData) {
    this.data = palletData;
    this.THREE = window.THREE;
    this.group = new this.THREE.Group();
    this.group.name = 'PalletRoot';

    this.outerBlocks = [];
    this.centerBlock = null;
    this.bottomDeckGroup = new this.THREE.Group();
    this.topDeckGroup = new this.THREE.Group();
    this.dimensionLinesGroup = new this.THREE.Group();

    this.buildModel();
  }

  mm(val) {
    return (val || 0) / 1000;
  }

  buildModel() {
    const THREE = this.THREE;

    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.outerBlocks = [];
    this.centerBlock = null;
    this.bottomDeckGroup = new THREE.Group();
    this.topDeckGroup = new THREE.Group();
    this.dimensionLinesGroup = new THREE.Group();

    const L = this.mm(this.data.dimensions.length);
    const W = this.mm(this.data.dimensions.width);
    const H = this.mm(this.data.dimensions.height);
    const Ch = this.mm(this.data.openings.Ch);
    const W1 = this.mm(this.data.openings.W1);
    const W2 = this.mm(this.data.openings.W2);

    const topDeckThk = this.mm(22);
    const botDeckThk = (this.data.type === 'reversible') ? topDeckThk : this.mm(20);
    const blockHeight = Ch;

    const isPlastic = this.data.material === 'plastic';
    const mainColor = new THREE.Color(this.data.color || (isPlastic ? '#2563EB' : '#C18C5D'));

    this.mainMaterial = new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: isPlastic ? 0.35 : 0.75,
      metalness: isPlastic ? 0.05 : 0.02,
      flatShading: false
    });

    this.collisionMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.7,
      roughness: 0.2
    });

    // 1. TOP DECK
    const numTopBoards = 7;
    const boardGap = 0.015;
    const totalGap = (numTopBoards - 1) * boardGap;
    const boardWidth = (W - totalGap) / numTopBoards;
    const boardY = botDeckThk + blockHeight + topDeckThk / 2;

    for (let i = 0; i < numTopBoards; i++) {
      const bGeom = new THREE.BoxGeometry(L, topDeckThk, boardWidth);
      const bMesh = new THREE.Mesh(bGeom, this.mainMaterial);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;

      const zPos = -W / 2 + boardWidth / 2 + i * (boardWidth + boardGap);
      bMesh.position.set(0, boardY, zPos);
      this.topDeckGroup.add(bMesh);
    }
    this.group.add(this.topDeckGroup);

    // 2. BLOCKS OR STRINGERS
    const cornerBlockWidth = Math.max(0.06, (W - W1) / 2);
    const blockLength = Math.min(0.145, L * 0.15);
    const blockY = botDeckThk + blockHeight / 2;

    const blockGeomOuter = new THREE.BoxGeometry(blockLength, blockHeight, cornerBlockWidth);
    const blockGeomCenter = new THREE.BoxGeometry(blockLength, blockHeight, W2);

    const xPositions = [-L / 2 + blockLength / 2, 0, L / 2 - blockLength / 2];

    xPositions.forEach((x, colIdx) => {
      // Left Outer Block
      const leftBlock = new THREE.Mesh(blockGeomOuter, this.mainMaterial.clone());
      leftBlock.castShadow = true;
      leftBlock.position.set(x, blockY, -W / 2 + cornerBlockWidth / 2);
      this.group.add(leftBlock);
      this.outerBlocks.push(leftBlock);

      // Center Block
      const centerBlk = new THREE.Mesh(blockGeomCenter, this.mainMaterial.clone());
      centerBlk.castShadow = true;
      centerBlk.position.set(x, blockY, 0);
      this.group.add(centerBlk);
      if (colIdx === 0) {
        this.centerBlock = centerBlk;
      }

      // Right Outer Block
      const rightBlock = new THREE.Mesh(blockGeomOuter, this.mainMaterial.clone());
      rightBlock.castShadow = true;
      rightBlock.position.set(x, blockY, W / 2 - cornerBlockWidth / 2);
      this.group.add(rightBlock);
      this.outerBlocks.push(rightBlock);
    });

    // 3. BOTTOM DECK
    const botY = botDeckThk / 2;

    if (this.data.type === 'perimeter' || this.data.type === 'block') {
      const runnerGeom = new THREE.BoxGeometry(L, botDeckThk, cornerBlockWidth);
      const runnerCenterGeom = new THREE.BoxGeometry(L, botDeckThk, W2);

      const leftRunner = new THREE.Mesh(runnerGeom, this.mainMaterial);
      leftRunner.position.set(0, botY, -W / 2 + cornerBlockWidth / 2);
      this.bottomDeckGroup.add(leftRunner);

      const centerRunner = new THREE.Mesh(runnerCenterGeom, this.mainMaterial);
      centerRunner.position.set(0, botY, 0);
      this.bottomDeckGroup.add(centerRunner);

      const rightRunner = new THREE.Mesh(runnerGeom, this.mainMaterial);
      rightRunner.position.set(0, botY, W / 2 - cornerBlockWidth / 2);
      this.bottomDeckGroup.add(rightRunner);

      const crossGeom = new THREE.BoxGeometry(blockLength, botDeckThk, W - 2 * cornerBlockWidth);
      const frontCross = new THREE.Mesh(crossGeom, this.mainMaterial);
      frontCross.position.set(-L / 2 + blockLength / 2, botY, 0);
      this.bottomDeckGroup.add(frontCross);

      const backCross = new THREE.Mesh(crossGeom, this.mainMaterial);
      backCross.position.set(L / 2 - blockLength / 2, botY, 0);
      this.bottomDeckGroup.add(backCross);
    } else if (this.data.type === 'three_runner') {
      const runnerGeom = new THREE.BoxGeometry(L, botDeckThk, cornerBlockWidth);
      const runnerCenterGeom = new THREE.BoxGeometry(L, botDeckThk, W2);

      const leftRunner = new THREE.Mesh(runnerGeom, this.mainMaterial);
      leftRunner.position.set(0, botY, -W / 2 + cornerBlockWidth / 2);
      this.bottomDeckGroup.add(leftRunner);

      const centerRunner = new THREE.Mesh(runnerCenterGeom, this.mainMaterial);
      centerRunner.position.set(0, botY, 0);
      this.bottomDeckGroup.add(centerRunner);

      const rightRunner = new THREE.Mesh(runnerGeom, this.mainMaterial);
      rightRunner.position.set(0, botY, W / 2 - cornerBlockWidth / 2);
      this.bottomDeckGroup.add(rightRunner);
    } else if (this.data.type === 'reversible') {
      for (let i = 0; i < numTopBoards; i++) {
        const bGeom = new THREE.BoxGeometry(L, botDeckThk, boardWidth);
        const bMesh = new THREE.Mesh(bGeom, this.mainMaterial);
        const zPos = -W / 2 + boardWidth / 2 + i * (boardWidth + boardGap);
        bMesh.position.set(0, botY, zPos);
        this.bottomDeckGroup.add(bMesh);
      }
    } else if (this.data.type === 'notched') {
      const runnerGeom = new THREE.BoxGeometry(L, botDeckThk, cornerBlockWidth);
      const leftRunner = new THREE.Mesh(runnerGeom, this.mainMaterial);
      leftRunner.position.set(0, botY, -W / 2 + cornerBlockWidth / 2);
      this.bottomDeckGroup.add(leftRunner);

      const rightRunner = new THREE.Mesh(runnerGeom, this.mainMaterial);
      rightRunner.position.set(0, botY, W / 2 - cornerBlockWidth / 2);
      this.bottomDeckGroup.add(rightRunner);
    }

    this.group.add(this.bottomDeckGroup);
    this.createDimensionVisualizers(L, W, H, W1, W2, Ch, cornerBlockWidth, botDeckThk);
    this.group.add(this.dimensionLinesGroup);

    this.group.position.set(0, 0, 0);
  }

  createDimensionVisualizers(L, W, H, W1, W2, Ch, cornerBlockWidth, botDeckThk) {
    const THREE = this.THREE;
    const frontX = -L / 2 - 0.05;
    const midY = botDeckThk + Ch / 2;

    const w1LeftZ = -W / 2 + cornerBlockWidth;
    const w1RightZ = W / 2 - cornerBlockWidth;
    const w1Geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(frontX, midY + 0.04, w1LeftZ),
      new THREE.Vector3(frontX, midY + 0.04, w1RightZ)
    ]);
    const w1Line = new THREE.Line(w1Geom, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 }));
    this.dimensionLinesGroup.add(w1Line);

    const w2LeftZ = -W2 / 2;
    const w2RightZ = W2 / 2;
    const w2Geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(frontX, midY - 0.03, w2LeftZ),
      new THREE.Vector3(frontX, midY - 0.03, w2RightZ)
    ]);
    const w2Line = new THREE.Line(w2Geom, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
    this.dimensionLinesGroup.add(w2Line);
  }

  setCollisionHighlight(collisionPoint) {
    this.resetHighlight();

    if (collisionPoint === 'OUTER_BLOCKS' || collisionPoint === 'MULTI_COLLISION') {
      this.outerBlocks.forEach(blk => {
        blk.material = this.collisionMaterial;
      });
    }

    if (collisionPoint === 'CENTER_BLOCK' || collisionPoint === 'MULTI_COLLISION') {
      if (this.centerBlock) {
        this.centerBlock.material = this.collisionMaterial;
      }
    }

    if (collisionPoint === 'SOLID_BOTTOM' || collisionPoint === 'NOTCH_TOO_LOW') {
      this.bottomDeckGroup.children.forEach(child => {
        child.material = this.collisionMaterial;
      });
    }

    if (collisionPoint === 'HEIGHT_COLLISION') {
      this.topDeckGroup.children.forEach(child => {
        child.material = this.collisionMaterial;
      });
    }
  }

  resetHighlight() {
    this.outerBlocks.forEach(blk => {
      blk.material = this.mainMaterial;
    });
    if (this.centerBlock) {
      this.centerBlock.material = this.mainMaterial;
    }
    this.bottomDeckGroup.children.forEach(child => {
      child.material = this.mainMaterial;
    });
    this.topDeckGroup.children.forEach(child => {
      child.material = this.mainMaterial;
    });
  }

  updateData(newData) {
    this.data = newData;
    this.buildModel();
  }
};
