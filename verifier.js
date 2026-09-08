/**
 * MP2000 Pallet Verifier - Mathematical Verification Engine
 * Implements official Pudu Robotics formula criteria:
 *   Criteria 1: W1 >= B1 + 40 mm (Outer Opening Clearance)
 *   Criteria 2: W2 <= B2 - 40 mm (Inner Center Block Clearance)
 *   Criteria 3: Ch >= 85 mm (Under-deck vertical clearance for 80mm lowered forks)
 *   Criteria 4: Bottom-deck kinematics (tandem climbing vs reversible lock)
 */

window.PUDU_MODELS = {
  'WPID01-N': {
    code: 'WPID01-N',
    marketingName: 'PUDU MP2000 Narrow Fork',
    shortName: 'Narrow (550mm)',
    B1: 550, // Outer fork spacing (mm)
    B2: 230, // Inner fork spacing (mm)
    tineWidth: 160,
    loweredHeight: 80,
    maxLift: 200,
    maxPayload: 2000,
    badgeColor: '#06B6D4',
    idealPallets: ['1.2 x 0.8m (EPAL 1)', 'Three-runner pallets', 'Narrow aisles']
  },
  'WPID01-M': {
    code: 'WPID01-M',
    marketingName: 'PUDU MP2000 Standard',
    shortName: 'Standard (620mm)',
    B1: 620, // Outer fork spacing (mm)
    B2: 300, // Inner fork spacing (mm)
    tineWidth: 160,
    loweredHeight: 80,
    maxLift: 200,
    maxPayload: 2000,
    badgeColor: '#3B82F6',
    idealPallets: ['1.2 x 1.0m (Perimeter/Stringer)', '1.1 x 1.1m (Block/Tian)', 'GMA 48x40 (40" End)']
  }
};

/**
 * Evaluates a single PUDU model against pallet dimensions.
 */
window.evaluateModel = function(modelCode, pallet) {
  const model = window.PUDU_MODELS[modelCode];
  if (!model) throw new Error(`Unknown model code: ${modelCode}`);

  const B1 = model.B1;
  const B2 = model.B2;
  const Hf = model.loweredHeight;

  const W1 = Number(pallet.openings?.W1 ?? 760);
  const W2 = Number(pallet.openings?.W2 ?? 145);
  const Ch = Number(pallet.openings?.Ch ?? 100);
  const type = pallet.type || 'perimeter';

  // Criteria 1: Outer Opening Clearance
  // W1 >= B1 + 40 mm
  const outerRequired = B1 + 40;
  const outerDelta = W1 - outerRequired;
  const outerPass = W1 >= outerRequired;
  const outerMarginPerSide = Math.round((W1 - B1) / 2);

  // Criteria 2: Inner Center Block Clearance
  // W2 <= B2 - 40 mm
  const innerRequired = B2 - 40;
  const innerDelta = innerRequired - W2;
  const innerPass = W2 <= innerRequired;
  const innerMarginPerSide = Math.round((B2 - W2) / 2);

  // Criteria 3: Vertical Fork Height Clearance
  // Ch >= Hf + 5 mm (Minimum 5mm safety gap)
  const minRequiredHeight = Hf + 5; // 85 mm
  const heightDelta = Ch - minRequiredHeight;
  const heightPass = Ch >= minRequiredHeight;

  // Criteria 4: Bottom Deckboard Kinematics
  let bottomDeckPass = true;
  let bottomDeckReason = 'Open under-channels allow unrestricted travel.';

  if (type === 'reversible') {
    bottomDeckPass = false;
    bottomDeckReason = 'FATAL: Reversible solid bottom deck blocks AMR load wheels from deploying onto the floor.';
  } else if (type === 'notched' && Ch < 85) {
    bottomDeckPass = false;
    bottomDeckReason = `FATAL: 48" Notched side entry height (${Ch}mm) is lower than the MP2000 lowered fork height (80mm).`;
  } else if (type === 'perimeter') {
    bottomDeckPass = true;
    bottomDeckReason = 'Compatible: PUDU MP2000 tandem climbing rollers safely traverse bottom crossboards (chamfered lead-in recommended).';
  }

  // Determine overall status
  const isPhysicallyCompatible = outerPass && innerPass && heightPass && bottomDeckPass;

  // Collision Point Analysis (for 3D simulation)
  let collisionPoint = null;
  let failureReasons = [];

  if (!outerPass) {
    collisionPoint = 'OUTER_BLOCKS';
    failureReasons.push(`Outer opening (${W1}mm) is smaller than required B1 + 40mm (${outerRequired}mm). Outer forks collide with corner blocks by ${Math.abs(outerDelta)}mm.`);
  }
  if (!innerPass) {
    collisionPoint = collisionPoint ? 'MULTI_COLLISION' : 'CENTER_BLOCK';
    failureReasons.push(`Center block/stringer (${W2}mm) exceeds B2 - 40mm (${innerRequired}mm). Inner fork edges crash into center block by ${Math.abs(innerDelta)}mm.`);
  }
  if (!heightPass) {
    collisionPoint = 'HEIGHT_COLLISION';
    failureReasons.push(`Under-deck height (${Ch}mm) is below the required 85mm for 80mm lowered forks.`);
  }
  if (!bottomDeckPass) {
    collisionPoint = type === 'reversible' ? 'SOLID_BOTTOM' : 'NOTCH_TOO_LOW';
    failureReasons.push(bottomDeckReason);
  }

  return {
    modelCode,
    modelName: model.marketingName,
    isCompatible: isPhysicallyCompatible,
    collisionPoint,
    failureReasons,
    metrics: {
      outer: {
        W1,
        B1,
        outerRequired,
        pass: outerPass,
        delta: outerDelta,
        marginPerSide: outerMarginPerSide
      },
      inner: {
        W2,
        B2,
        innerRequired,
        pass: innerPass,
        delta: innerDelta,
        marginPerSide: innerMarginPerSide
      },
      height: {
        Ch,
        Hf,
        minRequiredHeight,
        pass: heightPass,
        delta: heightDelta
      },
      bottomDeck: {
        type,
        pass: bottomDeckPass,
        notes: bottomDeckReason
      }
    }
  };
};

