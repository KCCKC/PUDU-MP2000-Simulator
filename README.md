# MP2000 Pallet Verifier & Pathway Transit Simulator

> **Interactive 3D Simulation & Feasibility Engine for the PUDU MP2000 Autonomous Forklift Robot**

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?logo=github)](https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?logo=three.js)](https://threejs.org/)
[![PUDU Robotics](https://img.shields.io/badge/PUDU-MP2000%20AI--Native-06b6d4)](https://www.pudurobotics.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An interactive, client-side 3D simulation tool and engineering verifier designed to validate regional pallet standards and custom warehouse pathways against the **PUDU MP2000** AI-native autonomous mobile robot (AMR). It tests entry clearances, calculates mathematical margins, simulates 3.0-second pallet docking and 5.0-second custom corridor transit, and provides live CAD measurement calipers.

---

## Key Features

* **Dual Simulation Operations:**
  * **Pallet Docking Mode (3s):** 3.0-second realistic fork insertion and hydraulic lifting into regional pallets.
  * **Pathway Transit Mode (5s):** 5.0-second dynamic corridor navigation with S-curve acceleration, cruising, deceleration, and turning sweep across custom straight, 90-degree L-turns, and 180-degree turnaround corridors.
* **Authentic 3D CAD Model (`MP2000-optimized.glb`):** High-fidelity model with baked PBR materials, Draco mesh compression, and photorealistic textures.
* **Realistic Fork-Only Hydraulic Elevation:** The robot chassis, drive wheels, and LiDAR mast stay firmly parked on the floor, while only the fork carriage and pallet elevate smoothly up to $120\text{ mm}$.
* **Zero-Overlap Kinematics:** Calibrated insertion limits maintain a realistic $50\text{ mm}$ safety gap between the robot mast and pallet entrance—preventing visual clipping or overlapping.
* **Multi-Angle CAD Camera Selectors (All 5 View Modes in 3s & 5s Simulations):**
  * **Hero Orbit:** Dynamic sweeping 3/4 commercial view with intelligent vehicle tracking.
  * **Top CAD:** Overhead blueprint plan view of fork/corridor alignment (gimbal-lock free).
  * **Front View:** Elevated forward perspective looking directly along aisle navigation vectors.
  * **Side CAD:** Side profile elevation for vertical pocket clearance and corridor span.
  * **Free 3D:** Unconstrained 360-degree mouse navigation with auto-detecting orbit damping.
* **Custom Pathway Feasibility Engine:** Evaluates user-defined corridor length ($3\text{m} - 20\text{m}$) and clear aisle width ($1,000\text{mm} - 4,500\text{mm}$) against official PUDU kinematic formulas and DIN EN ISO 3691-4 (+200 mm safety clearance buffer per side).
* **3D Turning Radius & Maneuvering Envelope Visualizer:** Real-time concentric 3D floor boundary rings, safety buffer zones, and floating 3D billboard callouts displaying minimum turning radius ($R_{\min} = 2.00\text{ m}$) and recommended operating envelope ($R_{rec} \ge 2.20\text{ m}$).
* **3D CAD Measurement Caliper Overlay:** Floating 3D dimension arrows and measurement callouts ($W_1, W_2, C_h, B_1$) that dynamically update with slider adjustments and color-code pass/fail tolerances.
* **3D LiDAR Holographic Perception Scanner:** Sweeping cyan laser fan projecting from the top sensor mast, showcasing the PUDU MP2000's obstacle and pallet perception system.
* **Procedural Industrial Web Audio:** Synthesized via native Web Audio API (100% offline, zero external audio files):
  * Dynamic electric drive motor hum
  * Pneumatic/hydraulic lift hiss
  * Success validation chime & impact collision buzzer
* **4K Verification Snapshot Exporter:** One-click capture that composites an engineering certification card with pallet name, dimensions, robot model, maneuvering specs, and pass/fail verdict into a downloadable PNG.
* **Regional Country Presets:** Validated presets for **Malaysia [MY] (CHEP / MS 1200)**, **Singapore [SG] (SS 334)**, **Philippines [PH] (PNS / GMA)**, **China [CN] (GB/T 2934)**, **Europe [EU] (EPAL 1 / 2)**, and **North America [US] (GMA 48x40)**.

---

## PUDU MP2000 Verification Formulas & Maneuvering Specs

### 1. Pocket Entry Tolerances
$$\begin{aligned}
\text{Outer Opening Clearance:} \quad & W_1 \ge B_1 + 40\text{ mm} \\
\text{Center Block Clearance:} \quad & W_2 \le B_2 - 40\text{ mm} \\
\text{Vertical Pocket Clearance:} \quad & C_h \ge 85\text{ mm} \quad (\text{Fork Lowered Height} = 80\text{ mm})
\end{aligned}$$

### 2. Turning Radius & Aisle Width Requirements (PUDU Official Manual)
$$\begin{aligned}
\text{Right-Angle Stacking Aisle } (A_{st}) \text{ for } 1200 \times 1000\text{ mm}: \quad & A_{st} \le 2,000\text{ mm} \quad (R_{min} = 2.00\text{ m}) \\
\text{Right-Angle Stacking Aisle } (A_{st}) \text{ for } 1200 \times 800\text{ mm}: \quad & A_{st} \le 1,960\text{ mm} \quad (R_{min} = 1.96\text{ m}) \\
\text{Recommended Operating Envelope (DIN EN ISO 3691-4):} \quad & R_{rec} = R_{min} + 200\text{ mm} \quad (\text{Aisle } \ge 2,400\text{ mm})
\end{aligned}$$

### Robot Model Comparison:
| Model Code | Marketing Name | Outer Fork Spacing ($B_1$) | Inner Fork Gap ($B_2$) | Fork Width | Lowered Height | Max Payload |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **WPID01-M** | Standard | **620 mm** | **300 mm** | 160 mm | 80 mm | 2,000 kg |
| **WPID01-N** | Narrow | **550 mm** | **230 mm** | 160 mm | 80 mm | 2,000 kg |

> **Golden Rule:** If both models fit, **WPID01-M (620 mm)** is preferred to minimize pallet flex and deformation under heavy load.

---

## How to Host on GitHub Pages (2-Minute Setup)

This project is completely client-side (static HTML, CSS, JavaScript, WebAssembly, and GLB) with zero server dependencies, making it 100% compatible with GitHub Pages:

### Step 1: Create a GitHub Repository
1. Log in to [GitHub](https://github.com) and click **New Repository**.
2. Name your repository (e.g. `mp2000-pallet-verifier`).
3. Set visibility to **Public** (required for free GitHub Pages).
4. Click **Create repository**.

### Step 2: Push the Files
Open your terminal in this folder and run:
```bash
git init
git add .
git commit -m "feat: release MP2000 Pallet Verifier & Pathway Transit Simulator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mp2000-pallet-verifier.git
git push -u origin main
```
*(Or drag and drop the folder contents into GitHub Desktop / Web interface).*

### Step 3: Enable GitHub Pages
1. In your GitHub repository, go to **Settings** -> **Pages** (in the left sidebar).
2. Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
3. Under **Branch**, select `main` and folder `/(root)`, then click **Save**.
4. In about 30–60 seconds, your site will be live at:  
   **`https://YOUR_USERNAME.github.io/mp2000-pallet-verifier/`**

> **Note on `.nojekyll`:** A `.nojekyll` file is already included in the repository root. This ensures GitHub Pages does not ignore WebAssembly (`.wasm`) or 3D binary (`.glb`) assets.

---

## Running Locally

You can also run the simulator offline on any Windows machine:
1. Double-click **`start.bat`**.
2. A lightweight local server will start, opening `http://localhost:8080/index.html` in your default browser.

---

## Project Structure

```
mp2000-pallet-verifier/
├── index.html              # Main dual-mode single-page application
├── README.md               # Documentation & deployment guide
├── .nojekyll               # Disables Jekyll processing on GitHub Pages
├── .gitignore              # Ignores local and temporary files
├── start.bat               # 1-click Windows local server launcher
├── server.ps1              # Zero-dependency PowerShell HTTP server
├── css/
│   └── style.css           # Glassmorphism dark-mode industrial theme
├── js/
│   ├── app.js              # Application lifecycle, mode switcher & state manager
│   ├── presets.js          # International pallet standards database
│   ├── verifier.js         # Pallet mathematical verification engine
│   ├── pathwayVerifier.js  # Custom corridor passability & turning feasibility engine
│   ├── pathwayModel.js     # Procedural 3D corridor, zebra hazard lines & guardrails
│   ├── palletModel.js      # Procedural 3D pallet generator
│   ├── robotModel.js       # PUDU MP2000 CAD loader & fork kinematics
│   ├── simulation.js       # Dual-mode engine (3s pallet docking & 5s pathway transit)
│   ├── cadDimensions.js    # Floating 3D measurement calipers
│   ├── turningRadius.js    # 3D Turning radius & aisle clearance visualizer
│   ├── lidarScanner.js     # 3D LiDAR holographic laser scanner
│   ├── soundEffects.js     # Web Audio motor & hydraulic synthesizer
│   ├── exporter.js         # 4K certification snapshot exporter
│   └── libs/
│       ├── three.min.js    # Three.js 3D library (r128 UMD)
│       ├── OrbitControls.js# Smooth camera orbit controls
│       ├── GLTFLoader.js   # GLTF / GLB 3D model loader
│       ├── DRACOLoader.js  # Draco mesh decompressor
│       └── draco/          # Offline WebAssembly Draco decoders
└── models/
    └── MP2000-optimized.glb# Authentic PUDU MP2000 3D CAD model
```

---

## License
MIT License. PUDU MP2000 is a registered trademark of Pudu Robotics.
