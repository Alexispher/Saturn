import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const canvas = document.getElementById('space-canvas');
const flashEl = document.getElementById('flash');
const captureStatusEl = document.getElementById('capture-status');
const phonePreviewEl = document.getElementById('phone-preview');

const btnToggleUI = document.getElementById('btn-toggle-ui');
const btnExport4K = document.getElementById('btn-export-4k');
const btnExportVertical = document.getElementById('btn-export-vertical');
const btnExportSquare = document.getElementById('btn-export-square');
const btnExportIphone = document.getElementById('btn-export-iphone');
const btnExportFree = document.getElementById('btn-export-free');
const btnReset = document.getElementById('btn-reset');

const PLANET_RADIUS = 5.25;

let scene;
let camera;
let renderer;
let controls;
let gui;
let clock;

let saturnGroup;
let ringGroup;
let planetMesh;
let cloudMesh;
let atmosphereMesh;
let ringMesh;
let starField;

let sunLight;
let ambientLight;

let guiControllers = [];

const params = {
  sceneProfile: 'Missão Cassini',
  captureProfile: 'Missão Cassini',

  phoneOrientation: 'Vertical',
  showPhoneFrame: false,
  keepPhoneGuideInFreeMode: false,

  // Composição
  fov: 24,
  distance: 16.8,
  offsetX: 0.0,
  offsetY: 0.2,
  frameRotationZ: -8,
  subjectScale: 1.0,

  // Câmera / look
  cameraMono: false,
  sensorNoise: 0.014,
  vignette: 0.20,
  bloomMin: 0.025,

  // Saturno
  polarFlattening: 0.902,
  planetBrightness: 1.05,
  bandVisibility: 0.62,
  terminatorSoftness: 0.42,
  cloudOpacity: 0.08,
  cloudSpeed: 0.01,
  planetSpinSpeed: 0.006,
  showHexagonHint: true,
  hexagonStrength: 0.10,

  // Atmosfera
  atmosphereGlow: 0.24,
  atmospherePower: 3.2,
  atmosphereScale: 1.025,
  limbIrregularity: 0.16,

  // Sombra dos anéis
  physicalRingShadow: 0.62,
  ringShadowSharpness: 0.78,

  // Anéis
  ringInnerRadius: 7.15,
  ringOuterRadius: 11.65,
  ringTilt: 73.5,
  ringOpacity: 0.84,
  ringBrightness: 0.88,
  ringMacroChaos: 0.74,
  ringClumpStrength: 0.48,
  ringRadialChaos: 0.62,
  ringSpiralWaves: 0.55,

  // Luz
  lightX: 5.8,
  lightY: 4.2,
  lightZ: 15.5,
  lightIntensity: 3.1,
  ambientIntensity: 0.0,

  // Render
  exposure: 1.04,
  starCount: 35,
  starSize: 0.028,
  showStars: true,

  // Captura livre
  freeWidth: 3000,
  freeHeight: 3000
};

const PROFILE_PRESETS = {
  'Missão Cassini': {
    showPhoneFrame: false,
    phoneOrientation: 'Vertical',

    fov: 24,
    distance: 16.8,
    offsetX: 0.0,
    offsetY: 0.2,
    frameRotationZ: -8,
    subjectScale: 1.0,

    cameraMono: false,
    sensorNoise: 0.014,
    vignette: 0.20,
    bloomMin: 0.025,

    polarFlattening: 0.902,
    planetBrightness: 1.05,
    bandVisibility: 0.62,
    terminatorSoftness: 0.42,
    cloudOpacity: 0.08,
    cloudSpeed: 0.01,
    planetSpinSpeed: 0.006,
    showHexagonHint: true,
    hexagonStrength: 0.10,

    atmosphereGlow: 0.24,
    atmospherePower: 3.2,
    atmosphereScale: 1.025,
    limbIrregularity: 0.16,

    physicalRingShadow: 0.62,
    ringShadowSharpness: 0.78,

    ringTilt: 73.5,
    ringOpacity: 0.84,
    ringBrightness: 0.88,
    ringMacroChaos: 0.74,
    ringClumpStrength: 0.48,
    ringRadialChaos: 0.62,
    ringSpiralWaves: 0.55,

    lightX: 5.8,
    lightY: 4.2,
    lightZ: 15.5,
    lightIntensity: 3.1,
    ambientIntensity: 0.0,

    exposure: 1.04,
    starCount: 35,
    starSize: 0.028,
    showStars: true
  },

  'iPhone 17 Pro Max da Terra': {
    showPhoneFrame: true,
    phoneOrientation: 'Vertical',

    fov: 12,
    distance: 95,
    offsetX: 0,
    offsetY: 0,
    frameRotationZ: 0,
    subjectScale: 0.085,

    cameraMono: false,
    sensorNoise: 0.050,
    vignette: 0.32,
    bloomMin: 0.055,

    polarFlattening: 0.902,
    planetBrightness: 1.00,
    bandVisibility: 0.35,
    terminatorSoftness: 0.20,
    cloudOpacity: 0.04,
    cloudSpeed: 0.0,
    planetSpinSpeed: 0.001,
    showHexagonHint: false,
    hexagonStrength: 0.0,

    atmosphereGlow: 0.08,
    atmospherePower: 3.8,
    atmosphereScale: 1.015,
    limbIrregularity: 0.05,

    physicalRingShadow: 0.35,
    ringShadowSharpness: 0.72,

    ringTilt: 74.0,
    ringOpacity: 0.88,
    ringBrightness: 0.96,
    ringMacroChaos: 0.42,
    ringClumpStrength: 0.20,
    ringRadialChaos: 0.24,
    ringSpiralWaves: 0.18,

    lightX: 8.0,
    lightY: 2.5,
    lightZ: 15.0,
    lightIntensity: 2.2,
    ambientIntensity: 0.0,

    exposure: 0.92,
    starCount: 18,
    starSize: 0.018,
    showStars: true
  },

  'Wallpaper Isomium': {
    showPhoneFrame: false,
    phoneOrientation: 'Vertical',

    fov: 23.5,
    distance: 15.0,
    offsetX: -5.15,
    offsetY: 0.12,
    frameRotationZ: 0,
    subjectScale: 1.48,

    cameraMono: true,
    sensorNoise: 0.004,
    vignette: 0.08,
    bloomMin: 0.008,

    polarFlattening: 0.902,
    planetBrightness: 0.96,
    bandVisibility: 0.38,
    terminatorSoftness: 0.26,
    cloudOpacity: 0.02,
    cloudSpeed: 0.001,
    planetSpinSpeed: 0.0005,
    showHexagonHint: false,
    hexagonStrength: 0.0,

    atmosphereGlow: 0.17,
    atmospherePower: 4.0,
    atmosphereScale: 1.016,
    limbIrregularity: 0.06,

    physicalRingShadow: 0.42,
    ringShadowSharpness: 0.72,

    ringTilt: 73.8,
    ringOpacity: 0.97,
    ringBrightness: 1.16,
    ringMacroChaos: 0.88,
    ringClumpStrength: 0.62,
    ringRadialChaos: 0.72,
    ringSpiralWaves: 0.56,

    lightX: 7.8,
    lightY: 2.1,
    lightZ: 17.2,
    lightIntensity: 2.75,
    ambientIntensity: 0.0,

    exposure: 0.94,
    starCount: 0,
    starSize: 0.018,
    showStars: false,

    freeWidth: 4096,
    freeHeight: 4096
  }
};

