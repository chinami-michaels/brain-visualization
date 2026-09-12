import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader } from './GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.js';

const tracts = {
  corpus: {
    name: 'Corpus callosum', tag: 'Commissural fibers', color: '#e7edf5', number: '01 / 07',
    text: 'The brain’s largest white-matter bridge, allowing the left and right cerebral hemispheres to exchange sensory, motor, and cognitive information.',
    connection: 'Left hemisphere ↔ right hemisphere'
  },
  cingulum: {
    name: 'Cingulum bundle', tag: 'Association fibers', color: '#f1cf62', number: '02 / 07',
    text: 'A curved pathway within the limbic system associated with attention, memory, emotion, and the integration of internal states.',
    connection: 'Cingulate cortex ↔ parahippocampal region'
  },
  arcuate: {
    name: 'Arcuate fasciculus', tag: 'Association fibers', color: '#ff9e42', number: '03 / 07',
    text: 'A sweeping dorsal pathway important for language processing, especially the mapping of heard speech to the motor plans used to produce it.',
    connection: 'Posterior temporal regions ↔ frontal language regions'
  },
  corticospinal: {
    name: 'Corticospinal tract', tag: 'Projection fibers', color: '#45d6d2', number: '04 / 07',
    text: 'The principal descending motor pathway. Its fibers carry voluntary movement commands from motor cortex toward the brainstem and spinal cord.',
    connection: 'Primary motor cortex → brainstem and spinal cord'
  },
  optic: {
    name: 'Optic radiation', tag: 'Projection fibers', color: '#70a7ff', number: '05 / 07',
    text: 'A broad fan of fibers that carries visual information from the thalamus to the primary visual cortex at the back of the brain.',
    connection: 'Lateral geniculate nucleus → visual cortex'
  },
  uncinate: {
    name: 'Uncinate fasciculus', tag: 'Association fibers', color: '#ff718b', number: '06 / 07',
    text: 'A hook-shaped pathway linking anterior temporal regions with the orbitofrontal cortex, involved in memory, emotion, and social processing.',
    connection: 'Anterior temporal lobe ↔ orbitofrontal cortex'
  },
  ilf: {
    name: 'Inferior longitudinal fasciculus', tag: 'Association fibers', color: '#afd66f', number: '07 / 07',
    text: 'A long ventral pathway supporting visual recognition by connecting occipital visual areas with temporal regions involved in object and face processing.',
    connection: 'Occipital lobe ↔ anterior temporal lobe'
  }
};

const canvas = document.getElementById('brainCanvas');
const stage = canvas.closest('.stage');
const loading = document.getElementById('modelStatus');
const detail = document.getElementById('detail');
const detailTag = document.getElementById('detailTag');
const detailTitle = document.getElementById('detailTitle');
const detailNumber = document.getElementById('detailNumber');
const detailText = document.getElementById('detailText');
const detailConnection = document.getElementById('detailConnection');
const connectionLabel = document.getElementById('connectionLabel');
const signalButton = document.getElementById('signalButton');
const signalState = document.getElementById('signalState');
const pulseSpeed = document.getElementById('pulseSpeed');
const pulseSpeedValue = document.getElementById('pulseSpeedValue');
const revealAll = document.getElementById('revealAll');
const tractVisibility = document.getElementById('tractVisibility');

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  loading.textContent = 'Restoring 3D view';
  loading.classList.remove('loaded', 'error');
});
canvas.addEventListener('webglcontextrestored', () => location.reload());

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (error) {
  loading.textContent = 'This interactive model needs WebGL.';
  loading.classList.add('error');
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 620 ? 1.25 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b141d, 0.0022);
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 1200);
camera.up.set(0, 0, 1);
camera.position.set(230, -8, 18);

