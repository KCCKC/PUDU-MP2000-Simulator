# MP2000 Pallet Verifier 🤖📦
> **AI-Native Autonomous Forklift Verification & 3D Simulation Engine for PUDU MP2000**

A standalone, zero-dependency 3D web application designed to validate and simulate pallet compatibility for the **PUDU MP2000** industrial AMR. Powered by Three.js and official Pudu Robotics engineering formulas, this tool provides an advertisement-grade 3-second insertion simulation, parametric pallet modeling, and regional presets across **Malaysia, Singapore, the Philippines, China, Europe, and North America**.

---

## ✨ Key Features

1. **Official PUDU Engineering Rule Verification:**
   * **Criteria 1 (Outer Opening):** $W_1 \ge B_1 + 40\text{ mm}$ (Minimum $20\text{ mm}$ outer side clearance).
   * **Criteria 2 (Center Block):** $W_2 \le B_2 - 40\text{ mm}$ (Minimum $20\text{ mm}$ inner clearance around center block/stringer).
   * **Criteria 3 (Under-Deck Height):** $C_h \ge 85\text{ mm}$ (Minimum $5\text{ mm}$ safety gap for $80\text{ mm}$ lowered tines).
   * **Criteria 4 (Bottom Deck Kinematics):** Verifies tandem climbing roller support for full-perimeter pallets and flags fatal lockups on reversible solid pallets.
2. **Dual-Model Support & Comparative Engine:**
   * **WPID01-M (Standard - 620 mm):** Outer fork spacing $B_1 = 620\text{ mm}$, Inner spacing $B_2 = 300\text{ mm}$.
   * **WPID01-N (Narrow - 550 mm):** Outer fork spacing $B_1 = 550\text{ mm}$, Inner spacing $B_2 = 230\text{ mm}$.
   * Real-time comparative scoring applying Pudu's golden rule: *"If both fit, choose the larger fork spacing to reduce pallet deformation."*
3. **Cinematic 3-Second "Hero Ad" Simulation:**
   * Smooth 3.0s fork insertion glide with dynamic camera choreography.
   * **Collision Detection:** Halts at the exact collision boundary and highlights the colliding block in pulsing neon red if dimensions fail.
   * **Success Lift Test:** Demonstrates full insertion followed by a $120\text{ mm}$ hydraulic lift test.
4. **Preloaded Regional Pallet Presets:**
   * 🇲🇾 **Malaysia:** MS 1200 / CHEP Blue Wood ($1200\times 1000$), Penang Cleanroom Plastic ($1100\times 1100$).
   * 🇸🇬 **Singapore:** SS 334 / Loscam Yellow ($1200\times 1000$), Jurong Island Petrochemical Black HDPE ($1100\times 1100$).
   * 🇵🇭 **Philippines:** FMCG Loscam Red ($1200\times 1000$), US-Legacy GMA Stringer ($1219\times 1016$).
   * 🇨🇳 **China:** GB/T 2934 Standard 1 Tian 田-Type ($1200\times 1000$), Chuan 川-Type ($1200\times 1000$), Standard 2 Tian Block ($1100\times 1100$), Chuan Stringer ($1100\times 1100$).
   * 🇪🇺 **Europe:** EPAL 1 ($1200\times 800$, 800mm Face), EPAL 2 ($1200\times 1000$).
   * 🇺🇸 **North America:** GMA $48\times 40$ in (40" End Entry vs 48" Notched Side Failure).
   * ⚙️ **Failure Demonstrations:** Reversible Double-Deck pallet, Over-sagged pallet.

---

## 🚀 How to Host on GitHub Pages (Zero Build Step!)

This application has **zero build dependencies** (no npm, no webpack). It uses standard ES6 modules and CDN-loaded Three.js.

### 3-Step Deployment:
1. Create a new repository on GitHub (e.g. `mp2000-pallet-verifier`).
2. Push all files in this folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of MP2000 Pallet Verifier"
   git branch -M main
   git remote add origin https://github.com/<your-username>/mp2000-pallet-verifier.git
   git push -u origin main
   ```
3. In GitHub, go to **Settings** > **Pages** > Under **Branch**, select `main` / `root` and click **Save**.
   * Your simulator will be live immediately at: `https://<your-username>.github.io/mp2000-pallet-verifier/`

---

## 💻 Local Execution

You can run it locally in any modern browser:
* **Option A:** Simply double-click `index.html` (if your browser allows ES module imports from local files).
* **Option B:** Run a local lightweight static server:
  ```bash
  # Using Python (built-in)
  python -m http.server 8080
  
  # Or using Node
  npx serve
  ```
  Then open `http://localhost:8080` in Chrome, Edge, Safari, or Firefox.

---

## 📁 File Structure

```
mp2000-pallet-verifier/
├── index.html               # Main application shell with 3D canvas and HUD
├── css/
│   └── style.css            # Industrial dark-mode styling, glassmorphism, responsive HUD
├── js/
│   ├── presets.js           # Regional pallet database (Malaysia, SG, PH, China, EU, US)
│   ├── verifier.js          # Pudu mathematical rule engine (W1, W2, Ch, bottom-board checks)
│   ├── palletModel.js       # Parametric Three.js pallet generator with collision highlighting
│   ├── robotModel.js        # Parametric PUDU MP2000 3D model (Chassis & dual tines)
│   ├── simulation.js        # 3-second simulation controller, collision kinematics, camera modes
│   └── app.js               # Event wiring, UI controls, real-time formula recalculation
└── README.md                # Documentation and deployment guide
```