/**
 * Comparative evaluation: compares both WPID01-N and WPID01-M against a pallet.
 */
window.evaluatePalletComparative = function(pallet) {
  const evalN = window.evaluateModel('WPID01-N', pallet);
  const evalM = window.evaluateModel('WPID01-M', pallet);

  const palletWidth = Number(pallet.dimensions?.width ?? 1000);

  let verdictM = { status: 'UNKNOWN', badge: '', explanation: '' };
  let verdictN = { status: 'UNKNOWN', badge: '', explanation: '' };

  if (evalM.isCompatible && evalN.isCompatible) {
    if (palletWidth >= 1000) {
      verdictM = {
        status: 'PREFERRED',
        badge: 'PREFERRED (RECOMMENDED)',
        badgeClass: 'badge-preferred',
        explanation: 'OPTIMAL: Wider 620mm fork spacing maximizes lateral stability and minimizes pallet sagging/deformation on 1000mm+ loads.'
      };
      verdictN = {
        status: 'SUBOPTIMAL',
        badge: 'COMPATIBLE (SUBOPTIMAL)',
        badgeClass: 'badge-caution',
        explanation: 'ACCEPTABLE: Physically fits pockets, but leaves larger side overhang (225mm+). Recommended only if fleet must share EPAL 1 pallets.'
      };
    } else {
      verdictN = {
        status: 'PREFERRED',
        badge: 'PREFERRED',
        badgeClass: 'badge-preferred',
        explanation: 'OPTIMAL fit for sub-1000mm width.'
      };
      verdictM = {
        status: 'COMPATIBLE',
        badge: 'COMPATIBLE',
        badgeClass: 'badge-pass',
        explanation: 'Physically fits.'
      };
    }
  } else if (evalM.isCompatible && !evalN.isCompatible) {
    verdictM = {
      status: 'EXCLUSIVE',
      badge: 'MANDATORY EXCLUSIVE',
      badgeClass: 'badge-exclusive',
      explanation: `MANDATORY: WPID01-M is the ONLY model that fits! Center block (${pallet.openings?.W2}mm) exceeds the 550mm model limit (190mm).`
    };
    verdictN = {
      status: 'INCOMPATIBLE',
      badge: 'INCOMPATIBLE',
      badgeClass: 'badge-fail',
      explanation: evalN.failureReasons[0] || 'Inner center block collision.'
    };
  } else if (!evalM.isCompatible && evalN.isCompatible) {
    verdictN = {
      status: 'EXCLUSIVE',
      badge: 'MANDATORY EXCLUSIVE',
      badgeClass: 'badge-exclusive',
      explanation: `MANDATORY: WPID01-N is the ONLY model that fits! Outer opening (${pallet.openings?.W1}mm) is narrower than 620mm model requirements.`
    };
    verdictM = {
      status: 'INCOMPATIBLE',
      badge: 'INCOMPATIBLE',
      badgeClass: 'badge-fail',
      explanation: evalM.failureReasons[0] || 'Outer fork boundary collision.'
    };
  } else {
    verdictM = {
      status: 'INCOMPATIBLE',
      badge: 'INCOMPATIBLE',
      badgeClass: 'badge-fail',
      explanation: evalM.failureReasons[0] || 'Pallet geometry incompatible.'
    };
    verdictN = {
      status: 'INCOMPATIBLE',
      badge: 'INCOMPATIBLE',
      badgeClass: 'badge-fail',
      explanation: evalN.failureReasons[0] || 'Pallet geometry incompatible.'
    };
  }

  return {
    evalN: { ...evalN, verdict: verdictN },
    evalM: { ...evalM, verdict: verdictM }
  };
};