const FREE_DEFAULTS = {
  showPhoneFrame: false,
  phoneOrientation: 'Vertical',

  fov: 26,
  distance: 18,
  offsetX: 0,
  offsetY: 0,
  frameRotationZ: -4,
  subjectScale: 1.0,

  cameraMono: false,
  sensorNoise: 0.012,
  vignette: 0.16,
  bloomMin: 0.020,

  polarFlattening: 0.902,
  planetBrightness: 1.08,
  bandVisibility: 0.70,
  terminatorSoftness: 0.36,
  cloudOpacity: 0.09,
  cloudSpeed: 0.01,
  planetSpinSpeed: 0.006,
  showHexagonHint: true,
  hexagonStrength: 0.08,

  atmosphereGlow: 0.26,
  atmospherePower: 3.0,
  atmosphereScale: 1.025,
  limbIrregularity: 0.14,

  physicalRingShadow: 0.54,
  ringShadowSharpness: 0.72,

  ringTilt: 72.5,
  ringOpacity: 0.86,
  ringBrightness: 0.92,
  ringMacroChaos: 0.68,
  ringClumpStrength: 0.40,
  ringRadialChaos: 0.50,
  ringSpiralWaves: 0.48,

  lightX: 6.4,
  lightY: 4.0,
  lightZ: 13.2,
  lightIntensity: 3.0,
  ambientIntensity: 0.0,

  exposure: 1.03,
  starCount: 45,
  starSize: 0.028,
  showStars: true,

  freeWidth: 3000,
  freeHeight: 3000
};

init();
animate();

function init() {
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(
    params.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.minDistance = 4;
  controls.maxDistance = 240;

  saturnGroup = new THREE.Group();
  ringGroup = new THREE.Group();

  saturnGroup.add(ringGroup);
  scene.add(saturnGroup);

  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, params.lightIntensity);
  scene.add(sunLight);

  createPlanet();
  createCloudLayer();
  createAtmosphereGlow();
  buildRingMesh();
  createStars();

  createGui();
  bindHud();

  applySceneProfile('Missão Cassini', { forcePreset: true });

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);
}

