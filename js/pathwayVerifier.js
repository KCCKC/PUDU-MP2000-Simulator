/**
 * MP2000 Pallet Verifier - Pathway & Aisle Feasibility Verification Engine
 *
 * Implements official PUDU MP2000 kinematics & DIN EN ISO 3691-4 safety criteria:
 * - Bare Vehicle:
 *     • Bounding footprint: 1,585 mm (L) x 910 mm (W) x 1,870 mm (H)
 *     • Minimum passability corridor: 1,100 mm (1.1 m)
 *     • Minimum pivot turning radius: 1,350 mm (1.35 m)
 * - Loaded with Pallet (2,000 kg):
 *     • 1200 x 1000 mm: Ast <= 2,000 mm (R_min = 2.00 m)
 *     • 1200 x 800 mm:  Ast <= 1,960 mm (R_min = 1.96 m)
 *     • Custom pallets: Dynamic diagonal kinematic formulation
 * - Safety Buffer (DIN EN ISO 3691-4):
 *     • Mandates +200 mm clearance per side (+400 mm total aisle width)
 *     • Recommended Transit Aisle: >= 2,400 mm for unthrottled 1.6 m/s transit
 */

(function() {
  class PathwayVerifier {
    /**
     * Evaluates feasibility of a custom pathway
     * @param {Object} params
     *   - pathwayLength: meters (e.g. 8.0)
     *   - pathwayWidth: millimeters (e.g. 2200)
     *   - maneuverType: 'straight' | 'turn90' | 'turn180'
     *   - isLoaded: boolean
     *   - palletData: { dimensions: { length, width, height }, name }
     *   - modelCode: 'WPID01-M' | 'WPID01-N'
     * @returns {Object} evaluation metrics and verdicts
     */
    static evaluate(params) {
      const L_path = Number(params.pathwayLength ?? 8.0);
      const W_aisle = Number(params.pathwayWidth ?? 2200);
      const maneuver = params.maneuverType || 'straight';
      const isLoaded = Boolean(params.isLoaded);
      const pallet = params.palletData || { dimensions: { length: 1200, width: 1000, height: 162 } };
      const modelCode = params.modelCode || 'WPID01-M';

      const pL = Number(pallet.dimensions?.length ?? 1200);
      const pW = Number(pallet.dimensions?.width ?? 1000);

      // Vehicle baseline constants (PUDU MP2000 Official)
      const VEHICLE_WIDTH = 910;       // mm
      const VEHICLE_LENGTH = 1585;     // mm
      const BARE_PASSABILITY = 1100;   // mm
      const BARE_TURNING_R = 1350;     // mm
      const SAFETY_BUFFER_PER_SIDE = 200; // mm (ISO 3691-4)

      // Effective envelope width and length
      const effectiveWidth = isLoaded ? Math.max(VEHICLE_WIDTH, pW) : VEHICLE_WIDTH;
      const effectiveLength = isLoaded ? Math.round(VEHICLE_LENGTH + (pL * 0.42)) : VEHICLE_LENGTH;

      // Calculate required turning radius and stacking aisle (Ast)
      let turningRadius;
      let astMin;

      if (!isLoaded) {
        turningRadius = BARE_TURNING_R;
        astMin = 1500; // bare robot 90° stacking aisle
      } else {
        if (pL === 1200 && pW === 1000) {
          turningRadius = 2000;
          astMin = 2000;
        } else if (pL === 1200 && pW === 800) {
          turningRadius = 1960;
          astMin = 1960;
        } else {
          // Dynamic calibration for custom pallet dimensions
          const pivotToFront = 1850 + (pL - 1200);
          const halfWidth = pW / 2;
          const rawRadius = Math.sqrt(pivotToFront * pivotToFront + halfWidth * halfWidth);
          turningRadius = Math.max(1480, Math.round(rawRadius * 1.043));
          astMin = turningRadius;
        }
      }

      // Calculations based on maneuver type
      let minRequiredWidth;
      let recommendedWidth;
      let sideMargin;
      let isFeasible = true;
      let isMarginal = false;
      let collisionPoint = null;
      let maxSafeSpeed = 1.6; // m/s
      let verdictCode = 'FEASIBLE_OPTIMAL';
      let verdictTitle = 'FEASIBLE (OPTIMAL)';
      let verdictDesc = '';

      if (maneuver === 'straight') {
        // Straight corridor pass-through
        minRequiredWidth = isLoaded ? (effectiveWidth + 100) : BARE_PASSABILITY;
        recommendedWidth = effectiveWidth + (SAFETY_BUFFER_PER_SIDE * 2);
        sideMargin = Math.round((W_aisle - effectiveWidth) / 2);

        if (W_aisle < effectiveWidth) {
          isFeasible = false;
          collisionPoint = 'Corridor Entrance Collision';
          maxSafeSpeed = 0.0;
          verdictCode = 'INFEASIBLE_COLLISION';
          verdictTitle = 'INFEASIBLE (COLLISION)';
          verdictDesc = `Pathway width (${W_aisle}mm) is narrower than the transport envelope (${effectiveWidth}mm). Direct structural collision.`;
        } else if (W_aisle < minRequiredWidth) {
          isFeasible = false;
          collisionPoint = 'Lateral Clearance Hazard';
          maxSafeSpeed = 0.0;
          verdictCode = 'INFEASIBLE_TIGHT';
          verdictTitle = 'INFEASIBLE (UNSAFE CLEARANCE)';
          verdictDesc = `Pathway width (${W_aisle}mm) violates minimum operational tolerance (${minRequiredWidth}mm). Side margin < 50mm.`;
        } else if (W_aisle < recommendedWidth) {
          isFeasible = true;
          isMarginal = true;
          maxSafeSpeed = 0.8;
          verdictCode = 'FEASIBLE_MARGINAL';
          verdictTitle = 'FEASIBLE (REDUCED SPEED)';
          verdictDesc = `Passable with side margin of ${sideMargin}mm per side. Fails ISO 3691-4 (+200mm) buffer; vehicle will operate at restricted 0.8 m/s speed.`;
        } else {
          isFeasible = true;
          isMarginal = false;
          maxSafeSpeed = 1.6;
          verdictCode = 'FEASIBLE_OPTIMAL';
          verdictTitle = 'FEASIBLE (FULL SPEED)';
          verdictDesc = `Complies with DIN EN ISO 3691-4. Generous side margin of ${sideMargin}mm per side supports unthrottled 1.6 m/s transit.`;
        }
      } else if (maneuver === 'turn90') {
        // 90° Stacking Turn / L-Turn
        minRequiredWidth = astMin;
        recommendedWidth = astMin + (SAFETY_BUFFER_PER_SIDE * 2);
        sideMargin = Math.round((W_aisle - astMin) / 2);

        if (W_aisle < astMin) {
          isFeasible = false;
          collisionPoint = 'Corner Sweep Impact';
          maxSafeSpeed = 0.0;
          verdictCode = 'INFEASIBLE_COLLISION';
          verdictTitle = 'INFEASIBLE (TURNING COLLISION)';
          verdictDesc = `Pathway width (${W_aisle}mm) is less than required 90° stacking aisle Ast (${astMin}mm). Corner sweep will collide with boundary wall.`;
        } else if (W_aisle < recommendedWidth) {
          isFeasible = true;
          isMarginal = true;
          maxSafeSpeed = 0.6;
          verdictCode = 'FEASIBLE_MARGINAL';
          verdictTitle = 'FEASIBLE (TIGHT TURN)';
          verdictDesc = `Sufficient for 90° turn within official Ast limit (${astMin}mm), but lacks ISO 3691-4 buffer (${recommendedWidth}mm). Slow cornering speed mandated.`;
        } else {
          isFeasible = true;
          isMarginal = false;
          maxSafeSpeed = 1.2;
          verdictCode = 'FEASIBLE_OPTIMAL';
          verdictTitle = 'FEASIBLE (OPTIMAL TURN)';
          verdictDesc = `Meets ISO 3691-4 safety envelope (Safe Aisle >= ${recommendedWidth}mm). Vehicle executes full-speed autonomous pivot turn.`;
        }
      } else if (maneuver === 'turn180') {
        // 180° U-Turn turnaround
        minRequiredWidth = turningRadius * 2;
        recommendedWidth = minRequiredWidth + (SAFETY_BUFFER_PER_SIDE * 2);
        sideMargin = Math.round((W_aisle - minRequiredWidth) / 2);

        if (W_aisle < minRequiredWidth) {
          isFeasible = false;
          collisionPoint = 'U-Turn Boundary Impact';
          maxSafeSpeed = 0.0;
          verdictCode = 'INFEASIBLE_COLLISION';
          verdictTitle = 'INFEASIBLE (U-TURN COLLISION)';
          verdictDesc = `U-Turn sweep diameter (${minRequiredWidth}mm) exceeds pathway width (${W_aisle}mm). Turnaround physically impossible without multi-point reversing.`;
        } else if (W_aisle < recommendedWidth) {
          isFeasible = true;
          isMarginal = true;
          maxSafeSpeed = 0.5;
          verdictCode = 'FEASIBLE_MARGINAL';
          verdictTitle = 'FEASIBLE (RESTRICTED U-TURN)';
          verdictDesc = `Continuous 180° pivot achievable (${minRequiredWidth}mm sweep), but requires low-speed safety supervision.`;
        } else {
          isFeasible = true;
          isMarginal = false;
          maxSafeSpeed = 1.0;
          verdictCode = 'FEASIBLE_OPTIMAL';
          verdictTitle = 'FEASIBLE (OPTIMAL U-TURN)';
          verdictDesc = `Turnaround zone width (${W_aisle}mm) satisfies full ISO safety envelope for 180° continuous pivot.`;
        }
      }

      return {
        pathwayLengthMeters: L_path,
        pathwayWidthMm: W_aisle,
        maneuverType: maneuver,
        isLoaded: isLoaded,
        modelCode: modelCode,
        effectiveWidthMm: effectiveWidth,
        effectiveLengthMm: effectiveLength,
        turningRadiusMm: turningRadius,
        minRequiredWidthMm: minRequiredWidth,
        recommendedWidthMm: recommendedWidth,
        sideMarginMm: sideMargin,
        isFeasible: isFeasible,
        isMarginal: isMarginal,
        collisionPoint: collisionPoint,
        maxSafeSpeedMs: maxSafeSpeed,
        verdictCode: verdictCode,
        verdictTitle: verdictTitle,
        verdictDesc: verdictDesc
      };
    }
  }

  window.PathwayVerifier = PathwayVerifier;
})();
