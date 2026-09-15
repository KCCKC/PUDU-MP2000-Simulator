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
  const PathwayModel = window.PathwayModel;
  const RobotModel = window.RobotModel;
  const PathwayVerifier = window.PathwayVerifier;
  const SimulationController = window.SimulationController;
  const SoundEngine = window.SoundEngine;
  const CadDimensions = window.CadDimensions;
  const TurningRadiusVisualizer = window.TurningRadiusVisualizer;
  const LidarScanner = window.LidarScanner;
  const VerificationExporter = window.VerificationExporter;

  class App {
    constructor() {
      this.currentModelCode = 'WPID01-M'; // default to standard 620mm
      this.currentPallet = { ...PALLET_PRESETS[0] }; // default to Malaysia CHEP
      this.autoCompareMode = false;

      // Active Mode: 'pallet' (3s) or 'pathway' (5s)
      this.activeMode = 'pallet';
      this.pathwayParams = {
        length: 8.0,
        width: 2200,
        maneuver: 'straight',
        isLoaded: true
      };
      this.pathwayEvalResult = null;

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

      this.pathwayModel = new PathwayModel(this.scene);

      this.robot = new RobotModel(this.currentModelCode);
      this.scene.add(this.robot.group);

      this.simulation = new SimulationController(
        this.robot,
        this.palletModel,
        this.pathwayModel,
        this.camera,
        this.controls,
        (simState) => this.onSimulationUpdate(simState)
      );
    }

    initPlugins() {
      this.sound = new SoundEngine();
      this.cadDimensions = new CadDimensions(this.scene);
      this.turningRadius = new TurningRadiusVisualizer(this.scene, this.robot);
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
      this.readPathwayFromForm();
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
        flag: '[CUSTOM]',
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
      // Mode Switcher Tabs
      const tabPallet = document.getElementById('tab-mode-pallet');
      const tabPathway = document.getElementById('tab-mode-pathway');
      if (tabPallet) tabPallet.addEventListener('click', () => this.switchMode('pallet'));
      if (tabPathway) tabPathway.addEventListener('click', () => this.switchMode('pathway'));

      // Pathway Inputs
      ['input-pathway-length', 'input-pathway-width'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', () => {
            this.readPathwayFromForm();
            this.runPathwayVerification();
          });
        }
      });

      const maneuverSelect = document.getElementById('pathway-maneuver-select');
      if (maneuverSelect) {
        maneuverSelect.addEventListener('change', () => {
          this.readPathwayFromForm();
          this.runPathwayVerification();
        });
      }

      document.querySelectorAll('input[name="payload-condition"]').forEach(radio => {
        radio.addEventListener('change', () => {
          this.readPathwayFromForm();
          this.runPathwayVerification();
        });
      });

      document.getElementById('preset-select').addEventListener('change', (e) => {
        const found = PALLET_PRESETS.find(p => p.id === e.target.value);
        if (found) {
          this.currentPallet = { ...found };
          this.syncFormWithCurrentPallet();
          this.updatePalletModel();
          if (this.activeMode === 'pallet') {
            this.runVerification();
          } else {
            this.runPathwayVerification();
          }
        }
      });

      const inputIds = ['input-length', 'input-width', 'input-height', 'input-w1', 'input-w2', 'input-ch', 'select-type', 'select-material', 'input-color'];
      inputIds.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
          this.currentPallet = this.readPalletFromForm();
          this.updatePalletModel();
          if (this.activeMode === 'pallet') {
            this.runVerification();
          } else {
            this.runPathwayVerification();
          }
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
          btnSound.textContent = isMuted ? 'Muted' : 'Audio';
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

      // 2.5. Turning Radius & Aisle Envelope Toggle
      const btnTurning = document.getElementById('btn-turning-radius');
      if (btnTurning) {
        btnTurning.addEventListener('click', () => {
          const isVis = this.turningRadius.toggle();
          btnTurning.classList.toggle('active', isVis);
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

      if (this.activeMode === 'pallet') {
        this.runVerification();
      } else {
        this.runPathwayVerification();
      }
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

      // Update 3D Turning Radius Overlays
      if (this.turningRadius) {
        this.turningRadius.update(this.currentPallet, PUDU_MODELS[this.currentModelCode]);
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
          <span class="status-tag ${metrics.outer.pass ? 'pass' : 'fail'}">${metrics.outer.pass ? 'PASS' : 'FAIL'}</span>
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
          <span class="status-tag ${metrics.inner.pass ? 'pass' : 'fail'}">${metrics.inner.pass ? 'PASS' : 'FAIL'}</span>
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
          <span class="status-tag ${metrics.height.pass ? 'pass' : 'fail'}">${metrics.height.pass ? 'PASS' : 'FAIL'}</span>
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
          <span class="status-tag ${metrics.bottomDeck.pass ? 'pass' : 'fail'}">${metrics.bottomDeck.pass ? 'PASS' : 'FAIL'}</span>
          <strong>Bottom Deck Kinematics (${metrics.bottomDeck.type.toUpperCase()})</strong>
        </div>
        <div class="metric-desc">${metrics.bottomDeck.notes}</div>
      `;

      // Update Turning Radius & Maneuvering Envelope Card
      const tr = metrics.turningRadius;
      if (tr) {
        const hudTrMin = document.getElementById('hud-tr-min');
        const hudAstMin = document.getElementById('hud-ast-min');
        const hudTrRec = document.getElementById('hud-tr-rec');
        const hudAstRec = document.getElementById('hud-ast-rec');
        const telTr = document.getElementById('telemetry-radius');

        if (hudTrMin) hudTrMin.textContent = `${tr.rMin.toFixed(2)} m`;
        if (hudAstMin) hudAstMin.textContent = `Aisle Ast ≤ ${tr.astMin.toLocaleString()} mm`;
        if (hudTrRec) hudTrRec.textContent = `${tr.rRec.toFixed(2)} m`;
        if (hudAstRec) hudAstRec.textContent = `Safe Aisle ≥ ${tr.astRec.toLocaleString()} mm`;
        if (telTr) telTr.textContent = `${tr.rMin.toFixed(2)} m (Min)`;
      }

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

    switchMode(mode) {
      if (this.activeMode === mode) return;
      this.activeMode = mode;

      const tabPallet = document.getElementById('tab-mode-pallet');
      const tabPathway = document.getElementById('tab-mode-pathway');
      const secPalletCfg = document.getElementById('section-pallet-config');
      const secPathwayCfg = document.getElementById('section-pathway-config');
      const secPalletDiag = document.getElementById('section-pallet-diagnostics');
      const secPathwayDiag = document.getElementById('section-pathway-diagnostics');
      const scrubber = document.getElementById('timeline-scrubber');
      const simTimeText = document.getElementById('sim-time-text');
      const btnReplay = document.getElementById('btn-replay');

      if (mode === 'pallet') {
        if (tabPallet) tabPallet.classList.add('active');
        if (tabPathway) tabPathway.classList.remove('active');
        if (secPalletCfg) secPalletCfg.style.display = 'block';
        if (secPathwayCfg) secPathwayCfg.style.display = 'none';
        if (secPalletDiag) secPalletDiag.style.display = 'block';
        if (secPathwayDiag) secPathwayDiag.style.display = 'none';

        if (scrubber) scrubber.max = '3';
        if (simTimeText) simTimeText.textContent = '0.00s / 3.00s';
        if (btnReplay) {
          btnReplay.textContent = 'Replay (3s)';
          btnReplay.title = 'Restart 3-Second Docking Simulation';
        }

        if (this.palletModel) this.palletModel.group.visible = true;
        if (this.pathwayModel) this.pathwayModel.setVisible(false);
        if (this.cadDimensions) this.cadDimensions.setVisible(true);
        if (this.turningRadius) this.turningRadius.setVisible(true);

        this.simulation.setMode('pallet');
        this.runVerification();
      } else {
        if (tabPallet) tabPallet.classList.remove('active');
        if (tabPathway) tabPathway.classList.add('active');
        if (secPalletCfg) secPalletCfg.style.display = 'none';
        if (secPathwayCfg) secPathwayCfg.style.display = 'block';
        if (secPalletDiag) secPalletDiag.style.display = 'none';
        if (secPathwayDiag) secPathwayDiag.style.display = 'block';

        if (scrubber) scrubber.max = '5';
        if (simTimeText) simTimeText.textContent = '0.00s / 5.00s';
        if (btnReplay) {
          btnReplay.textContent = 'Replay (5s)';
          btnReplay.title = 'Restart 5-Second Pathway Transit';
        }

        if (this.pathwayModel) this.pathwayModel.setVisible(true);
        if (this.cadDimensions) this.cadDimensions.setVisible(false);
        if (this.turningRadius) this.turningRadius.setVisible(false);

        this.simulation.setMode('pathway');
        this.readPathwayFromForm();
        this.runPathwayVerification();
      }

      this.resetSoundFlags();
      this.simulation.reset();
    }

    readPathwayFromForm() {
      const lenEl = document.getElementById('input-pathway-length');
      const widEl = document.getElementById('input-pathway-width');
      const manEl = document.getElementById('pathway-maneuver-select');
      const payloadRadio = document.querySelector('input[name="payload-condition"]:checked');

      this.pathwayParams = {
        length: lenEl ? Number(lenEl.value) : 8.0,
        width: widEl ? Number(widEl.value) : 2200,
        maneuver: manEl ? manEl.value : 'straight',
        isLoaded: payloadRadio ? payloadRadio.value === 'loaded' : true
      };
    }

    runPathwayVerification() {
      if (!PathwayVerifier) return;

      this.readPathwayFromForm();
      this.resetSoundFlags();

      this.pathwayEvalResult = PathwayVerifier.evaluate({
        pathwayLength: this.pathwayParams.length,
        pathwayWidth: this.pathwayParams.width,
        maneuverType: this.pathwayParams.maneuver,
        isLoaded: this.pathwayParams.isLoaded,
        palletData: this.currentPallet,
        modelCode: this.currentModelCode
      });

      // Rebuild 3D Pathway Corridor Model
      if (this.pathwayModel) {
        this.pathwayModel.rebuild(
          this.pathwayParams.length,
          this.pathwayParams.width,
          this.pathwayParams.maneuver,
          this.pathwayEvalResult.isFeasible
        );
      }

      // Update simulation controller
      this.simulation.setEvaluation(this.evalResult, this.pathwayEvalResult);

      // Update Active Payload info
      const pNameEl = document.getElementById('pathway-pallet-name');
      const pSpecEl = document.getElementById('pathway-pallet-spec');
      if (pNameEl && pSpecEl) {
        if (this.pathwayParams.isLoaded) {
          pNameEl.textContent = `Active Payload: ${this.currentPallet.name}`;
          pSpecEl.textContent = `${this.currentPallet.dimensions.length} x ${this.currentPallet.dimensions.width} x ${this.currentPallet.dimensions.height} mm | Tare: ${this.currentPallet.tareWeight || 25} kg`;
        } else {
          pNameEl.textContent = 'Payload: Bare Chassis (Unloaded)';
          pSpecEl.textContent = 'Footprint: 1585 x 910 x 1870 mm | Tare: 1,880 kg';
        }
      }

      // Update Verdict Banner
      const verdictBanner = document.getElementById('hud-pathway-verdict');
      const verdictTitle = document.getElementById('hud-pathway-verdict-title');
      const verdictDesc = document.getElementById('hud-pathway-verdict-desc');
      if (verdictBanner && verdictTitle && verdictDesc) {
        verdictBanner.className = `verdict-banner badge-${this.pathwayEvalResult.verdict.badgeClass}`;
        verdictTitle.textContent = this.pathwayEvalResult.verdict.badge;
        verdictDesc.textContent = this.pathwayEvalResult.verdict.explanation;
      }

      // Metric 1: Corridor Width Check
      const widthEl = document.getElementById('metric-pathway-width');
      if (widthEl) {
        const cw = this.pathwayEvalResult.metrics.corridorWidth;
        widthEl.className = `metric-row ${cw.pass ? 'pass' : 'fail'}`;
        widthEl.innerHTML = `
          <div class="metric-label">
            <span class="status-tag ${cw.pass ? 'pass' : 'fail'}">${cw.pass ? 'PASS' : 'FAIL'}</span>
            <strong>Corridor Width (${cw.actual}mm vs ${cw.requiredMin}mm Min)</strong>
          </div>
          <div class="metric-values">
            <span>Corridor: <strong>${cw.actual}mm</strong></span>
            <span>Min Passable: <strong>${cw.requiredMin}mm</strong></span>
            <span class="margin-badge">${cw.margin >= 0 ? '+' + cw.margin + 'mm margin' : cw.margin + 'mm (COLLISION!)'}</span>
          </div>
        `;
      }

      // Metric 2: Turnability Check
      const turnEl = document.getElementById('metric-pathway-turn');
      if (turnEl) {
        const tb = this.pathwayEvalResult.metrics.turnability;
        turnEl.className = `metric-row ${tb.pass ? 'pass' : 'fail'}`;
        turnEl.innerHTML = `
          <div class="metric-label">
            <span class="status-tag ${tb.pass ? 'pass' : 'fail'}">${tb.pass ? 'PASS' : 'FAIL'}</span>
            <strong>${tb.label}</strong>
          </div>
          <div class="metric-desc" style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
            ${tb.details}
          </div>
        `;
      }

      // Metric 3: Safe Velocity Advisory
      const speedEl = document.getElementById('metric-pathway-speed');
      if (speedEl) {
        const sp = this.pathwayEvalResult.metrics.speedAdvisory;
        const speedClass = sp.maxSpeed >= 1.5 ? 'pass' : (sp.maxSpeed > 0 ? 'warn' : 'fail');
        speedEl.className = `metric-row ${speedClass}`;
        speedEl.innerHTML = `
          <div class="metric-label">
            <span class="status-tag ${speedClass}">${sp.rating.toUpperCase()}</span>
            <strong>Safe Velocity Limit (${sp.maxSpeed.toFixed(1)} m/s)</strong>
          </div>
          <div class="metric-desc" style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
            ${sp.advisory}
          </div>
        `;
      }

      // Metric 4: ISO 3691-4 Safety Buffer Check
      const isoEl = document.getElementById('metric-pathway-iso');
      if (isoEl) {
        const iso = this.pathwayEvalResult.metrics.isoCompliance;
        isoEl.className = `metric-row ${iso.pass ? 'pass' : 'fail'}`;
        isoEl.innerHTML = `
          <div class="metric-label">
            <span class="status-tag ${iso.pass ? 'pass' : 'warn'}">${iso.pass ? 'PASS' : 'CAUTION'}</span>
            <strong>DIN EN ISO 3691-4 Compliance</strong>
          </div>
          <div class="metric-desc" style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
            ${iso.notes} (Buffer: +${iso.bufferTotal}mm total)
          </div>
        `;
      }

      // Telemetry Bar updates
      const marginEl = document.getElementById('telemetry-margin');
      if (marginEl) {
        const m = this.pathwayEvalResult.metrics.corridorWidth.margin;
        marginEl.textContent = m >= 0 ? `+${Math.round(m / 2)} mm/side` : 'COLLISION!';
        marginEl.style.color = m >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
      }

      const radiusEl = document.getElementById('telemetry-radius');
      if (radiusEl) {
        const tr = this.pathwayEvalResult.metrics.turnability.turningRadius;
        radiusEl.textContent = `${(tr / 1000).toFixed(2)} m (Pivot R)`;
      }
    }

    onSimulationUpdate(simState) {
      document.getElementById('timeline-scrubber').value = simState.currentTime.toFixed(2);
      const maxDurText = this.activeMode === 'pathway' ? '5.00s' : '3.00s';
      document.getElementById('sim-time-text').textContent = `${simState.currentTime.toFixed(2)}s / ${maxDurText}`;

      const playBtn = document.getElementById('btn-play');
      playBtn.textContent = simState.isPlaying ? 'Pause' : 'Play Simulation';

      if (this.activeMode === 'pathway') {
        // Pathway Simulation Telemetry & Audio
        if (simState.isPlaying && !simState.isCollisionHalted) {
          const maxSpeed = this.pathwayEvalResult?.metrics?.speedAdvisory?.maxSpeed ?? 1.6;
          const progress = Math.min(1, simState.currentTime / 4.8);
          const normalizedSpeed = Math.sin(progress * Math.PI);
          this.sound.setMotorSpeed(normalizedSpeed);

          const currentSpeedMps = (maxSpeed * normalizedSpeed).toFixed(2);
          document.getElementById('telemetry-speed').textContent = `${currentSpeedMps} m/s`;

          const liftMm = this.pathwayParams.isLoaded ? '80 mm' : '0 mm';
          document.getElementById('telemetry-lift').textContent = liftMm;

          if (simState.currentTime >= 4.90 && !this.hasPlayedEndSound) {
            this.hasPlayedEndSound = true;
            this.sound.playSuccessChime();
          }
        } else {
          this.sound.stopMotor();
          document.getElementById('telemetry-speed').textContent = '0.00 m/s';
        }
      } else {
        // Pallet Simulation Telemetry & Audio
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
      }

      // Collision detection alert & sound
      const alertBanner = document.getElementById('collision-alert-banner');
      if (simState.isCollisionHalted) {
        alertBanner.classList.add('visible');
        alertBanner.innerHTML = `<strong>CRITICAL IMPACT DETECTED:</strong> Motion halted at collision boundary.`;

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

      // Tick 3D Turning Radius Visualizer
      if (this.turningRadius) {
        this.turningRadius.tick(delta);
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