scene.add(new THREE.HemisphereLight(0xc8e4ff, 0x101820, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(110, -90, 150);
scene.add(key);
const rim = new THREE.DirectionalLight(0x59d7ef, 2.0);
rim.position.set(-130, 80, 40);
scene.add(rim);
const warm = new THREE.DirectionalLight(0xffaf70, 1.05);
warm.position.set(30, 130, -30);
scene.add(warm);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.85;
controls.minDistance = 105;
controls.maxDistance = 390;
controls.target.set(0, 0, 0);
controls.autoRotate = false;

const tractMeshes = new Map();
const cortexMeshes = [];
let selected = 'corticospinal';
let lastIsolated = 'corticospinal';
let signalOn = false;
let tissueView = 'anatomy';
let loaded = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// A steady 30 fps keeps the half-second passage visually smooth while avoiding
// unnecessary continuous rendering work on phones and lower-power GPUs.
const signalFrameInterval = 1000 / 30;
let pulseDuration = 0.5;

function setMaterialState() {
  tractMeshes.forEach((mesh, id) => {
    const material = mesh.material;
    const isSelected = selected === id;
    const isVisibleTarget = !selected || isSelected;
    mesh.visible = isVisibleTarget;
    material.transparent = true;
    material.depthWrite = true;
    material.opacity = isSelected ? 1 : (tissueView === 'connectome' ? 0.98 : 0.82);
    // Give the moving signal room to read as light instead of clipping into
    // the tract's normal near-white baseline, especially on phone screens.
    material.emissiveIntensity = signalOn && isVisibleTarget
      ? 0.14
      : (isSelected ? 0.58 : 0.13);
    mesh.renderOrder = isSelected ? 3 : 1;
  });
  cortexMeshes.forEach(mesh => {
    mesh.material.opacity = tissueView === 'connectome' ? 0.025 : 0.115;
    mesh.visible = true;
  });
}

function selectTract(id) {
  selected = id || null;
  if (selected) {
    lastIsolated = selected;
    tractVisibility.value = selected;
  } else {
    tractVisibility.value = lastIsolated;
  }
  revealAll.checked = !selected;
  document.querySelectorAll('.tract-button').forEach(button => {
    const active = Boolean(selected && button.dataset.tract === selected);
    const blockedByIsolation = Boolean(selected && !active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.disabled = blockedByIsolation;
    button.setAttribute('aria-disabled', blockedByIsolation ? 'true' : 'false');
  });
  setMaterialState();

  if (!selected) {
    detail.style.setProperty('--active-color', '#45d6d2');
    detailTag.textContent = 'Overview';
    detailTitle.textContent = 'All seven pathways';
    detailNumber.textContent = '07 / 07';
    detailText.textContent = 'Each colored volume is a tube-mesh reconstruction of streamlines sampled from the HCP1065 population atlas.';
    connectionLabel.textContent = 'Reading the model';
    detailConnection.textContent = 'Drag to rotate, pinch or scroll to zoom, or select a bundle below to isolate its three-dimensional course.';
    setSignalStrength();
    requestRender();
    return;
  }

  const item = tracts[selected];
  detail.style.setProperty('--active-color', item.color);
  detailTag.textContent = item.tag;
  detailTitle.textContent = item.name;
  detailNumber.textContent = item.number;
  detailText.textContent = item.text;
  connectionLabel.textContent = 'Connects';
  detailConnection.textContent = item.connection;
  setSignalStrength();
  requestRender();
}

revealAll.addEventListener('change', () => {
  selectTract(revealAll.checked ? null : lastIsolated);
});

tractVisibility.addEventListener('change', () => {
  selectTract(tractVisibility.value);
});

for (const button of document.querySelectorAll('.tract-button')) {
  button.addEventListener('click', () => {
    if (selected && selected !== button.dataset.tract) return;
    selectTract(button.dataset.tract);
  });
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    tissueView = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    setMaterialState();
  });
});

signalButton.addEventListener('click', () => {
  signalOn = !signalOn;
  signalButton.classList.toggle('active', signalOn);
  signalButton.setAttribute('aria-pressed', String(signalOn));
  signalButton.setAttribute('aria-label', `Action potentials ${signalOn ? 'on' : 'off'}`);
  signalState.textContent = signalOn ? 'On' : 'Off';
  setMaterialState();
  setSignalStrength();
  if (signalOn && !reducedMotion) startPulse();
  else if (!signalOn) stopPulse(true);
  requestRender();
});

function updatePulseSpeed() {
  pulseDuration = Number.parseFloat(pulseSpeed.value);
  pulseSpeedValue.textContent = `${pulseDuration.toFixed(2)} s`;
  pulseSpeed.setAttribute('aria-valuetext', `${pulseDuration.toFixed(2)} seconds per passage`);
}

pulseSpeed.addEventListener('input', updatePulseSpeed);
updatePulseSpeed();

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('assets/');
draco.setDecoderConfig({ type: 'wasm' });
draco.setWorkerLimit(1);
draco.preload();
loader.setDRACOLoader(draco);