function createGui() {
  gui = new GUI({ title: 'SATURN MODE' });

  const actions = {
    'Aplicar perfil': () => applySceneProfile(params.sceneProfile, { forcePreset: true }),
    'Resetar modo atual': () => resetCurrentMode(),
    'Capturar 3840x2160': () => capturePreset('4k'),
    'Capturar 2160x3840': () => capturePreset('vertical4k'),
    'Capturar 4096x4096': () => capturePreset('square4096'),
    'Capturar iPhone 17 PM': () => capturePreset('iphone17pm'),
    'Capturar Livre': () => captureFree()
  };

  const folderMode = gui.addFolder('Modo');

  track(folderMode.add(params, 'sceneProfile', [
    'Missão Cassini',
    'iPhone 17 Pro Max da Terra',
    'Wallpaper Isomium',
    'Modo Livre'
  ]).name('Perfil').onChange((value) => applySceneProfile(value)));

  track(folderMode.add(params, 'showPhoneFrame').name('Mostrar guia celular').onChange(updatePhonePreview));
  track(folderMode.add(params, 'phoneOrientation', ['Vertical', 'Horizontal']).name('Orientação celular').onChange(updatePhonePreview));
  track(folderMode.add(params, 'keepPhoneGuideInFreeMode').name('Guia no Livre').onChange(updatePhonePreview));
  track(folderMode.add(actions, 'Aplicar perfil'));
  track(folderMode.add(actions, 'Resetar modo atual'));

  const folderComp = gui.addFolder('Composição');
  track(folderComp.add(params, 'fov', 5, 80, 0.1).name('FOV').onChange(applyCameraFromParams));
  track(folderComp.add(params, 'distance', 4, 240, 0.1).name('Distância').onChange(applyCameraFromParams));
  track(folderComp.add(params, 'offsetX', -40, 40, 0.01).name('Offset X').onChange(applyCameraFromParams));
  track(folderComp.add(params, 'offsetY', -40, 40, 0.01).name('Offset Y').onChange(applyCameraFromParams));
  track(folderComp.add(params, 'frameRotationZ', -180, 180, 0.1).name('Rotação quadro').onChange(updateScene));
  track(folderComp.add(params, 'subjectScale', 0.01, 5.0, 0.001).name('Escala assunto').onChange(updateScene));

  const folderSaturn = gui.addFolder('Saturno');
  track(folderSaturn.add(params, 'polarFlattening', 0.75, 1.05, 0.001).name('Achatamento polar').onChange(updateScene));
  track(folderSaturn.add(params, 'planetBrightness', 0.05, 3.0, 0.01).name('Brilho').onChange(updateScene));
  track(folderSaturn.add(params, 'bandVisibility', 0, 2.5, 0.01).name('Bandas visíveis').onChange(updateScene));
  track(folderSaturn.add(params, 'terminatorSoftness', 0.01, 1.5, 0.01).name('Suavidade terminador').onChange(updateScene));
  track(folderSaturn.add(params, 'cloudOpacity', 0, 0.8, 0.01).name('Opac. nuvens').onChange(updateScene));
  track(folderSaturn.add(params, 'cloudSpeed', 0, 0.12, 0.001).name('Rot. nuvens'));
  track(folderSaturn.add(params, 'planetSpinSpeed', 0, 0.08, 0.001).name('Rot. planeta'));
  track(folderSaturn.add(params, 'showHexagonHint').name('Hexágono polar').onChange(rebuildPlanetMaps));
  track(folderSaturn.add(params, 'hexagonStrength', 0, 0.8, 0.01).name('Força hexágono').onChange(rebuildPlanetMaps));

  const folderAtmosphere = gui.addFolder('Atmosfera');
  track(folderAtmosphere.add(params, 'atmosphereGlow', 0, 2.0, 0.01).name('Rim glow').onChange(updateScene));
  track(folderAtmosphere.add(params, 'atmospherePower', 0.5, 8.0, 0.01).name('Queda glow').onChange(updateScene));
  track(folderAtmosphere.add(params, 'atmosphereScale', 1.0, 1.15, 0.001).name('Escala atmosfera').onChange(updateScene));
  track(folderAtmosphere.add(params, 'limbIrregularity', 0, 1.0, 0.01).name('Irregularidade limbo').onChange(updateScene));

  const folderShadow = gui.addFolder('Sombra dos Anéis');
  track(folderShadow.add(params, 'physicalRingShadow', 0, 2.0, 0.01).name('Sombra física').onChange(updateScene));
  track(folderShadow.add(params, 'ringShadowSharpness', 0.02, 2.0, 0.01).name('Nitidez física').onChange(updateScene));

  const folderRings = gui.addFolder('Anéis');
  track(folderRings.add(params, 'ringInnerRadius', 4.0, 14.0, 0.01).name('Raio interno').onFinishChange(buildRingMesh));
  track(folderRings.add(params, 'ringOuterRadius', 6.0, 24.0, 0.01).name('Raio externo').onFinishChange(buildRingMesh));
  track(folderRings.add(params, 'ringTilt', 0, 89, 0.1).name('Inclinação').onChange(updateScene));
  track(folderRings.add(params, 'ringOpacity', 0, 1.0, 0.01).name('Opacidade').onChange(updateScene));
  track(folderRings.add(params, 'ringBrightness', 0.05, 2.5, 0.01).name('Brilho').onChange(updateScene));
  track(folderRings.add(params, 'ringMacroChaos', 0, 2.0, 0.01).name('Caos macro').onFinishChange(buildRingMesh));
  track(folderRings.add(params, 'ringClumpStrength', 0, 1.5, 0.01).name('Aglomerados').onFinishChange(buildRingMesh));
  track(folderRings.add(params, 'ringRadialChaos', 0, 1.5, 0.01).name('Caos radial').onFinishChange(buildRingMesh));
  track(folderRings.add(params, 'ringSpiralWaves', 0, 1.5, 0.01).name('Ondas').onFinishChange(buildRingMesh));

  const folderLight = gui.addFolder('Luz');
  track(folderLight.add(params, 'lightX', -80, 80, 0.1).name('Luz X').onChange(updateScene));
  track(folderLight.add(params, 'lightY', -80, 80, 0.1).name('Luz Y').onChange(updateScene));
  track(folderLight.add(params, 'lightZ', -80, 80, 0.1).name('Luz Z').onChange(updateScene));
  track(folderLight.add(params, 'lightIntensity', 0, 12.0, 0.01).name('Intensidade').onChange(updateScene));
  track(folderLight.add(params, 'ambientIntensity', 0, 2.0, 0.001).name('Luz ambiente').onChange(updateScene));

  const folderRender = gui.addFolder('Render / Câmera');
  track(folderRender.add(params, 'cameraMono').name('Preto e branco').onChange(updateScene));
  track(folderRender.add(params, 'exposure', 0.1, 3.5, 0.01).name('Exposição').onChange(updateScene));
  track(folderRender.add(params, 'sensorNoise', 0, 0.25, 0.001).name('Ruído sensor'));
  track(folderRender.add(params, 'vignette', 0, 1.2, 0.01).name('Vinheta'));
  track(folderRender.add(params, 'bloomMin', 0, 0.35, 0.001).name('Bloom mínimo'));
  track(folderRender.add(params, 'showStars').name('Mostrar estrelas').onChange(updateScene));
  track(folderRender.add(params, 'starCount', 0, 2000, 1).name('Qtd estrelas').onFinishChange(createStars));
  track(folderRender.add(params, 'starSize', 0.001, 0.12, 0.001).name('Tam. estrelas').onFinishChange(createStars));

  const folderCapture = gui.addFolder('Captura Livre');
  track(folderCapture.add(params, 'freeWidth', 320, 12000, 1).name('Largura'));
  track(folderCapture.add(params, 'freeHeight', 320, 12000, 1).name('Altura'));

  const folderActions = gui.addFolder('Ações');
  track(folderActions.add(actions, 'Capturar 3840x2160'));
  track(folderActions.add(actions, 'Capturar 2160x3840'));
  track(folderActions.add(actions, 'Capturar 4096x4096'));
  track(folderActions.add(actions, 'Capturar iPhone 17 PM'));
  track(folderActions.add(actions, 'Capturar Livre'));

  folderMode.open();
  folderComp.open();
  folderActions.open();
}

