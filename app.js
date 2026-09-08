/**
 * MP2000 Pallet Verifier - Main Application Orchestrator
 * Integrates prioritized GLB model, 3D LiDAR perception, CAD dimension calipers,
 * Web Audio synthesizer, and 4K verification snapshot exporter.
 */

(function() {
  const THREE = window.THREE;
  const OrbitControls = THREE.OrbitControls;
  const PALLET_PRESETS = window.PALLET_PRESETS;
  const PUDU_MODELS = window.PUDU_MODELS;
  const evaluateModel = window.evaluateModel;
  const evaluatePalletComparative = window.evaluatePalletComparative;
  const PalletModel = window.PalletModel;
  const RobotModel = window.RobotModel;
  const SimulationController = window.SimulationController;
  const SoundEngine = window.SoundEngine;
  const CadDimensions = window.CadDimensions;
  const LidarScanner = window.LidarScanner;
  const VerificationExporter = window.VerificationExporter;

  class App {
    constructor() {
      this.currentModelCode = 'WPID01-M'; // default to standard 620mm
      this.currentPallet = { ...PALLET_PRESETS[0] }; // default to Malaysia CHEP
      this.autoCompareMode = false;

      // Audio state flags
      this.hasPlayedLiftSound = false;
      this.hasPlayedEndSound = false;
      this.hasPlayedCollisionSound = false;

      this.initThree();
      this.initModels();
      this.initPlugins();
      this.initUI();
      this.bindEvents();
      this.runVerification();

      // Start render loop
      this.clock = new THREE.Clock();
      this.animate();

      // Prioritize loading MP2000-optimized.glb
      this.loadPrioritizedGlbModel();
    }

    initThree() {
      this.container = document.getElementById('canvas-container');
      const width = this.container.clientWidth || window.innerWidth * 0.55;
      const height = this.container.clientHeight || window.innerHeight - 60;

      // Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0b0f19);

      // Camera
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
      this.camera.position.set(-2.4, 1.4, 1.8);

      // Renderer (preserveDrawingBuffer enabled for high-res snapshots)
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.container.appendChild(this.renderer.domElement);

      // Controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
      this.controls.minDistance = 0.4;
      this.controls.maxDistance = 12;
      this.controls.target.set(-0.4, 0.2, 0);

      // Auto-switch to 'Free 3D' when user interacts with mouse
      this.controls.addEventListener('start', () => {
        if (this.simulation && this.simulation.cameraMode !== 'free') {
          this.simulation.cameraMode = 'free';
          this.syncCamButtons('free');
        }
      });

      // Studio Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      this.scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
      keyLight.position.set(3, 5, 4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.bias = -0.0005;
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
      fillLight.position.set(-4, 3, -3);
      this.scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.45);
      rimLight.position.set(-2, 4, 3);
      this.scene.add(rimLight);

      // Floor Grid
      const grid = new THREE.GridHelper(10, 40, 0x1e293b, 0x0f172a);
      grid.position.y = -0.001;
      this.scene.add(grid);

      const floorGeom = new THREE.PlaneGeometry(20, 20);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x0b0f19,
        roughness: 0.85,
        metalness: 0.1
      });
      const floor = new THREE.Mesh(floorGeom, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      floor.receiveShadow = true;
      this.scene.add(floor);

      window.addEventListener('resize', () => this.onResize());
    }

    initModels() {
      this.palletModel = new PalletModel(this.currentPallet);
      this.scene.add(this.palletModel.group);

      this.robot = new RobotModel(this.currentModelCode);
      this.scene.add(this.robot.group);

      this.simulation = new SimulationController(
        this.robot,
        this.palletModel,
        this.camera,
        this.controls,
        (simState) => this.onSimulationUpdate(simState)
      );
    }

    initPlugins() {
      this.sound = new SoundEngine();
      this.cadDimensions = new CadDimensions(this.scene);
      this.lidarScanner = new LidarScanner(this.scene, this.robot);
      this.exporter = new VerificationExporter(this.renderer, this.scene, this.camera);
    }

    /**
     * Prioritized Loading Pipeline for MP2000-optimized.glb
     */
    loadPrioritizedGlbModel() {
      const overlay = document.getElementById('loading-overlay');
      const bar = document.getElementById('loading-bar');
      const text = document.getElementById('loading-percent');

      this.robot.loadGlb(
        (percent, loaded, total) => {
          if (bar) bar.style.width = percent + '%';
          if (text) {
            const kb = Math.round(loaded / 1024);
            const totalKb = total ? Math.round(total / 1024) : 817;
            text.textContent = `Loading 3D CAD mesh: ${percent}% (${kb} KB / ${totalKb} KB)...`;
          }
        },
        (success, err) => {
          if (success) {
            if (bar) bar.style.width = '100%';
            if (text) text.textContent = 'MP2000 3D CAD Model Ready!';
          } else {
            if (text) text.textContent = 'Ready (Procedural CAD mode active)';
          }

          // Smooth fade-out of splash overlay
          setTimeout(() => {
            if (overlay) overlay.classList.add('fade-out');
            setTimeout(() => {
              this.simulation.play();
            }, 300);
          }, 400);
        }
      );
    }

    initUI() {
      this.populatePresets();
      this.syncFormWithCurrentPallet();
    }

    populatePresets() {
      const select = document.getElementById('preset-select');
      select.innerHTML = '';

      const groups = {};
      PALLET_PRESETS.forEach(p => {
        if (!groups[p.country]) groups[p.country] = [];
        groups[p.country].push(p);
      });

      Object.keys(groups).forEach(country => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${groups[country][0].flag || ''} ${country}`;
        groups[country].forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });

      select.value = this.currentPallet.id;
    }

    syncFormWithCurrentPallet() {
      const p = this.currentPallet;
      document.getElementById('input-length').value = p.dimensions.length;
      document.getElementById('num-length').value = p.dimensions.length;
      document.getElementById('input-width').value = p.dimensions.width;
      document.getElementById('num-width').value = p.dimensions.width;
      document.getElementById('input-height').value = p.dimensions.height;
      document.getElementById('num-height').value = p.dimensions.height;

      document.getElementById('input-w1').value = p.openings.W1;
      document.getElementById('num-w1').value = p.openings.W1;
      document.getElementById('input-w2').value = p.openings.W2;
      document.getElementById('num-w2').value = p.openings.W2;
      document.getElementById('input-ch').value = p.openings.Ch;
      document.getElementById('num-ch').value = p.openings.Ch;

      document.getElementById('select-type').value = p.type;
      document.getElementById('select-material').value = p.material;
      document.getElementById('input-color').value = p.color;

      document.getElementById('preset-desc').innerHTML = `
        <strong>${p.flag || ''} ${p.name}</strong><br>
        <span style="color: var(--text-secondary);">${p.standard || ''} — ${p.description || ''}</span>
      `;
    }

    readPalletFromForm() {
      return {
        id: 'custom',
        country: 'Custom',
        flag: '✏️',
        name: 'Custom User Pallet',
        standard: 'User-Defined Parameters',
        description: 'Custom dimensions configured via sliders.',
        dimensions: {
          length: Number(document.getElementById('input-length').value),
          width: Number(document.getElementById('input-width').value),
          height: Number(document.getElementById('input-height').value)
        },
        openings: {
          W1: Number(document.getElementById('input-w1').value),
          W2: Number(document.getElementById('input-w2').value),
          Ch: Number(document.getElementById('input-ch').value)
        },
        type: document.getElementById('select-type').value,
        material: document.getElementById('select-material').value,
        color: document.getElementById('input-color').value,
        tareWeight: 25,
        maxLoad: 2000
      };
    }

    bindEvents() {
      document.getElementById('preset-select').addEventListener('change', (e) => {
        const found = PALLET_PRESETS.find(p => p.id === e.target.value);
        if (found) {
          this.currentPallet = { ...found };
          this.syncFormWithCurrentPallet();
          this.updatePalletModel();
          this.runVerification();
        }
      });

      const inputIds = ['input-length', 'input-width', 'input-height', 'input-w1', 'input-w2', 'input-ch', 'select-type', 'select-material', 'input-color'];
      inputIds.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
          this.currentPallet = this.readPalletFromForm();
          this.updatePalletModel();
          this.runVerification();
        });
      });

      document.getElementById('btn-model-m').addEventListener('click', () => {
        this.setModel('WPID01-M');
      });
      document.getElementById('btn-model-n').addEventListener('click', () => {
        this.setModel('WPID01-N');
      });

      document.getElementById('btn-play').addEventListener('click', () => {
        this.simulation.togglePlay();
      });
      document.getElementById('btn-replay').addEventListener('click', () => {
        this.resetSoundFlags();
        this.simulation.reset();
        this.simulation.play();
      });
      document.getElementById('timeline-scrubber').addEventListener('input', (e) => {
        const t = Number(e.target.value);
        this.simulation.seek(t);
      });

      document.querySelectorAll('.btn-speed').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          this.simulation.setSpeed(Number(e.currentTarget.dataset.speed));
        });
      });

      // Camera Switcher Buttons
      document.querySelectorAll('.btn-cam').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const mode = e.currentTarget.dataset.cam;
          this.syncCamButtons(mode);
          this.simulation.setCameraMode(mode);
        });
      });

      // Header Plugin Tools:
      // 1. Sound Mute Toggle
      const btnSound = document.getElementById('btn-sound');
      if (btnSound) {
        btnSound.addEventListener('click', () => {
          const isMuted = this.sound.toggleMute();
          btnSound.classList.toggle('active', !isMuted);
          btnSound.textContent = isMuted ? '🔇 Muted' : '🔊 Audio';
        });
      }

      // 2. CAD Dimensions Overlay Toggle
      const btnCadDim = document.getElementById('btn-cad-dim');
      if (btnCadDim) {
        btnCadDim.addEventListener('click', () => {
          const isVis = this.cadDimensions.toggle();
          btnCadDim.classList.toggle('active', isVis);
        });
      }

      // 3. LiDAR Scanner Beam Toggle
      const btnLidar = document.getElementById('btn-lidar');
      if (btnLidar) {
        btnLidar.addEventListener('click', () => {
          const isVis = this.lidarScanner.toggle();
          btnLidar.classList.toggle('active', isVis);
        });
      }

      // 4. Snapshot Exporter
      const btnSnapshot = document.getElementById('btn-snapshot');
      if (btnSnapshot) {
        btnSnapshot.addEventListener('click', () => {
          const comparative = evaluatePalletComparative(this.currentPallet);
          const activeEval = this.currentModelCode === 'WPID01-M' ? comparative.evalM : comparative.evalN;
          this.exporter.exportSnapshot(this.currentPallet, PUDU_MODELS[this.currentModelCode], activeEval);
        });
      }
    }

    resetSoundFlags() {
      this.hasPlayedLiftSound = false;
      this.hasPlayedEndSound = false;
      this.hasPlayedCollisionSound = false;
    }

    syncCamButtons(activeMode) {
      document.querySelectorAll('.btn-cam').forEach(b => {
        b.classList.toggle('active', b.dataset.cam === activeMode);
      });
    }

    setModel(code) {
      this.currentModelCode = code;
      this.robot.setModel(code);

      document.getElementById('btn-model-m').classList.toggle('active', code === 'WPID01-M');
      document.getElementById('btn-model-n').classList.toggle('active', code === 'WPID01-N');

      this.runVerification();
    }

    updatePalletModel() {
      this.palletModel.updateData(this.currentPallet);
    }

    runVerification() {
      const comparative = evaluatePalletComparative(this.currentPallet);
      const activeEval = this.currentModelCode === 'WPID01-M' ? comparative.evalM : comparative.evalN;
      const otherEval = this.currentModelCode === 'WPID01-M' ? comparative.evalN : comparative.evalM;

      this.resetSoundFlags();
      this.simulation.setEvaluation(activeEval);
      this.renderVerificationHUD(activeEval, otherEval, comparative);

      // Update 3D CAD Dimensions Overlay
      if (this.cadDimensions) {
        this.cadDimensions.update(this.currentPallet, PUDU_MODELS[this.currentModelCode], activeEval);
      }
    }

    renderVerificationHUD(active, other, comparative) {
      const model = PUDU_MODELS[this.currentModelCode];
      const metrics = active.metrics;

      document.getElementById('hud-model-title').textContent = model.marketingName;
      document.getElementById('hud-model-specs').textContent = `Outer Fork: ${model.B1}mm | Inner Gap: ${model.B2}mm | Lowered: ${model.loweredHeight}mm`;

      const verdictEl = document.getElementById('hud-verdict');
      verdictEl.className = `verdict-banner ${active.verdict.badgeClass}`;
      verdictEl.innerHTML = `
        <div class="verdict-title">${active.verdict.badge}</div>
        <div class="verdict-desc">${active.verdict.explanation}</div>
      `;

      // Update Telemetry Clearance Margin
      const marginEl = document.getElementById('telemetry-margin');
      if (marginEl) {
        marginEl.textContent = metrics.outer.marginPerSide >= 0 ? `+${metrics.outer.marginPerSide} mm/side` : 'COLLISION!';
        marginEl.style.color = metrics.outer.marginPerSide >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
      }

      // Criteria 1: Outer Opening
      const outerEl = document.getElementById('metric-outer');
      const outerMargin = metrics.outer.marginPerSide >= 0 ? `+${metrics.outer.marginPerSide}mm/side` : `${metrics.outer.marginPerSide}mm (COLLISION!)`;
      outerEl.className = `metric-row ${metrics.outer.pass ? 'pass' : 'fail'}`;
      outerEl.innerHTML = `
        <div class="metric-label">
          <span class="status-icon">${metrics.outer.pass ? '✅' : '❌'}</span>
          <strong>Outer Entry Check (W₁ ≥ B₁ + 40mm)</strong>
        </div>
        <div class="metric-values">
          <span>Pallet W₁: <strong>${metrics.outer.W1}mm</strong></span>
          <span>Min Required: <strong>${metrics.outer.outerRequired}mm</strong></span>
          <span class="margin-badge">${outerMargin}</span>
        </div>
      `;

      // Criteria 2: Inner Center Block
      const innerEl = document.getElementById('metric-inner');
      const innerMargin = metrics.inner.marginPerSide >= 0 ? `+${metrics.inner.marginPerSide}mm/side` : `${metrics.inner.marginPerSide}mm (COLLISION!)`;
      innerEl.className = `metric-row ${metrics.inner.pass ? 'pass' : 'fail'}`;
      innerEl.innerHTML = `
        <div class="metric-label">
          <span class="status-icon">${metrics.inner.pass ? '✅' : '❌'}</span>
          <strong>Inner Block Check (W₂ ≤ B₂ - 40mm)</strong>
        </div>
        <div class="metric-values">
          <span>Center Block W₂: <strong>${metrics.inner.W2}mm</strong></span>
          <span>Max Allowed: <strong>${metrics.inner.innerRequired}mm</strong></span>
          <span class="margin-badge">${innerMargin}</span>
        </div>
      `;

      // Criteria 3: Vertical Height
      const heightEl = document.getElementById('metric-height');
      heightEl.className = `metric-row ${metrics.height.pass ? 'pass' : 'fail'}`;
      heightEl.innerHTML = `
        <div class="metric-label">
          <span class="status-icon">${metrics.height.pass ? '✅' : '❌'}</span>
          <strong>Height Clearance (Cₕ ≥ 85mm)</strong>
        </div>
        <div class="metric-values">
          <span>Pocket Cₕ: <strong>${metrics.height.Ch}mm</strong></span>
          <span>Fork Collapsed: <strong>80mm</strong></span>
          <span class="margin-badge">${metrics.height.pass ? '+' + (metrics.height.Ch - 80) + 'mm margin' : 'COLLISION!'}</span>
        </div>
      `;

      // Criteria 4: Bottom Deck Style
      const bottomEl = document.getElementById('metric-bottom');
      bottomEl.className = `metric-row ${metrics.bottomDeck.pass ? 'pass' : 'fail'}`;
      bottomEl.innerHTML = `
        <div class="metric-label">
          <span class="status-icon">${metrics.bottomDeck.pass ? '✅' : '❌'}</span>
          <strong>Bottom Deck Kinematics (${metrics.bottomDeck.type.toUpperCase()})</strong>
        </div>
        <div class="metric-desc">${metrics.bottomDeck.notes}</div>
      `;

      // Comparison Quick View Card
      const compEl = document.getElementById('hud-comparison');
      compEl.innerHTML = `
        <div class="comp-box ${comparative.evalM.isCompatible ? 'comp-pass' : 'comp-fail'}">
          <div class="comp-name">Standard (620mm)</div>
          <div class="comp-status">${comparative.evalM.verdict.badge}</div>
        </div>
        <div class="comp-box ${comparative.evalN.isCompatible ? 'comp-pass' : 'comp-fail'}">
          <div class="comp-name">Narrow (550mm)</div>
          <div class="comp-status">${comparative.evalN.verdict.badge}</div>
        </div>
      `;
    }

    onSimulationUpdate(simState) {
      document.getElementById('timeline-scrubber').value = simState.currentTime.toFixed(2);
      document.getElementById('sim-time-text').textContent = `${simState.currentTime.toFixed(2)}s / 3.00s`;

      const playBtn = document.getElementById('btn-play');
      playBtn.textContent = simState.isPlaying ? '⏸ Pause' : '▶ Play Simulation';

      // 1. Audio and Telemetry during movement
      if (simState.isPlaying && !simState.isCollisionHalted) {
        const isInserting = simState.currentTime < 2.2;
        const normalizedSpeed = isInserting ? Math.sin((simState.currentTime / 2.2) * Math.PI) : 0;
        this.sound.setMotorSpeed(normalizedSpeed);

        const currentSpeedMps = isInserting ? (0.45 * Math.sin((simState.currentTime / 2.2) * Math.PI)).toFixed(2) : '0.00';
        document.getElementById('telemetry-speed').textContent = `${currentSpeedMps} m/s`;

        // Hydraulic lift hiss sound at lift phase
        if (simState.currentTime >= 2.2 && !this.hasPlayedLiftSound) {
          this.hasPlayedLiftSound = true;
          this.sound.playHydraulicLift();
        }

        // Lift telemetry
        const liftMeters = this.palletModel.group.position.y || 0;
        document.getElementById('telemetry-lift').textContent = `${(liftMeters * 1000).toFixed(0)} mm`;

        // Success chime at completion
        if (simState.currentTime >= 2.95 && !this.hasPlayedEndSound) {
          this.hasPlayedEndSound = true;
          this.sound.playSuccessChime();
        }
      } else {
        this.sound.stopMotor();
        document.getElementById('telemetry-speed').textContent = '0.00 m/s';
      }

      // 2. Collision detection alert & sound
      const alertBanner = document.getElementById('collision-alert-banner');
      if (simState.isCollisionHalted) {
        alertBanner.classList.add('visible');
        alertBanner.innerHTML = `⚠️ <strong>CRITICAL IMPACT DETECTED:</strong> Motion halted at collision boundary.`;

        if (!this.hasPlayedCollisionSound) {
          this.hasPlayedCollisionSound = true;
          this.sound.playCollisionAlarm();
        }
      } else {
        alertBanner.classList.remove('visible');
      }
    }

    onResize() {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    animate() {
      requestAnimationFrame(() => this.animate());

      const delta = this.clock.getDelta();
      this.simulation.tick(delta);

      // Tick LiDAR perception scanner sweep
      if (this.lidarScanner) {
        this.lidarScanner.tick(delta);
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
  } else {
    window.app = new App();
  }
})();
