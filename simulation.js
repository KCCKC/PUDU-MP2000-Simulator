/**
 * MP2000 Pallet Verifier - 3-Second Cinematic Simulation Engine
 * Handles smooth insertion animation, collision detection kinematics, and fixed multi-angle CAD camera modes.
 * Ensures zero-overlap clearance between robot chassis and pallet front face.
 */

window.SimulationController = class SimulationController {
  constructor(robot, palletModel, camera, controls, onUpdate) {
    this.robot = robot;
    this.palletModel = palletModel;
    this.camera = camera;
    this.controls = controls;
    this.onUpdate = onUpdate;
    this.THREE = window.THREE;

    this.duration = 3.0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.speed = 1.0;
    this.cameraMode = 'ad'; // 'ad', 'top', 'front', 'side', 'free'

    this.evalResult = null;
    this.isCollisionHalted = false;

    // Smooth Camera Transition State
    this.isTransitioningCam = false;
    this.camTargetPos = new this.THREE.Vector3();
    this.camTargetLook = new this.THREE.Vector3();

    this.updateKinematicBounds();
    this.applyTime(0);

    // Initial camera placement
    this.setCameraMode('ad', true);
  }

  updateKinematicBounds() {
    const L = (this.palletModel.data.dimensions.length || 1200) / 1000;
    const palletFrontX = -L / 2;

    // PUDU MP2000 CAD Reference Coordinates:
    // Fork tips are at local X = +0.757m
    // Chassis front wall / mast is at local X = -0.335m
    const forkTipOffset = 0.757;
    const chassisFrontOffset = -0.335;

    // Start position: fork tips are backed up 450mm in front of pallet entrance
    this.startX = palletFrontX - 0.450 - forkTipOffset;

    // Target insertion position:
    // Maintain a clean 50mm safety clearance between the robot chassis mast and the pallet front edge
    // to guarantee ZERO visual overlapping or clipping at maximum insertion depth:
    const maxChassisAdvance = -chassisFrontOffset - 0.050; // = 0.335 - 0.050 = 0.285m
    const maxInsertionByChassis = palletFrontX + maxChassisAdvance;

    // If pallet is shorter than usable fork length, fork tips extend slightly through back deckboard:
    const throughPalletX = palletFrontX + (L + 0.040) - forkTipOffset;

    // Safest target depth:
    this.targetX = Math.min(maxInsertionByChassis, throughPalletX);

    // Collision boundary position (if incompatible pallet):
    this.collisionX = palletFrontX - forkTipOffset + 0.020;
  }

  setEvaluation(evalResult) {
    this.evalResult = evalResult;
    this.reset();
  }

  play() {
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  reset() {
    this.currentTime = 0;
    this.isPlaying = false;
    this.isCollisionHalted = false;
    this.palletModel.resetHighlight();
    this.applyTime(0);
    this.notifyUpdate();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    this.notifyUpdate();
  }

  setSpeed(multiplier) {
    this.speed = multiplier;
  }

  seek(timeSeconds) {
    this.currentTime = Math.max(0, Math.min(this.duration, timeSeconds));
    this.applyTime(this.currentTime);
    this.notifyUpdate();
  }

  tick(deltaSeconds) {
    // 1. Smooth Camera Transition if active
    if (this.isTransitioningCam) {
      this.camera.position.lerp(this.camTargetPos, 0.12);
      this.controls.target.lerp(this.camTargetLook, 0.12);
      this.controls.update();

      if (this.camera.position.distanceTo(this.camTargetPos) < 0.02) {
        this.camera.position.copy(this.camTargetPos);
        this.controls.target.copy(this.camTargetLook);
        this.controls.update();
        this.isTransitioningCam = false;
      }
    }

    // 2. Playback progress
    if (!this.isPlaying) return;

    this.currentTime += deltaSeconds * this.speed;

    if (this.currentTime >= this.duration) {
      this.currentTime = this.duration;
      this.isPlaying = false;
    }

    this.applyTime(this.currentTime);
    this.notifyUpdate();
  }

  applyTime(t) {
    const THREE = this.THREE;
    this.updateKinematicBounds();
    const isCompatible = this.evalResult ? this.evalResult.isCompatible : true;

    const insertionPhaseEnd = 2.2;
    const insertionProgress = Math.min(1, t / insertionPhaseEnd);
    const easedInsertion = insertionProgress < 0.5
      ? 2 * insertionProgress * insertionProgress
      : -1 + (4 - 2 * insertionProgress) * insertionProgress;

    let currentX;

    if (isCompatible) {
      this.isCollisionHalted = false;
      this.palletModel.resetHighlight();

      currentX = THREE.MathUtils.lerp(this.startX, this.targetX, easedInsertion);
      this.robot.setPosition(currentX, 0, 0);

      // Hydraulic lift phase: ONLY the forks elevate with the pallet; chassis remains on ground!
      if (t > insertionPhaseEnd) {
        const liftProgress = (t - insertionPhaseEnd) / (this.duration - insertionPhaseEnd);
        const easedLift = Math.sin(liftProgress * Math.PI * 0.5);
        const liftMeters = easedLift * 0.120; // 120mm lift height
        this.robot.setLiftElevation(liftMeters);
        this.palletModel.group.position.y = liftMeters;
      } else {
        this.robot.setLiftElevation(0);
        this.palletModel.group.position.y = 0;
      }
    } else {
      const collisionTime = 1.3;
      if (t < collisionTime) {
        this.isCollisionHalted = false;
        this.palletModel.resetHighlight();
        const preImpactProgress = t / collisionTime;
        currentX = THREE.MathUtils.lerp(this.startX, this.collisionX, preImpactProgress);
        this.robot.setPosition(currentX, 0, 0);
      } else {
        this.isCollisionHalted = true;
        this.robot.setPosition(this.collisionX, 0, 0);
        this.robot.setLiftElevation(0);
        this.palletModel.group.position.y = 0;

        if (this.evalResult && this.evalResult.collisionPoint) {
          this.palletModel.setCollisionHighlight(this.evalResult.collisionPoint);
        }
      }
    }

    // Only Hero Ad mode performs dynamic cinematic orbit
    if (this.cameraMode === 'ad' && !this.isTransitioningCam) {
      this.updateAdCamera(t);
    }
  }

  setCameraMode(mode, forceImmediate = false) {
    this.cameraMode = mode;
    const THREE = this.THREE;
    const L = (this.palletModel.data.dimensions.length || 1200) / 1000;
    const palletFrontX = -L / 2;

    this.camera.up.set(0, 1, 0);

    if (mode === 'top') {
      // 📐 Top CAD View (Overhead plan view of fork/pocket interface)
      this.camTargetPos.set(-0.35, 3.4, 0.15);
      this.camTargetLook.set(-0.35, 0.05, 0);
    } else if (mode === 'front') {
      // 👁️ Front Pocket View (Elevated perspective peering straight into the fork entry channels)
      this.camTargetPos.set(palletFrontX - 1.0, 0.55, 1.15);
      this.camTargetLook.set(palletFrontX + 0.1, 0.12, 0);
    } else if (mode === 'side') {
      // 🔍 Side CAD Profile View (Evaluates fork thickness & vertical pocket clearance)
      this.camTargetPos.set(-0.30, 0.40, 2.5);
      this.camTargetLook.set(-0.30, 0.15, 0);
    } else if (mode === 'ad') {
      // 🎬 Hero Ad Cinematic View
      this.camTargetPos.set(palletFrontX - 1.4, 1.1, 1.8);
      this.camTargetLook.set(palletFrontX + 0.2, 0.2, 0);
    } else if (mode === 'free') {
      this.isTransitioningCam = false;
      return;
    }

    if (forceImmediate) {
      this.camera.position.copy(this.camTargetPos);
      this.controls.target.copy(this.camTargetLook);
      this.controls.update();
      this.isTransitioningCam = false;
    } else {
      this.isTransitioningCam = true;
    }
  }

  updateAdCamera(t) {
    const THREE = this.THREE;
    const L = (this.palletModel.data.dimensions.length || 1200) / 1000;
    const palletFrontX = -L / 2;

    const angle = (t / this.duration) * (Math.PI * 0.25) - Math.PI * 0.12;
    const radius = 2.4;
    const targetCamX = palletFrontX + Math.cos(angle) * radius - 0.2;
    const targetCamZ = Math.sin(angle) * radius * 1.1;
    const targetCamY = 1.1 + Math.sin(t * 1.5) * 0.06;

    this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.06);
    this.controls.target.set(palletFrontX + 0.2, 0.2, 0);
    this.controls.update();
  }

  notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate({
        currentTime: this.currentTime,
        duration: this.duration,
        progress: this.currentTime / this.duration,
        isPlaying: this.isPlaying,
        isCollisionHalted: this.isCollisionHalted,
        speed: this.speed,
        cameraMode: this.cameraMode
      });
    }
  }
};