function bindHud() {
  btnToggleUI?.addEventListener('click', toggleUI);
  btnExport4K?.addEventListener('click', () => capturePreset('4k'));
  btnExportVertical?.addEventListener('click', () => capturePreset('vertical4k'));
  btnExportSquare?.addEventListener('click', () => capturePreset('square4096'));
  btnExportIphone?.addEventListener('click', () => capturePreset('iphone17pm'));
  btnExportFree?.addEventListener('click', captureFree);

  btnReset?.addEventListener('click', resetCurrentMode);
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();

  if (key === 'h') {
    toggleUI();
  }

  if (key === 'p') {
    captureByCurrentMode();
  }
}

function toggleUI() {
  document.body.classList.toggle('ui-hidden');
}

function applySceneProfile(name, options = {}) {
  params.sceneProfile = name;

  if (name === 'Modo Livre') {
    params.captureProfile = 'Modo Livre';

    if (!params.keepPhoneGuideInFreeMode) {
      params.showPhoneFrame = false;
    }

    updateScene();
    updatePhonePreview();
    refreshGui();
    return;
  }

  const preset = PROFILE_PRESETS[name];

  if (!preset) {
    updateScene();
    refreshGui();
    return;
  }

  Object.assign(params, preset);
  params.sceneProfile = name;
  params.captureProfile = name;

  rebuildPlanetMaps();
  buildRingMesh();
  createStars();
  applyCameraFromParams();
  updateScene();
  updatePhonePreview();
  refreshGui();
}

function resetCurrentMode() {
  if (params.sceneProfile === 'Modo Livre') {
    Object.assign(params, FREE_DEFAULTS);
    params.sceneProfile = 'Modo Livre';
    params.captureProfile = 'Modo Livre';

    rebuildPlanetMaps();
    buildRingMesh();
    createStars();
    applyCameraFromParams();
    updateScene();
    updatePhonePreview();
    refreshGui();
    return;
  }

  applySceneProfile(params.sceneProfile || 'Missão Cassini', { forcePreset: true });
}

function applyCameraFromParams() {
  camera.fov = params.fov;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  camera.position.set(params.offsetX, params.offsetY, params.distance);
  controls.target.set(0, 0, 0);
  controls.update();
}

function updateScene() {
  renderer.toneMappingExposure = params.exposure;

  canvas.style.filter = params.cameraMono ? 'grayscale(1)' : 'none';

  saturnGroup.rotation.z = THREE.MathUtils.degToRad(params.frameRotationZ);
  saturnGroup.scale.setScalar(params.subjectScale);

  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  sunLight.intensity = params.lightIntensity;

  ambientLight.intensity = params.ambientIntensity;

  if (planetMesh) {
    planetMesh.scale.set(1, params.polarFlattening, 1);
    updatePlanetShaderUniforms();
  }

  if (cloudMesh) {
    cloudMesh.visible = params.cloudOpacity > 0.001;
    cloudMesh.material.opacity = params.cloudOpacity;
    cloudMesh.scale.set(1.002, params.polarFlattening * 1.004, 1.002);
  }

  if (atmosphereMesh) {
    atmosphereMesh.scale.set(
      params.atmosphereScale,
      params.polarFlattening * params.atmosphereScale,
      params.atmosphereScale
    );

    atmosphereMesh.material.uniforms.uGlowIntensity.value = params.atmosphereGlow;
    atmosphereMesh.material.uniforms.uPower.value = params.atmospherePower;
    atmosphereMesh.material.uniforms.uIrregularity.value = params.limbIrregularity;
    atmosphereMesh.material.uniforms.uLightDirection.value.copy(sunLight.position).normalize();
  }

  if (ringMesh) {
    ringGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
    ringMesh.material.opacity = params.ringOpacity;
    ringMesh.material.color.setScalar(params.ringBrightness);
  }

  if (starField) {
    starField.visible = params.showStars && params.starCount > 0;
  }

  updatePhonePreview();
}

function updatePhonePreview() {
  if (!phonePreviewEl) return;

  const shouldShow =
    params.showPhoneFrame ||
    (params.sceneProfile === 'Modo Livre' && params.keepPhoneGuideInFreeMode && params.showPhoneFrame);

  if (shouldShow) {
    phonePreviewEl.classList.add('active');
  } else {
    phonePreviewEl.classList.remove('active');
  }

  if (params.phoneOrientation === 'Horizontal') {
    phonePreviewEl.classList.add('landscape');
    phonePreviewEl.dataset.label = 'iPhone 17 Pro Max • 2868 × 1320';
  } else {
    phonePreviewEl.classList.remove('landscape');
    phonePreviewEl.dataset.label = 'iPhone 17 Pro Max • 1320 × 2868';
  }
}