function loadGLB(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function addSignalPath(mesh, midbrainPoint, manifest, bin) {
  const entry = manifest[mesh.name];
  if (entry) {
    const arr = new Uint8Array(bin, entry.offset, entry.count);
    mesh.geometry.setAttribute('signalPath', new THREE.BufferAttribute(arr, 1, true));
    return;
  }

  // Fallback for any future mesh that is not included in the baked manifest.
  const position = mesh.geometry.getAttribute('position');
  const distances = new Float32Array(position.count);
  const point = new THREE.Vector3();
  let minDistance = Infinity;
  let maxDistance = -Infinity;

  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const distance = point.distanceTo(midbrainPoint);
    distances[i] = distance;
    minDistance = Math.min(minDistance, distance);
    maxDistance = Math.max(maxDistance, distance);
  }

  const span = Math.max(0.001, maxDistance - minDistance);
  for (let i = 0; i < distances.length; i += 1) distances[i] = (distances[i] - minDistance) / span;
  mesh.geometry.setAttribute('signalPath', new THREE.BufferAttribute(distances, 1));
}

function addSignalShader(mesh) {
  const signal = {
    time: { value: 0 },
    strength: { value: 0 },
    color: { value: new THREE.Color(0xb96f16) }
  };
  const isReferenceTract = mesh.name === 'corticospinal';
  const pulseProfile = isReferenceTract ? `
        // The corticospinal tract is the reference-quality pass: a linear
        // outward passage with a bright leading head, continuously fading wake,
        // soft halo, and almost no forward spill. uSignalTime is cycle progress,
        // so the live speed control can change duration without a phase jump.
        float signalPhase = fract(uSignalTime);
        float signalOffset = vSignalPath - signalPhase;
        float signalHalo = smoothstep(-0.14, 0.0, signalOffset)
                         * (1.0 - smoothstep(0.0, 0.045, signalOffset));
        float signalStreak = smoothstep(-0.085, 0.0, signalOffset)
                           * (1.0 - smoothstep(0.0, 0.018, signalOffset));
        float signalCore = smoothstep(-0.034, 0.0, signalOffset)
                         * (1.0 - smoothstep(0.0, 0.011, signalOffset));
        vec3 signalGold = vec3(1.0, 0.62, 0.20);
        vec3 signalGoldWhite = vec3(1.0, 0.82, 0.46);
        totalEmissiveRadiance += uSignalColor * uSignalStrength * signalHalo * 2.2;
        totalEmissiveRadiance += signalGold * uSignalStrength * signalStreak * 3.6;
        totalEmissiveRadiance += signalGoldWhite * uSignalStrength * signalCore * 5.4;`
    : `
        // Keep the remaining tracts on the established compact blip until
        // their individual profiles are tuned in later passes.
        float signalPhase = fract(uSignalTime);
        float signalDistance = abs(vSignalPath - signalPhase);
        float signalHalo = 1.0 - smoothstep(0.014, 0.055, signalDistance);
        float signalCore = 1.0 - smoothstep(0.002, 0.013, signalDistance);
        vec3 signalGold = vec3(1.0, 0.62, 0.20);
        totalEmissiveRadiance += uSignalColor * uSignalStrength * signalHalo * 2.3;
        totalEmissiveRadiance += signalGold * uSignalStrength * signalCore * 4.6;`;

  mesh.userData.signal = signal;
  mesh.material.onBeforeCompile = shader => {
    shader.uniforms.uSignalTime = signal.time;
    shader.uniforms.uSignalStrength = signal.strength;
    shader.uniforms.uSignalColor = signal.color;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float signalPath;\nvarying float vSignalPath;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSignalPath = signalPath;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSignalTime;\nuniform float uSignalStrength;\nuniform vec3 uSignalColor;\nvarying float vSignalPath;')
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `vec3 totalEmissiveRadiance = emissive;${pulseProfile}`
      );
  };
  mesh.material.customProgramCacheKey = () => isReferenceTract
    ? 'action-potential-corticospinal-v7-warm-gold-variable-speed'
    : 'action-potential-simple-v4-warm-gold-variable-speed';
  mesh.material.needsUpdate = true;
}

function setSignalStrength() {
  tractMeshes.forEach((mesh, id) => {
    const signal = mesh.userData.signal;
    if (!signal) return;
    const isVisibleTarget = !selected || selected === id;
    signal.strength.value = signalOn && isVisibleTarget ? 1 : 0;
    if (reducedMotion && signalOn && isVisibleTarget) signal.time.value = 0.3;
  });
}

