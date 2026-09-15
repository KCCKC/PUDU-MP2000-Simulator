/**
 * MP2000 Pallet Verifier - Multi-Mode Simulation Engine
 *
 * Supports Dual Simulation Operations:
 * 1. Pallet Docking Mode (3.0s): Insertion kinematics, under-deck clearance, fork elevation.
 * 2. Custom Pathway Transit Mode (5.0s): Dynamic corridor traversal, turning sweep, boundary collision checks.
 *
 * Provides smooth transitions across all CAD camera perspectives:
 * - Hero Orbit: Cinematic dynamic tracking
 * - Top CAD: Overhead blueprint plan view of swept envelopes
 * - Front View: Forward-facing operator perspective looking down the corridor
 * - Side CAD: Lateral profile elevation
 * - Free 3D: Unconstrained orbital inspection
 */

(function() {
  const THREE = window.THREE;

  class SimulationController {
    constructor(robot, palletModel, pathwayModel, camera, controls, onUpdate) {
      this.robot = robot;
      this.palletModel = palletModel;
      this.pathwayModel = pathwayModel;
      this.camera = camera;
      this.controls = controls;
      this.onUpdate = onUpdate;

      this.mode = 'pallet'; // 'pallet' (3s) or 'pathway' (5s)
      this.duration = 3.0;
      this.currentTime = 0;
      this.isPlaying = false;
      this.speed = 1.0;
      this.cameraMode = 'ad'; // 'ad', 'top', 'front', 'side', 'free'

      this.palletEvalResult = null;
      this.pathwayEvalResult = null;
      this.isCollisionHalted = false;

      // Smooth Camera Transition State
      this.isTransitioningCam = false;
      this.camTargetPos = new THREE.Vector3();
      this.camTargetLook = new THREE.Vector3();

      this.updateKinematicBounds();
      this.applyTime(0);
      this.setCameraMode('ad', true);
    }

    setMode(mode) {
      if (this.mode === mode) return;
      this.mode = mode;
      this.duration = mode === 'pathway' ? 5.0 : 3.0;
      this.reset();
      this.setCameraMode(this.cameraMode, true);
    }

    updateKinematicBounds() {
      if (this.mode === 'pallet') {
        const L = (this.palletModel?.data?.dimensions?.length || 1200) / 1000;
        const palletFrontX = -L / 2;
        const forkTipOffset = 0.757;
        const chassisFrontOffset = -0.335;

        this.startX = palletFrontX - 0.450 - forkTipOffset;
        const maxChassisAdvance = -chassisFrontOffset - 0.050;
        const maxInsertionByChassis = palletFrontX + maxChassisAdvance;
        const throughPalletX = palletFrontX + (L + 0.040) - forkTipOffset;
        this.targetX = Math.min(maxInsertionByChassis, throughPalletX);
        this.collisionX = palletFrontX - forkTipOffset + 0.020;
      }
    }

    setEvaluation(palletEval, pathwayEval) {
      if (palletEval) this.palletEvalResult = palletEval;
      if (pathwayEval) this.pathwayEvalResult = pathwayEval;
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
      if (this.palletModel) this.palletModel.resetHighlight();
      if (this.pathwayModel) this.pathwayModel.setCollisionHighlight(false);
      this.applyTime(0);
      this.notifyUpdate();
    }

    togglePlay() {
      if (this.isPlaying) this.pause();
      else this.play();
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
      // 1. Smooth Camera Lerp
      if (this.isTransitioningCam) {
        this.camera.position.lerp(this.camTargetPos, 0.12);
        this.controls.target.lerp(this.camTargetLook, 0.12);
        this.controls.update();

        if (this.camera.position.distanceTo(this.camTargetPos) < 0.03) {
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
      if (this.mode === 'pallet') {
        this.applyPalletSimulation(t);
      } else {
        this.applyPathwaySimulation(t);
      }
    }

    applyPalletSimulation(t) {
      this.updateKinematicBounds();
      const isCompatible = this.palletEvalResult ? this.palletEvalResult.isCompatible : true;
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
        this.robot.group.position.set(currentX, 0, 0);
        this.robot.group.rotation.set(0, 0, 0);

        if (t > insertionPhaseEnd) {
          const liftProgress = (t - insertionPhaseEnd) / (this.duration - insertionPhaseEnd);
          const easedLift = Math.sin(liftProgress * Math.PI * 0.5);
          const liftMeters = easedLift * 0.120;
          this.robot.setLiftElevation(liftMeters);
          this.palletModel.group.position.set(0, liftMeters, 0);
        } else {
          this.robot.setLiftElevation(0);
          this.palletModel.group.position.set(0, 0, 0);
        }
      } else {
        const collisionTime = 1.3;
        if (t < collisionTime) {
          this.isCollisionHalted = false;
          this.palletModel.resetHighlight();
          const preImpactProgress = t / collisionTime;
          currentX = THREE.MathUtils.lerp(this.startX, this.collisionX, preImpactProgress);
          this.robot.group.position.set(currentX, 0, 0);
          this.robot.group.rotation.set(0, 0, 0);
        } else {
          this.isCollisionHalted = true;
          this.robot.group.position.set(this.collisionX, 0, 0);
          this.robot.group.rotation.set(0, 0, 0);
          this.robot.setLiftElevation(0);
          this.palletModel.group.position.set(0, 0, 0);

          if (this.palletEvalResult && this.palletEvalResult.collisionPoint) {
            this.palletModel.setCollisionHighlight(this.palletEvalResult.collisionPoint);
          }
        }
      }

      if (this.cameraMode === 'ad' && !this.isTransitioningCam) {
        this.updatePalletAdCamera(t);
      }
    }

    applyPathwaySimulation(t) {
      if (!this.pathwayModel) return;

      const evalResult = this.pathwayEvalResult || { isFeasible: true };
      const isFeasible = evalResult.isFeasible;
      const isLoaded = evalResult.isLoaded;

      // Determine if a collision halt occurs along the 5-second trajectory
      const collisionTime = evalResult.maneuverType === 'turn90' ? 2.5 : 1.2;
      const willCollide = !isFeasible && t >= collisionTime;

      let simTime = t;
      if (!isFeasible && t >= collisionTime) {
        simTime = collisionTime;
        this.isCollisionHalted = true;
        this.pathwayModel.setCollisionHighlight(true);
      } else {
        this.isCollisionHalted = false;
        this.pathwayModel.setCollisionHighlight(false);
      }

      const traj = this.pathwayModel.getTrajectory(simTime);

      // Position robot
      this.robot.group.position.set(traj.x, traj.y, traj.z);
      this.robot.group.rotation.set(0, traj.rotationY, 0);

      // If carrying pallet, bind pallet position to robot forks
      if (isLoaded && this.palletModel) {
        this.palletModel.group.visible = true;
        this.robot.setLiftElevation(0.08); // elevated 80mm onto tines

        // In robot local space, pallet center sits at X = 0.55m
        const localPalletOffset = new THREE.Vector3(0.55, 0.08, 0);
        localPalletOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), traj.rotationY);

        this.palletModel.group.position.set(
          traj.x + localPalletOffset.x,
          traj.y + localPalletOffset.y,
          traj.z + localPalletOffset.z
        );
        this.palletModel.group.rotation.set(0, traj.rotationY, 0);
      } else if (this.palletModel) {
        // Hide or ground pallet during unloaded transit
        this.palletModel.group.visible = false;
        this.robot.setLiftElevation(0);
      }

      // Update camera dynamic tracking
      if (this.cameraMode === 'ad' && !this.isTransitioningCam) {
        this.updatePathwayAdCamera(traj);
      } else if (this.cameraMode === 'front' && !this.isTransitioningCam) {
        this.updatePathwayFrontCamera(traj);
      }
    }

    setCameraMode(mode, forceImmediate = false) {
      this.cameraMode = mode;
      this.camera.up.set(0, 1, 0);

      if (this.mode === 'pallet') {
        const L = (this.palletModel?.data?.dimensions?.length || 1200) / 1000;
        const palletFrontX = -L / 2;

        if (mode === 'top') {
          this.camTargetPos.set(-0.35, 3.4, 0.15);
          this.camTargetLook.set(-0.35, 0.05, 0);
        } else if (mode === 'front') {
          this.camTargetPos.set(palletFrontX - 1.0, 0.55, 1.15);
          this.camTargetLook.set(palletFrontX + 0.1, 0.12, 0);
        } else if (mode === 'side') {
          this.camTargetPos.set(-0.30, 0.40, 2.5);
          this.camTargetLook.set(-0.30, 0.15, 0);
        } else if (mode === 'ad') {
          this.camTargetPos.set(palletFrontX - 1.4, 1.1, 1.8);
          this.camTargetLook.set(palletFrontX + 0.2, 0.2, 0);
        } else if (mode === 'free') {
          this.isTransitioningCam = false;
          return;
        }
      } else {
        // Pathway Camera Positions
        const L = this.pathwayModel?.lengthMeters || 8.0;
        const W = this.pathwayModel?.widthMeters || 2.2;

        if (mode === 'top') {
          // Bird's eye orthographic view of complete corridor and boundaries
          const topHeight = Math.max(6.5, L * 0.9);
          this.camTargetPos.set(0, topHeight, 0.01);
          this.camTargetLook.set(0, 0, 0);
        } else if (mode === 'front') {
          // Forward driver/chase perspective
          this.camTargetPos.set(-L / 2 + 0.2, 1.4, 0);
          this.camTargetLook.set(L / 2, 0.5, 0);
        } else if (mode === 'side') {
          // Side CAD elevation showing corridor span
          this.camTargetPos.set(0, 1.2, W + 3.2);
          this.camTargetLook.set(0, 0.5, 0);
        } else if (mode === 'ad') {
          // Dynamic tracking 3/4 perspective
          this.camTargetPos.set(-L / 2 - 1.5, 2.2, W + 1.8);
          this.camTargetLook.set(-L / 2 + 1.5, 0.5, 0);
        } else if (mode === 'free') {
          this.isTransitioningCam = false;
          return;
        }
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

    updatePalletAdCamera(t) {
      const L = (this.palletModel?.data?.dimensions?.length || 1200) / 1000;
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

    updatePathwayAdCamera(traj) {
      // Dynamic tracking camera: maintains 3/4 trailing offset relative to moving vehicle
      const offset = new THREE.Vector3(-2.2, 1.6, 2.0);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), traj.rotationY);

      const desiredCamPos = new THREE.Vector3(
        traj.x + offset.x,
        traj.y + offset.y,
        traj.z + offset.z
      );

      const lookAhead = new THREE.Vector3(1.2, 0.4, 0);
      lookAhead.applyAxisAngle(new THREE.Vector3(0, 1, 0), traj.rotationY);

      this.camera.position.lerp(desiredCamPos, 0.08);
      this.controls.target.set(traj.x + lookAhead.x, traj.y + lookAhead.y, traj.z + lookAhead.z);
      this.controls.update();
    }

    updatePathwayFrontCamera(traj) {
      // Forward chase camera positioned behind sensor mast looking along travel path
      const offset = new THREE.Vector3(-1.4, 1.2, 0);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), traj.rotationY);

      const desiredCamPos = new THREE.Vector3(
        traj.x + offset.x,
        traj.y + offset.y,
        traj.z + offset.z
      );

      const lookAhead = new THREE.Vector3(3.5, 0.4, 0);
      lookAhead.applyAxisAngle(new THREE.Vector3(0, 1, 0), traj.rotationY);

      this.camera.position.lerp(desiredCamPos, 0.12);
      this.controls.target.set(traj.x + lookAhead.x, traj.y + lookAhead.y, traj.z + lookAhead.z);
      this.controls.update();
    }

    notifyUpdate() {
      if (this.onUpdate) {
        this.onUpdate({
          mode: this.mode,
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
  }

  window.SimulationController = SimulationController;
})();
