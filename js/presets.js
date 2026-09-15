/**
 * MP2000 Pallet Verifier - Regional Presets Database
 * Compatible with both local file:/// execution and web hosting.
 */

window.PALLET_PRESETS = [
  // --- MALAYSIA ---
  {
    id: 'my_chep_wood',
    country: 'Malaysia',
    flag: '[MY]',
    name: 'Malaysia MS 1200 / CHEP Pool Pallet',
    standard: 'MS 1200 / MS ISO 6780',
    description: 'Standard 4-way full perimeter wooden block pallet used by CHEP, Loscam, and FMCG retail across Malaysia.',
    dimensions: { length: 1200, width: 1000, height: 162 },
    openings: { W1: 760, W2: 145, Ch: 100 },
    type: 'perimeter', // 'perimeter' (Tian), 'three_runner' (Chuan), 'stringer', 'reversible', 'notched'
    material: 'wood',  // 'wood', 'plastic'
    color: '#1E3A8A',  // CHEP Blue
    woodTone: '#8B5A2B',
    tareWeight: 28,
    maxLoad: 2000
  },
  {
    id: 'my_penang_plastic',
    country: 'Malaysia',
    flag: '[MY]',
    name: 'Penang Electronics / Cleanroom Pallet',
    standard: 'JIS / Asian Standard',
    description: 'Square heavy-duty perimeter plastic block pallet widely deployed in Penang and Johor semiconductor manufacturing.',
    dimensions: { length: 1100, width: 1100, height: 150 },
    openings: { W1: 720, W2: 195, Ch: 95 },
    type: 'perimeter',
    material: 'plastic',
    color: '#0284C7', // Cleanroom Cyan
    tareWeight: 16,
    maxLoad: 1500
  },

  // --- SINGAPORE ---
  {
    id: 'sg_asrs_wood',
    country: 'Singapore',
    flag: '[SG]',
    name: 'Singapore SS 334 / Loscam Pool Pallet',
    standard: 'SS 334 / ISO 6780',
    description: 'Heavy-duty 4-way wooden perimeter pallet used in Singapore cold chain, FMCG, and high-bay ASRS.',
    dimensions: { length: 1200, width: 1000, height: 162 },
    openings: { W1: 760, W2: 145, Ch: 100 },
    type: 'perimeter',
    material: 'wood',
    color: '#D97706', // Loscam Yellow-Orange
    woodTone: '#92400E',
    tareWeight: 30,
    maxLoad: 2000
  },
  {
    id: 'sg_jurong_chem',
    country: 'Singapore',
    flag: '[SG]',
    name: 'Jurong Island Petrochemical Pallet',
    standard: 'ISO 6780 / Chemical Standard',
    description: 'Heavy-duty 3-runner anti-static black HDPE plastic pallet for resin bags and chemical drumming.',
    dimensions: { length: 1100, width: 1100, height: 150 },
    openings: { W1: 790, W2: 160, Ch: 100 },
    type: 'three_runner',
    material: 'plastic',
    color: '#1E293B', // Dark Carbon/Antistatic Black
    tareWeight: 20,
    maxLoad: 2000
  },

  // --- PHILIPPINES ---
  {
    id: 'ph_fmcg_wood',
    country: 'Philippines',
    flag: '[PH]',
    name: 'Philippines FMCG Standard (Loscam)',
    standard: 'PNS ISO 6780',
    description: 'Dominant 4-way wooden block pallet deployed across Philippine retail distribution (San Miguel, SM Markets).',
    dimensions: { length: 1200, width: 1000, height: 150 },
    openings: { W1: 750, W2: 145, Ch: 95 },
    type: 'perimeter',
    material: 'wood',
    color: '#DC2626', // Loscam Red
    woodTone: '#78350F',
    tareWeight: 28,
    maxLoad: 2000
  },
  {
    id: 'ph_gma_legacy',
    country: 'Philippines',
    flag: '[PH]',
    name: 'Philippines US-Legacy Stringer Pallet',
    standard: 'ANSI MH1 / GMA Legacy',
    description: 'Notched timber stringer pallet common in legacy US manufacturing plants in Laguna and Subic.',
    dimensions: { length: 1219, width: 1016, height: 121 },
    openings: { W1: 940, W2: 38, Ch: 89 },
    type: 'stringer',
    material: 'wood',
    color: '#A16207',
    woodTone: '#A16207',
    tareWeight: 20,
    maxLoad: 1500
  },

  // --- CHINA (GB/T 2934-2007) ---
  {
    id: 'cn_gb_tian_1210',
    country: 'China',
    flag: '[CN]',
    name: 'China GB/T 2934 Standard 1 (Tian 田-Type)',
    standard: 'GB/T 2934-2007 (Priority 1)',
    description: 'National standard closed-bottom (Tian 田) perimeter plastic pallet for e-commerce (Cainiao, JD Logistics).',
    dimensions: { length: 1200, width: 1000, height: 150 },
    openings: { W1: 760, W2: 140, Ch: 100 },
    type: 'perimeter',
    material: 'plastic',
    color: '#2563EB', // Logistics Royal Blue
    tareWeight: 18,
    maxLoad: 2000
  },
  {
    id: 'cn_gb_chuan_1210',
    country: 'China',
    flag: '[CN]',
    name: 'China GB/T 2934 Standard 1 (Chuan 川-Type)',
    standard: 'GB/T 2934-2007 (Priority 1)',
    description: 'National standard open-bottom (Chuan 川) 3-runner pallet. Ideal for pallet truck AMR ground transport.',
    dimensions: { length: 1200, width: 1000, height: 150 },
    openings: { W1: 780, W2: 140, Ch: 100 },
    type: 'three_runner',
    material: 'plastic',
    color: '#0284C7',
    tareWeight: 17,
    maxLoad: 2000
  },
  {
    id: 'cn_gb_tian_1111',
    country: 'China',
    flag: '[CN]',
    name: 'China GB/T 2934 Standard 2 (Tian 田-Type Block)',
    standard: 'GB/T 2934-2007 (Pudu Slide Benchmark)',
    description: '1.1m square block plastic pallet. Center block W2 = 195mm (Mandatory 620mm Model only!).',
    dimensions: { length: 1100, width: 1100, height: 150 },
    openings: { W1: 720, W2: 195, Ch: 95 },
    type: 'perimeter',
    material: 'plastic',
    color: '#0D9488', // Teal Plastic
    tareWeight: 16,
    maxLoad: 1500
  },
  {
    id: 'cn_gb_chuan_1111',
    country: 'China',
    flag: '[CN]',
    name: 'China GB/T 2934 Standard 2 (Chuan 川-Type Stringer)',
    standard: 'GB/T 2934-2007 (Pudu Slide Benchmark)',
    description: '1.1m square 3-runner plastic stringer pallet. Center stringer W2 = 160mm (Fits both 550 and 620).',
    dimensions: { length: 1100, width: 1100, height: 150 },
    openings: { W1: 790, W2: 160, Ch: 95 },
    type: 'three_runner',
    material: 'plastic',
    color: '#0369A1',
    tareWeight: 15,
    maxLoad: 1500
  },

  // --- EUROPE (EPAL / UIC) ---
  {
    id: 'eu_epal1_800',
    country: 'Europe',
    flag: '[EU]',
    name: 'Euro Pallet EPAL 1 (800mm Face Entry)',
    standard: 'EN 13698-1 / UIC 435-2 (Pudu Slide Benchmark)',
    description: 'European standard 3-runner timber pallet. Outer opening W1 = 600mm. Mandates WPID01-N (550mm) model!',
    dimensions: { length: 1200, width: 800, height: 144 },
    openings: { W1: 600, W2: 145, Ch: 100 },
    type: 'three_runner',
    material: 'wood',
    color: '#D97706',
    woodTone: '#D97706',
    tareWeight: 25,
    maxLoad: 1500
  },
  {
    id: 'eu_epal2_1210',
    country: 'Europe',
    flag: '[EU]',
    name: 'Euro Pallet EPAL 2 (Full Perimeter)',
    standard: 'EN 13698-2',
    description: 'Heavy industrial European pallet with complete bottom perimeter framework.',
    dimensions: { length: 1200, width: 1000, height: 162 },
    openings: { W1: 760, W2: 145, Ch: 100 },
    type: 'perimeter',
    material: 'wood',
    color: '#B45309',
    woodTone: '#B45309',
    tareWeight: 35,
    maxLoad: 2000
  },

  // --- NORTH AMERICA ---
  {
    id: 'us_gma_40end',
    country: 'United States / Canada',
    flag: '[US]',
    name: 'North American GMA Standard (40" End Entry)',
    standard: 'ANSI MH1 / GMA 48x40',
    description: '3-stringer timber pallet entering from 40" stringer ends. Full 89mm under-deck clearance.',
    dimensions: { length: 1219, width: 1016, height: 121 },
    openings: { W1: 940, W2: 38, Ch: 89 },
    type: 'stringer',
    material: 'wood',
    color: '#9A3412',
    woodTone: '#9A3412',
    tareWeight: 22,
    maxLoad: 1800
  },
  {
    id: 'us_gma_48side',
    country: 'United States / Canada',
    flag: '[US]',
    name: 'North American GMA (48" Notched Side Entry)',
    standard: 'ANSI MH1 / GMA 48x40 (Side Notches)',
    description: 'Side entry through cut-out notches. Notch height is only 32mm - collision failure with 80mm lowered forks!',
    dimensions: { length: 1016, width: 1219, height: 121 },
    openings: { W1: 800, W2: 38, Ch: 32 },
    type: 'notched',
    material: 'wood',
    color: '#B91C1C',
    woodTone: '#9A3412',
    tareWeight: 22,
    maxLoad: 1800
  },

  // --- SPECIAL FAILURE DEMONSTRATIONS ---
  {
    id: 'special_reversible',
    country: 'Heavy Industry',
    flag: '[REV]',
    name: 'Reversible Double-Deck Pallet (Double-Sided)',
    standard: 'ISO 6780 / Industrial Reversible',
    description: 'Identical top and bottom decks with zero wheel openings. Strictly incompatible with ground-wheel AMRs.',
    dimensions: { length: 1200, width: 1000, height: 150 },
    openings: { W1: 760, W2: 140, Ch: 95 },
    type: 'reversible',
    material: 'plastic',
    color: '#475569',
    tareWeight: 24,
    maxLoad: 2500
  },
  {
    id: 'special_sagged',
    country: 'Damaged / Overloaded',
    flag: '[DEF]',
    name: 'Over-Sagged Deflected Pallet (>35mm Sag)',
    standard: 'Failed ISO 8611 Deflection Limit',
    description: 'Heavily overloaded/damp timber pallet. Under-deck opening sagged down to 60mm (blocks 80mm forks).',
    dimensions: { length: 1200, width: 1000, height: 130 },
    openings: { W1: 760, W2: 145, Ch: 60 },
    type: 'perimeter',
    material: 'wood',
    color: '#7F1D1D',
    woodTone: '#581C87',
    tareWeight: 26,
    maxLoad: 1000
  }
];