function createPlanet() {
  const { colorMap } = createSaturnMaps();

  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 256, 128);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: colorMap },
      uPlanetCenter: { value: new THREE.Vector3(0, 0, 0) },
      uLightDirection: { value: new THREE.Vector3(1, 0, 0) },
      uRingNormal: { value: new THREE.Vector3(0, 0, 1) },

      uLightIntensity: { value: params.lightIntensity },
      uAmbient: { value: params.ambientIntensity },
      uPlanetBrightness: { value: params.planetBrightness },

      uBandVisibility: { value: params.bandVisibility },
      uTerminatorSoftness: { value: params.terminatorSoftness },

      uRingInner: { value: params.ringInnerRadius },
      uRingOuter: { value: params.ringOuterRadius },
      uPhysicalRingShadow: { value: params.physicalRingShadow },
      uRingShadowSharpness: { value: params.ringShadowSharpness }
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uPlanetCenter;
      uniform vec3 uLightDirection;
      uniform vec3 uRingNormal;

      uniform float uLightIntensity;
      uniform float uAmbient;
      uniform float uPlanetBrightness;
      uniform float uBandVisibility;
      uniform float uTerminatorSoftness;

      uniform float uRingInner;
      uniform float uRingOuter;
      uniform float uPhysicalRingShadow;
      uniform float uRingShadowSharpness;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        float a = hash(i.x + i.y * 57.0);
        float b = hash(i.x + 1.0 + i.y * 57.0);
        float c = hash(i.x + (i.y + 1.0) * 57.0);
        float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);

        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(a, b, u.x) +
               (c - a) * u.y * (1.0 - u.x) +
               (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.03;
          amplitude *= 0.52;
        }

        return value;
      }

      float gaussian(float x, float mean, float sigma, float amp) {
        float e = -((x - mean) * (x - mean)) / (2.0 * sigma * sigma);
        return amp * exp(e);
      }

      float ringDensity(float u) {
        if (u < 0.015 || u > 0.995) return 0.0;

        float d = 0.0;

        d += gaussian(u, 0.12, 0.035, 0.08);
        d += gaussian(u, 0.19, 0.060, 0.16);
        d += gaussian(u, 0.29, 0.055, 0.24);

        d += gaussian(u, 0.43, 0.075, 0.78);
        d += gaussian(u, 0.54, 0.060, 0.96);
        d += gaussian(u, 0.62, 0.050, 0.86);

        d -= gaussian(u, 0.705, 0.020, 0.95);

        d += gaussian(u, 0.77, 0.050, 0.54);
        d += gaussian(u, 0.85, 0.040, 0.42);

        d += gaussian(u, 0.915, 0.009, 0.24);
        d += gaussian(u, 0.953, 0.016, 0.09);

        d -= gaussian(u, 0.232, 0.006, 0.07);
        d -= gaussian(u, 0.318, 0.005, 0.08);
        d -= gaussian(u, 0.487, 0.004, 0.10);
        d -= gaussian(u, 0.602, 0.005, 0.09);
        d -= gaussian(u, 0.842, 0.006, 0.08);

        return clamp(d, 0.0, 1.0);
      }

      float physicalRingShadow(vec3 worldPosition, vec3 lightDirection) {
        vec3 ringNormal = normalize(uRingNormal);
        vec3 lightDir = normalize(lightDirection);

        vec3 relPos = worldPosition - uPlanetCenter;
        float denom = dot(ringNormal, lightDir);

        if (abs(denom) < 0.001) return 0.0;

        float t = -dot(ringNormal, relPos) / denom;

        if (t <= 0.0) return 0.0;

        vec3 hitPoint = relPos + lightDir * t;
        float radius = length(hitPoint);

        float u = (radius - uRingInner) / (uRingOuter - uRingInner);

        if (u < 0.0 || u > 1.0) return 0.0;

        float density = ringDensity(u);
        float n = fbm(vec2(u * 22.0, hitPoint.x * 0.4 + hitPoint.z * 0.4));

        density *= mix(0.72, 1.18, n);

        float shadow = smoothstep(0.02, uRingShadowSharpness, density);

        return shadow * uPhysicalRingShadow;
      }

      void main() {
        vec3 baseColor = texture2D(uMap, vUv).rgb;

        vec3 normal = normalize(vWorldNormal);
        vec3 lightDir = normalize(uLightDirection);

        float ndl = dot(normal, lightDir);

        float sunlight = smoothstep(
          -uTerminatorSoftness,
          0.85,
          ndl
        );

        float latitude = vUv.y;

        float bands =
          sin(latitude * 95.0 + fbm(vec2(vUv.x * 4.0, latitude * 12.0)) * 2.2) * 0.030 +
          sin(latitude * 180.0 + fbm(vec2(vUv.x * 8.0, latitude * 18.0)) * 2.0) * 0.018 +
          sin(latitude * 34.0) * 0.035;

        float cloudNoise = fbm(vec2(vUv.x * 18.0, latitude * 95.0));
        bands += (cloudNoise - 0.5) * 0.055;

        baseColor *= 1.0 + bands * uBandVisibility;

        float ringShadow = physicalRingShadow(vWorldPosition, lightDir);

        float lightValue =
          uAmbient +
          sunlight * uLightIntensity * (1.0 - ringShadow);

        vec3 nightColor = baseColor * 0.014;
        vec3 litColor = baseColor * lightValue;

        vec3 color = mix(nightColor, litColor, sunlight);

        float terminatorGlow =
          smoothstep(-0.18, 0.16, ndl) *
          (1.0 - smoothstep(0.10, 0.55, ndl));

        color += baseColor * terminatorGlow * 0.10;
        color *= uPlanetBrightness;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  planetMesh = new THREE.Mesh(geometry, material);
  planetMesh.scale.set(1, params.polarFlattening, 1);

  saturnGroup.add(planetMesh);

  updatePlanetShaderUniforms();
}

