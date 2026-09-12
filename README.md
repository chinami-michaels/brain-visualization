# Interactive Brain Visualization

An interactive 3D visualization of seven major human white-matter tracts, reconstructed from the HCP1065 population-averaged tractography atlas.

**Live:** https://chinami-michaels.github.io/brain-visualization/

## Data & attribution

- Tractography: HCP1065 population-averaged atlas (Yeh et al., 2022 — https://doi.org/10.1038/s41467-022-32595-4), via https://github.com/data-others/atlas/releases/tag/hcp1065
- Licensed under [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/)
- HCP data use terms: https://www.humanconnectome.org/study/hcp-young-adult/document/wu-minn-hcp-consortium-open-access-data-use-terms

## Tech

Plain HTML/CSS/vanilla JS with Three.js (WebGL). No backend, no build step served here — this repo hosts the built static files (`index.html` + `assets/`).