Promise.all([
  loadGLB('assets/hcp1065-tract-tubes.glb'),
  loadGLB('assets/hcp-s1200-cortex-L.glb'),
  loadGLB('assets/hcp-s1200-cortex-R.glb'),
  fetch('assets/signal-paths.json').then(response => {
    if (!response.ok) throw new Error(`Signal path manifest failed to load (${response.status})`);
    return response.json();
  }),
  fetch('assets/signal-paths.bin').then(response => {
    if (!response.ok) throw new Error(`Signal path data failed to load (${response.status})`);
    return response.arrayBuffer();
  })
]).then(([tractModel, leftCortex, rightCortex, signalPathManifest, signalPathBin]) => {
  const root = new THREE.Group();
  tractModel.scene.traverse(object => {
    if (!object.isMesh) return;
    object.material = object.material.clone();
    object.material.side = THREE.DoubleSide;
    object.material.emissive = object.material.color.clone();
    object.userData.tract = object.name;
    tractMeshes.set(object.name, object);
  });
  root.add(tractModel.scene);

  [leftCortex.scene, rightCortex.scene].forEach(cortex => {
    cortex.traverse(object => {
      if (!object.isMesh) return;
      object.material = new THREE.MeshPhysicalMaterial({
        color: 0x8395a8,
        emissive: 0x1a2c38,
        emissiveIntensity: 0.18,
        roughness: 0.72,
        metalness: 0,
        transparent: true,
        opacity: 0.115,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      object.renderOrder = 0;
      cortexMeshes.push(object);
    });
    root.add(cortex);
  });

  const box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(centre);
  scene.add(root);
  root.updateMatrixWorld(true);

  // A single baked, normalized path coordinate per existing vertex drives the
  // light outward from the central, slightly inferior midbrain region. The
  // original calculation remains as a fallback for meshes absent from the manifest.
  const midbrainPoint = new THREE.Vector3(0, 0, -size.z * 0.1);
  tractMeshes.forEach(mesh => {
    addSignalPath(mesh, midbrainPoint, signalPathManifest, signalPathBin);
    addSignalShader(mesh);
  });

  setMaterialState();
  setSignalStrength();
  loaded = true;
  loading.classList.add('loaded');
  stage.classList.add('model-loaded');
  requestRender();
}, error => {
  console.error(error);
  loading.textContent = 'The tract model could not be loaded.';
  loading.classList.add('error');
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('click', event => {
  if (!loaded) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const selectableMeshes = selected
    ? [tractMeshes.get(selected)].filter(Boolean)
    : [...tractMeshes.values()].filter(mesh => mesh.visible);
  const hits = raycaster.intersectObjects(selectableMeshes, false);
  if (hits[0]?.object?.name) selectTract(hits[0].object.name);
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}
function renderScene() {
  resize();
  renderer.render(scene, camera);
}

let renderFrame = 0;
function requestRender() {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    renderScene();
  });
}

let pulseFrame = 0;
let signalProgress = 0;
let lastSignalRender = 0;
let lastSignalStep = 0;

function stopPulse(reset = false) {
  if (pulseFrame) cancelAnimationFrame(pulseFrame);
  pulseFrame = 0;
  lastSignalRender = 0;
  lastSignalStep = 0;
  if (reset) {
    signalProgress = 0;
    tractMeshes.forEach(mesh => {
      if (mesh.userData.signal) mesh.userData.signal.time.value = 0;
    });
  }
}

function startPulse() {
  if (pulseFrame || document.hidden || !signalOn || reducedMotion) return;
  lastSignalRender = 0;
  lastSignalStep = performance.now();

  const tick = now => {
    pulseFrame = 0;
    if (!signalOn || document.hidden) return;

    if (!lastSignalRender || now - lastSignalRender >= signalFrameInterval) {
      // Cycle progress advances from elapsed time rather than frame count. The
      // 30 fps render cap stays fixed while the slider changes passage duration
      // live, and the pulse does not jump when that duration changes.
      signalProgress += ((now - lastSignalStep) / 1000) / pulseDuration;
      lastSignalStep = now;
      lastSignalRender = now;
      tractMeshes.forEach(mesh => {
        if (mesh.userData.signal) mesh.userData.signal.time.value = signalProgress;
      });
      renderScene();
    }

    pulseFrame = requestAnimationFrame(tick);
  };
  pulseFrame = requestAnimationFrame(tick);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPulse(false);
  else if (signalOn && !reducedMotion) startPulse();
});

controls.addEventListener('change', requestRender);
new ResizeObserver(requestRender).observe(canvas);
selectTract('corticospinal');
requestRender();