function createCloudLayer() {
  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 192, 96);

  const material = new THREE.MeshPhongMaterial({
    map: createCloudTexture(),
    transparent: true,
    opacity: params.cloudOpacity,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  cloudMesh = new THREE.Mesh(geometry, material);
  cloudMesh.scale.set(1.002, params.polarFlattening * 1.004, 1.002);

  saturnGroup.add(cloudMesh);
}

function createAtmosphereGlow() {
  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 192, 96);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uGlowIntensity: { value: params.atmosphereGlow },
      uPower: { value: params.atmospherePower },
      uColor: { value: new THREE.Color(0xf2e7c8) },
      uLightDirection: { value: new THREE.Vector3().copy(sunLight.position).normalize() },
      uIrregularity: { value: params.limbIrregularity }
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

        vNormal = normalize(normalMatrix * normal);
        vViewPosition = -mvPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * mvPosition;
      }
    `,

    fragmentShader: `
      uniform float uGlowIntensity;
      uniform float uPower;
      uniform vec3 uColor;
      uniform vec3 uLightDirection;
      uniform float uIrregularity;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldNormal;

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        float a = hash(i.x + i.y * 57.0);
        float b = hash(i.x + 1.0 + i.y * 57.0);
        float c = hash(i.x + (i.y + 1.0) * 57.0);
        float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);

        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(a, b, u.x) +
          (c - a) * u.y * (1.0 - u.x) +
          (d - b) * u.x * u.y;
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        vec3 worldNormal = normalize(vWorldNormal);
        vec3 lightDir = normalize(uLightDirection);

        float rim = 1.0 - max(dot(normal, viewDir), 0.0);

        float irregular =
          noise(vec2(vUv.y * 44.0, vUv.x * 8.0)) * 0.55 +
          noise(vec2(vUv.y * 130.0, vUv.x * 3.0)) * 0.25;

        rim += (irregular - 0.5) * uIrregularity;
        rim = clamp(rim, 0.0, 1.0);
        rim = pow(rim, uPower);

        float lightSide = smoothstep(-0.25, 0.65, dot(worldNormal, lightDir));
        float alpha = rim * lightSide * uGlowIntensity;

        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });

  atmosphereMesh = new THREE.Mesh(geometry, material);

  atmosphereMesh.scale.set(
    params.atmosphereScale,
    params.polarFlattening * params.atmosphereScale,
    params.atmosphereScale
  );

  saturnGroup.add(atmosphereMesh);
}

function updatePlanetShaderUniforms() {
  if (!planetMesh?.material?.uniforms) return;

  const uniforms = planetMesh.material.uniforms;

  uniforms.uPlanetCenter.value.set(0, 0, 0);
  uniforms.uLightDirection.value.copy(sunLight.position).normalize();

  const ringNormal = new THREE.Vector3(0, 0, 1);

  if (ringGroup) {
    ringGroup.updateWorldMatrix(true, false);
    ringNormal.applyQuaternion(ringGroup.getWorldQuaternion(new THREE.Quaternion()));
  }

  uniforms.uRingNormal.value.copy(ringNormal.normalize());
  uniforms.uLightIntensity.value = params.lightIntensity;
  uniforms.uAmbient.value = params.ambientIntensity;
  uniforms.uPlanetBrightness.value = params.planetBrightness;
  uniforms.uBandVisibility.value = params.bandVisibility;
  uniforms.uTerminatorSoftness.value = params.terminatorSoftness;
  uniforms.uRingInner.value = params.ringInnerRadius;
  uniforms.uRingOuter.value = params.ringOuterRadius;
  uniforms.uPhysicalRingShadow.value = params.physicalRingShadow;
  uniforms.uRingShadowSharpness.value = params.ringShadowSharpness;
}

function createSaturnMaps() {
  const width = 4096;
  const height = 2048;

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = width;
  mapCanvas.height = height;

  const ctx = mapCanvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = (v - 0.5) * 2.0;

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);

      let bands =
        Math.sin(v * 26.0) * 0.020 +
        Math.sin(v * 62.0 + pseudoNoise2D(u * 7.0, v * 5.0) * 0.8) * 0.028 +
        Math.sin(v * 128.0 + pseudoNoise2D(u * 14.0, v * 18.0) * 1.6) * 0.014;

      bands += (fbm2D(u * 6.0, v * 18.0) - 0.5) * 0.045;

      const polarFade = smoothstep(0.15, 0.95, Math.abs(lat));

      const baseR = 0.92 - polarFade * 0.06;
      const baseG = 0.86 - polarFade * 0.06;
      const baseB = 0.72 - polarFade * 0.05;

      let r = baseR + bands * 0.55;
      let g = baseG + bands * 0.42;
      let b = baseB + bands * 0.20;

      if (params.showHexagonHint && v < 0.20) {
        const cx = 0.5;
        const cy = 0.10;

        const dx = u - cx;
        const dy = v - cy;

        const angle = Math.atan2(dy, dx);
        const radius = Math.sqrt(dx * dx + dy * dy);
        const hex = Math.cos(angle * 6.0);
        const hexBand = smoothstep(0.10, 0.02, Math.abs(radius - (0.10 + hex * 0.010)));
        const hint = hexBand * params.hexagonStrength;

        r -= hint * 0.06;
        g -= hint * 0.07;
        b -= hint * 0.08;
      }

      const i = (y * width + x) * 4;

      data[i] = clamp(r * 255, 0, 255);
      data[i + 1] = clamp(g * 255, 0, 255);
      data[i + 2] = clamp(b * 255, 0, 255);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const colorMap = new THREE.CanvasTexture(mapCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.anisotropy = 16;

  return { colorMap };
}

function createCloudTexture() {
  const width = 2048;
  const height = 1024;

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = width;
  cloudCanvas.height = height;

  const ctx = cloudCanvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);

      let n =
        fbm2D(u * 12.0, v * 50.0) * 0.65 +
        fbm2D(u * 32.0, v * 120.0) * 0.35;

      n = clamp(n, 0, 1);

      const band =
        Math.sin(v * 120.0 + fbm2D(u * 8.0, v * 40.0) * 2.0) * 0.5 + 0.5;

      const alpha = clamp((n * band - 0.42) * 2.2, 0, 1) * 0.55;

      const i = (y * width + x) * 4;

      data[i] = 245;
      data[i + 1] = 242;
      data[i + 2] = 236;
      data[i + 3] = clamp(alpha * 255, 0, 255);
    }
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(cloudCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;

  return texture;
}

