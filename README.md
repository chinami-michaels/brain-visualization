# Interactive Brain Visualization

An interactive 3D visualization of seven major human brain white-matter pathways, with animated action-potential pulses.

**Live site:** https://chinami-michaels.github.io/brain-visualization/

## Data
Tract geometry: HCP1065 population-averaged tractography atlas.
- Yeh FC. "Population-based tract-to-region connectome of the human brain and its hierarchical topology." *Nature Communications* 13, 4933 (2022).
- Atlas source: https://github.com/data-others/atlas/releases/tag/hcp1065
- License: CC BY-SA 4.0 (http://creativecommons.org/licenses/by-sa/4.0/)

## Tech
Single self-contained HTML page powered by Three.js (WebGL), with Draco-compressed meshes for mobile delivery. No build step, no server.
