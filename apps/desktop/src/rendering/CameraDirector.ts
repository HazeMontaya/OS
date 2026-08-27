import type { CameraMode, WorkspaceDefinition } from "@os/visualization";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Canonical spatial camera state machine.
 *
 * The camera is intentionally stateful and independent from React render cadence. User gestures
 * immediately switch the director to FREE mode, while explicit OS navigation can select a semantic
 * mode again. This prevents autonomous camera motion from fighting direct manipulation.
 */
export class CameraDirector {
  private mode: CameraMode;
  private desiredTarget = Vector3.Zero();
  private desiredRadius: number;
  private focusTarget: Vector3 | null = null;
  private focusRadius: number | null = null;

  constructor(workspace: WorkspaceDefinition) {
    this.mode = workspace.preferredCamera;
    this.desiredRadius = workspace.cameraRadius;
  }

  get currentMode(): CameraMode {
    return this.mode;
  }

  setWorkspace(workspace: WorkspaceDefinition) {
    this.mode = workspace.preferredCamera;
    this.focusTarget = null;
    this.focusRadius = null;
    this.desiredTarget.copyFromFloats(0, 0, 0);
    this.desiredRadius = workspace.cameraRadius;
  }

  setMode(mode: CameraMode, workspace: WorkspaceDefinition) {
    this.mode = mode;
    if (mode === "FREE") return;

    if (mode === "OVERVIEW" || mode === "CINEMATIC") {
      this.focusTarget = null;
      this.focusRadius = null;
      this.desiredTarget.copyFromFloats(0, 0, 0);
      this.desiredRadius = workspace.cameraRadius;
      return;
    }

    if (!this.focusTarget) {
      this.desiredTarget.copyFromFloats(0, 0, 0);
      this.desiredRadius = workspace.cameraRadius;
    }
  }

  focus(target: Vector3, radius: number) {
    this.mode = "FOCUS";
    this.focusTarget = target.clone();
    this.focusRadius = radius;
    this.desiredTarget.copyFrom(target);
    this.desiredRadius = radius;
  }

  follow(target: Vector3, radius: number) {
    this.mode = "FOLLOW";
    this.focusTarget = target.clone();
    this.focusRadius = radius;
    this.desiredTarget.copyFrom(target);
    this.desiredRadius = radius;
  }

  overview(workspace: WorkspaceDefinition) {
    this.mode = "OVERVIEW";
    this.focusTarget = null;
    this.focusRadius = null;
    this.desiredTarget.copyFromFloats(0, 0, 0);
    this.desiredRadius = workspace.cameraRadius;
  }

  userControl() {
    this.mode = "FREE";
  }

  tick(
    camera: ArcRotateCamera,
    workspace: WorkspaceDefinition,
    timeSeconds: number,
    motion: number,
    reducedMotion: boolean,
    activity: number,
  ) {
    if (this.mode === "FREE") return;

    const movement = reducedMotion ? 0 : Math.max(0, motion);
    const activityEnergy = Math.min(1.8, Math.max(0, activity * 0.035));

    switch (this.mode) {
      case "FOCUS": {
        if (this.focusTarget) this.desiredTarget.copyFrom(this.focusTarget);
        this.desiredRadius = this.focusRadius ?? Math.max(4.2, workspace.cameraRadius * 0.34);
        camera.alpha += workspace.orbitalVelocity * 0.38 * movement;
        const betaTarget = Math.PI / 2.42 + Math.sin(timeSeconds * 0.19) * 0.035 * movement;
        camera.beta += (betaTarget - camera.beta) * (reducedMotion ? 0.16 : 0.035);
        break;
      }
      case "FOLLOW": {
        if (this.focusTarget) this.desiredTarget.copyFrom(this.focusTarget);
        this.desiredRadius = this.focusRadius ?? Math.max(6.4, workspace.cameraRadius * 0.48);
        camera.alpha += workspace.orbitalVelocity * (1.55 + activityEnergy * 0.55) * movement;
        const betaTarget = Math.PI / 2.55 + Math.sin(timeSeconds * 0.34 + activityEnergy) * 0.075 * movement;
        camera.beta += (betaTarget - camera.beta) * (reducedMotion ? 0.18 : 0.048);
        break;
      }
      case "TRACE": {
        this.desiredTarget.copyFrom(this.focusTarget ?? Vector3.Zero());
        this.desiredRadius = this.focusRadius ?? Math.max(8, workspace.cameraRadius * 0.76);
        camera.alpha += workspace.orbitalVelocity * (2.2 + activityEnergy) * movement;
        const betaTarget = Math.PI / 2.2 + Math.sin(timeSeconds * 0.52) * 0.11 * movement;
        camera.beta += (betaTarget - camera.beta) * (reducedMotion ? 0.18 : 0.055);
        break;
      }
      case "OVERVIEW": {
        this.desiredTarget.copyFromFloats(0, 0, 0);
        this.desiredRadius = workspace.cameraRadius;
        camera.alpha += workspace.orbitalVelocity * 0.72 * movement;
        const betaTarget = Math.PI / 2.34;
        camera.beta += (betaTarget - camera.beta) * (reducedMotion ? 0.18 : 0.025);
        break;
      }
      case "CINEMATIC": {
        this.desiredTarget.copyFrom(this.focusTarget ?? Vector3.Zero());
        const breathing = 1 + Math.sin(timeSeconds * 0.16) * 0.045 * movement;
        this.desiredRadius = (this.focusRadius ?? workspace.cameraRadius) * breathing;
        camera.alpha += workspace.orbitalVelocity * 0.52 * movement;
        const betaTarget = Math.PI / 2.48 + Math.sin(timeSeconds * 0.12) * 0.16 * movement;
        camera.beta += (betaTarget - camera.beta) * (reducedMotion ? 0.16 : 0.018);
        break;
      }
      default:
        break;
    }

    const targetBlend = reducedMotion ? 0.24 : this.mode === "TRACE" ? 0.095 : 0.068;
    Vector3.LerpToRef(camera.target, this.desiredTarget, targetBlend, camera.target);

    const radiusBlend = reducedMotion ? 0.28 : this.mode === "CINEMATIC" ? 0.024 : 0.075;
    camera.radius += (this.desiredRadius - camera.radius) * radiusBlend;
  }
}