function buildRingMesh() {
  if (ringMesh) {
    ringGroup.remove(ringMesh);
    disposeMaterial(ringMesh.material);
    ringMesh.geometry.dispose();
  }

  if (params.ringOuterRadius <= params.ringInnerRadius + 0.1) {
    params.ringOuterRadius = params.ringInnerRadius + 0.1;
  }

  const geometry = new THREE.RingGeometry(
    params.ringInnerRadius,
    params.ringOuterRadius,
    520,
    1
  );

  remapRingUVs(geometry, params.ringInnerRadius, params.ringOuterRadius);

  const texture = createRingTexture();

  const material = new THREE.MeshPhongMaterial({
    map: texture,
    alphaMap: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    opacity: params.ringOpacity,
    alphaTest: 0.025,
    color: new THREE.Color().setScalar(params.ringBrightness),
    shininess: 18
  });

  ringMesh = new THREE.Mesh(geometry, material);

  ringGroup.add(ringMesh);
  ringGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);

  updatePlanetShaderUniforms();
}

function remapRingUVs(geometry, innerRadius, outerRadius) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const radius = Math.sqrt(x * x + y * y);

    let angle = Math.atan2(y, x);
    if (angle < 0) angle += Math.PI * 2;

    const u = (radius - innerRadius) / (outerRadius - innerRadius);
    const v = angle / (Math.PI * 2);

    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

function createRingTexture() {
  const width = 4096;
  const height = 768;

  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = width;
  ringCanvas.height = height;

  const ctx = ringCanvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    const theta = y / height;

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);

      let density = ringDensityProfile(u);

      const macro =
        fbm2D(u * 12.0, theta * 7.0) * 0.55 +
        fbm2D(u * 26.0, theta * 13.0) * 0.28 +
        fbm2D(u * 58.0, theta * 31.0) * 0.14;

      const wakes =
        Math.sin(u * 180.0 + theta * 38.0 + fbm2D(u * 15.0, theta * 11.0) * 8.0) * 0.050;

      const clumps =
        smoothstep(0.62, 0.92, fbm2D(u * 38.0, theta * 24.0)) *
        params.ringClumpStrength;

      const broadZones =
        Math.sin(u * 16.0 + fbm2D(theta * 8.0, u * 4.0) * 2.0) * 0.075;

      density *= 1.0 + (macro - 0.5) * params.ringMacroChaos;
      density += wakes * params.ringSpiralWaves;
      density += clumps * 0.18;
      density += broadZones;
      density += (fbm2D(u * 140.0, theta * 2.8) - 0.5) * 0.08 * params.ringRadialChaos;

      const gapNoise = fbm2D(u * 210.0, theta * 4.0);

      if (gapNoise > 0.84) {
        density *= 0.62;
      }

      density = clamp(density, 0, 1);

      const iceTint = 0.84 + density * 0.25;

      const r = 226 * iceTint;
      const g = 222 * iceTint;
      const b = 211 * iceTint;
      const a = density;

      const i = (y * width + x) * 4;

      data[i] = clamp(r, 0, 255);
      data[i + 1] = clamp(g, 0, 255);
      data[i + 2] = clamp(b, 0, 255);
      data[i + 3] = clamp(a * 255, 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;

  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(ringCanvas, 0, 0);

  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.filter = 'blur(0.7px)';
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();

  const texture = new THREE.CanvasTexture(ringCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;

  return texture;
}

function ringDensityProfile(u) {
  if (u < 0.015 || u > 0.995) return 0;

  let d = 0;

  d += gaussian(u, 0.12, 0.035, 0.08);
  d += gaussian(u, 0.19, 0.060, 0.16);
  d += gaussian(u, 0.29, 0.055, 0.24);

  d += gaussian(u, 0.43, 0.075, 0.78);
  d += gaussian(u, 0.54, 0.060, 0.96);
  d += gaussian(u, 0.62, 0.050, 0.86);

  d -= gaussian(u, 0.705, 0.020, 0.95);

  d += gaussian(u, 0.77, 0.050, 0.54);
  d += gaussian(u, 0.85, 0.040, 0.42);

  d += gaussian(u, 0.915, 0.009, 0.24);
  d += gaussian(u, 0.953, 0.016, 0.09);

  d -= gaussian(u, 0.232, 0.006, 0.07);
  d -= gaussian(u, 0.318, 0.005, 0.08);
  d -= gaussian(u, 0.487, 0.004, 0.10);
  d -= gaussian(u, 0.602, 0.005, 0.09);
  d -= gaussian(u, 0.842, 0.006, 0.08);

  return clamp(d, 0, 1);
}

function createStars() {
  if (starField) {
    scene.remove(starField);
    starField.geometry.dispose();
    starField.material.dispose();
    starField = null;
  }

  if (!params.showStars || params.starCount <= 0) return;

  const positions = new Float32Array(params.starCount * 3);
  const colors = new Float32Array(params.starCount * 3);

  for (let i = 0; i < params.starCount; i++) {
    const radius = randomRange(280, 850);
    const theta = randomRange(0, Math.PI * 2);
    const phi = Math.acos(randomRange(-1, 1));

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const base = randomRange(0.65, 1.0);

    colors[i * 3] = base;
    colors[i * 3 + 1] = base * randomRange(0.96, 1.0);
    colors[i * 3 + 2] = base * randomRange(0.90, 1.0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: params.starSize * 10,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  starField = new THREE.Points(geometry, material);
  scene.add(starField);
}

function rebuildPlanetMaps() {
  const { colorMap } = createSaturnMaps();

  if (planetMesh?.material?.uniforms?.uMap?.value) {
    planetMesh.material.uniforms.uMap.value.dispose();
  }

  planetMesh.material.uniforms.uMap.value = colorMap;
  planetMesh.material.needsUpdate = true;

  if (cloudMesh?.material?.map) {
    cloudMesh.material.map.dispose();
  }

  cloudMesh.material.map = createCloudTexture();
  cloudMesh.material.needsUpdate = true;

  updateScene();
}

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();

  if (planetMesh) {
    planetMesh.rotation.y += params.planetSpinSpeed * dt;
  }

  if (cloudMesh) {
    cloudMesh.rotation.y += params.cloudSpeed * dt;
  }

  controls.update();
  updatePlanetShaderUniforms();

  renderer.render(scene, camera);
}

function captureByCurrentMode() {
  if (params.sceneProfile === 'iPhone 17 Pro Max da Terra') {
    capturePreset('iphone17pm');
    return;
  }

  if (params.sceneProfile === 'Modo Livre') {
    captureFree();
    return;
  }

  if (params.sceneProfile === 'Wallpaper Isomium') {
    capturePreset('square4096');
    return;
  }

  capturePreset('4k');
}

function capturePreset(type) {
  if (type === '4k') {
    captureImage(3840, 2160, 'Isomium_Saturn_3840x2160.png');
    return;
  }

  if (type === 'vertical4k') {
    captureImage(2160, 3840, 'Isomium_Saturn_2160x3840.png');
    return;
  }

  if (type === 'square4096') {
    captureImage(4096, 4096, 'Isomium_Saturn_4096x4096.png');
    return;
  }

  if (type === 'iphone17pm') {
    if (params.phoneOrientation === 'Horizontal') {
      captureImage(2868, 1320, 'Isomium_Saturn_iPhone17ProMax_Landscape.png');
    } else {
      captureImage(1320, 2868, 'Isomium_Saturn_iPhone17ProMax_Portrait.png');
    }
  }
}

function captureFree() {
  const width = Math.max(320, Math.floor(params.freeWidth));
  const height = Math.max(320, Math.floor(params.freeHeight));

  captureImage(width, height, `Isomium_Saturn_${width}x${height}.png`);
}

async function captureImage(width, height, fileName) {
  showCaptureStatus(`Renderizando ${width} × ${height}...`);
  triggerFlash();

  await nextFrame();

  const oldPixelRatio = renderer.getPixelRatio();
  const oldSize = renderer.getSize(new THREE.Vector2());
  const oldAspect = camera.aspect;
  const oldCanvasFilter = canvas.style.filter;

  const wasPhoneVisible = phonePreviewEl?.classList.contains('active') || false;
  const uiWasHidden = document.body.classList.contains('ui-hidden');

  phonePreviewEl?.classList.remove('active');
  document.body.classList.add('ui-hidden');

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  canvas.style.filter = 'none';

  renderer.render(scene, camera);

  const processedCanvas = applyCameraPostProcess(renderer.domElement, width, height);
  const dataURL = processedCanvas.toDataURL('image/png', 1.0);

  downloadDataURL(dataURL, fileName);

  renderer.setPixelRatio(oldPixelRatio);
  renderer.setSize(oldSize.x, oldSize.y, false);

  camera.aspect = oldAspect;
  camera.updateProjectionMatrix();

  canvas.style.filter = oldCanvasFilter;

  if (!uiWasHidden) {
    document.body.classList.remove('ui-hidden');
  }

  if (wasPhoneVisible) {
    phonePreviewEl?.classList.add('active');
  }

  hideCaptureStatus();
}

function applyCameraPostProcess(sourceCanvas, width, height) {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;

  const ctx = output.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (params.cameraMono) {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = gray;
        g = gray;
        b = gray;
      }

      if (params.sensorNoise > 0) {
        const grain = (Math.random() - 0.5) * 255 * params.sensorNoise;
        r += grain;
        g += grain;
        b += grain;
      }

      if (params.vignette > 0) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
        const vignette = 1.0 - Math.pow(dist, 1.7) * params.vignette;

        r *= vignette;
        g *= vignette;
        b *= vignette;
      }

      data[i] = clamp(r, 0, 255);
      data[i + 1] = clamp(g, 0, 255);
      data[i + 2] = clamp(b, 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  if (params.bloomMin > 0) {
    ctx.save();
    ctx.globalAlpha = params.bloomMin;
    ctx.filter = 'blur(2px)';
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(output, 0, 0);
    ctx.restore();
  }

  return output;
}

function triggerFlash() {
  if (!flashEl) return;

  flashEl.style.opacity = '1';

  setTimeout(() => {
    flashEl.style.opacity = '0';
  }, 90);
}

function showCaptureStatus(text) {
  if (!captureStatusEl) return;

  captureStatusEl.textContent = text;
  captureStatusEl.style.display = 'block';
}

function hideCaptureStatus() {
  if (!captureStatusEl) return;

  setTimeout(() => {
    captureStatusEl.style.display = 'none';
  }, 350);
}

function downloadDataURL(dataURL, fileName) {
  const link = document.createElement('a');

  link.href = dataURL;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function onWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setSize(w, h);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function track(controller) {
  guiControllers.push(controller);
  return controller;
}

function refreshGui() {
  for (const controller of guiControllers) {
    controller.updateDisplay();
  }
}

function disposeMaterial(material) {
  if (!material) return;

  if (material.map) material.map.dispose();
  if (material.alphaMap) material.alphaMap.dispose();

  material.dispose();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/* ---------------------- Helpers matemáticos ---------------------- */

function gaussian(x, mean, sigma, amp) {
  return amp * Math.exp(-((x - mean) ** 2) / (2 * sigma * sigma));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function pseudoNoise2D(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function fbm2D(x, y) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;

  for (let i = 0; i < 5; i++) {
    value += amplitude * pseudoNoise2D(x * frequency, y * frequency);
    frequency *= 2.02;
    amplitude *= 0.52;
  }

  return value;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
