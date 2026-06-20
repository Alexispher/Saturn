import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const canvas = document.getElementById('space-canvas');
const captureStatus = document.getElementById('capture-status');
const flash = document.getElementById('flash');

const PLANET_RADIUS = 1.85;

const params = {
  // UI / cena
  showUI: true,
  autoRotate: false,
  autoRotateSpeed: 0.04,

  // Modo câmera
  cameraProfile: 'Cassini Natural',
  sensorGrain: 0.014,
  cameraVignette: 0.20,
  cameraBloom: 0.025,
  cameraMono: false,
  mobileWallpaperMode: false,

  // Câmera / composição
  cameraFov: 24,
  cameraDistance: 16.8,
  cameraOffsetX: 0.0,
  cameraOffsetY: 0.2,

  // Saturno
  frameRotationZ: -8,
  planetSpinSpeed: 0.0,
  polarFlattening: 0.902,
  planetBrightness: 1.0,
  bumpScale: 0.003,
  cloudOpacity: 0.09,
  cloudSpeed: 0.0,
  showHexagonHint: true,

  // Luz
lightX: 8.5,
lightY: 4.0,
lightZ: 10.5,
lightIntensity: 2.55,
ambientIntensity: 0.0,

  // Atmosfera / rim scattering
  atmosphereGlow: 0.34,
  atmospherePower: 2.7,
  atmosphereScale: 1.025,

  // Sombra dos anéis na atmosfera
  ringShadowStrength: 0.34,
  ringShadowSoftness: 0.72,

  // Anéis
  ringTilt: 73.5,
  ringOpacity: 0.97,
  ringBrightness: 1.0,
  ringChaos: 0.52,
  ringSpiralWaves: 0.38,
  ringInnerRadius: 2.24,
  ringOuterRadius: 4.95,

  // Fundo
  starCount: 65,
  starBrightness: 0.055,
  starSize: 0.028,

  // Render
  rendererExposure: 0.96
};

let scene;
let camera;
let renderer;
let controls;
let gui;
let clock;

let sunLight;
let ambientLight;

let saturnGroup;
let planetMesh;
let cloudMesh;
let atmosphereMesh;
let ringGroup;
let ringMesh;
let stars;

init();
animate();

function init() {
  clock = new THREE.Clock();

  createRenderer();
  createScene();
  createCamera();
  createLights();
  createSaturnSystem();
  createStars();
  createControls();
  createGui();
  bindButtons();
  bindKeyboard();

  window.addEventListener('resize', onResize);

  updateScene();
  onResize();
}

function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.rendererExposure;
}

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
}

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    params.cameraFov,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );

  updateCameraPosition();
}

function createLights() {
  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, params.lightIntensity);
  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  scene.add(sunLight);
}

function createSaturnSystem() {
  saturnGroup = new THREE.Group();
  saturnGroup.rotation.z = THREE.MathUtils.degToRad(params.frameRotationZ);
  scene.add(saturnGroup);

  createPlanet();
  createCloudLayer();
  createAtmosphereGlow();
  createRings();
}

function createPlanet() {
  const { colorMap, bumpMap } = createSaturnMaps();

  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 256, 128);

  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    bumpMap,
    bumpScale: params.bumpScale,
    roughness: 1.0,
    metalness: 0,
    color: new THREE.Color(
      params.planetBrightness,
      params.planetBrightness,
      params.planetBrightness
    )
  });

  planetMesh = new THREE.Mesh(geometry, material);
  planetMesh.scale.set(1, params.polarFlattening, 1);
  saturnGroup.add(planetMesh);
}

function createCloudLayer() {
  const cloudMap = createCloudTexture();

  const geometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.008, 192, 96);

  const material = new THREE.MeshStandardMaterial({
    map: cloudMap,
    transparent: true,
    opacity: params.cloudOpacity,
    roughness: 1.0,
    metalness: 0,
    depthWrite: false
  });

  cloudMesh = new THREE.Mesh(geometry, material);
  cloudMesh.scale.set(1, params.polarFlattening, 1);
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
      uLightDirection: { value: new THREE.Vector3().copy(sunLight.position).normalize() }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewPosition = -mvPosition.xyz;

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uGlowIntensity;
      uniform float uPower;
      uniform vec3 uColor;
      uniform vec3 uLightDirection;

      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(vViewPosition);
        vec3 lightDir = normalize(uLightDirection);

        float rim = 1.0 - max(dot(normalize(normalMatrix * normal), viewDir), 0.0);
        rim = pow(rim, uPower);

        float lightSide = smoothstep(-0.15, 0.65, dot(normal, lightDir));

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

function createRings() {
  ringGroup = new THREE.Group();
  ringGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
  saturnGroup.add(ringGroup);

  buildRingMesh();
}

function buildRingMesh() {
  clearRingGroup();

  const ringGeometry = new THREE.RingGeometry(
    params.ringInnerRadius,
    params.ringOuterRadius,
    1536,
    18
  );

  fixRingUV(ringGeometry, params.ringInnerRadius, params.ringOuterRadius);

  const ringTexture = createRingTexture();

  const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    transparent: true,
    opacity: params.ringOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 1.0,
    metalness: 0,
    color: new THREE.Color(
      params.ringBrightness,
      params.ringBrightness,
      params.ringBrightness
    )
  });

  ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringGroup.add(ringMesh);
}

function clearRingGroup() {
  if (!ringGroup) return;

  while (ringGroup.children.length > 0) {
    const child = ringGroup.children.pop();

    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (child.material.map) {
        child.material.map.dispose();
      }

      child.material.dispose();
    }
  }
}

function createStars() {
  const positions = [];
  const colors = [];
  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < params.starCount; i++) {
    const radius = THREE.MathUtils.randFloat(120, 260);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    const intensity = THREE.MathUtils.randFloat(0.5, 1.0) * params.starBrightness;
    colors.push(intensity, intensity, intensity);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: params.starSize,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;

  controls.enablePan = true;
  controls.minDistance = 5;
  controls.maxDistance = 40;

  controls.target.set(0, 0, 0);
  controls.update();
}

function createGui() {
  gui = new GUI({
    title: 'SATURN CASSINI MODE',
    width: 340
  });

  const folderCamera = gui.addFolder('Composição');
  folderCamera.add(params, 'cameraFov', 12, 65, 1).name('FOV').onChange(updateScene);
  folderCamera.add(params, 'cameraDistance', 5, 35, 0.1).name('Distância').onChange(updateCameraPosition);
  folderCamera.add(params, 'cameraOffsetX', -8, 8, 0.01).name('Offset X').onChange(updateCameraPosition);
  folderCamera.add(params, 'cameraOffsetY', -5, 5, 0.01).name('Offset Y').onChange(updateCameraPosition);
  folderCamera.add(params, 'frameRotationZ', -30, 30, 0.1).name('Rotação quadro').onChange(updateScene);

  const folderCameraMode = gui.addFolder('Modo Câmera');
  folderCameraMode
    .add(params, 'cameraProfile', [
      'Cassini Natural',
      'Cassini Mono',
      'Wallpaper Celular',
      'Deep Black Print'
    ])
    .name('Perfil')
    .onChange(applyCameraProfile);

  folderCameraMode.add(params, 'sensorGrain', 0, 0.08, 0.001).name('Ruído sensor');
  folderCameraMode.add(params, 'cameraVignette', 0, 0.75, 0.01).name('Vinheta');
  folderCameraMode.add(params, 'cameraBloom', 0, 0.12, 0.001).name('Bloom mínimo');
  folderCameraMode.add(params, 'cameraMono').name('P&B câmera');

  folderCameraMode
    .add(params, 'mobileWallpaperMode')
    .name('Modo celular')
    .onChange(() => {
      if (params.mobileWallpaperMode) {
        applyMobileWallpaperPreset();
      }
    });

  const folderPlanet = gui.addFolder('Saturno');
  folderPlanet.add(params, 'polarFlattening', 0.82, 1.0, 0.001).name('Achatamento polar').onChange(updateScene);
  folderPlanet.add(params, 'planetBrightness', 0.5, 1.5, 0.01).name('Brilho').onChange(updateScene);
  folderPlanet.add(params, 'bumpScale', 0, 0.012, 0.0005).name('Relevo nuvens').onChange(updateScene);
  folderPlanet.add(params, 'cloudOpacity', 0, 0.35, 0.01).name('Opac. nuvens').onChange(updateScene);
  folderPlanet.add(params, 'planetSpinSpeed', 0, 0.01, 0.0001).name('Rot. planeta');
  folderPlanet.add(params, 'cloudSpeed', 0, 0.02, 0.0001).name('Rot. nuvens');
  folderPlanet.add(params, 'showHexagonHint').name('Hexágono polar').onChange(rebuildPlanetMaps);

  const folderAtmosphere = gui.addFolder('Atmosfera');
  folderAtmosphere.add(params, 'atmosphereGlow', 0, 1.2, 0.01).name('Rim glow').onChange(updateScene);
  folderAtmosphere.add(params, 'atmospherePower', 0.5, 6, 0.01).name('Queda glow').onChange(updateScene);
  folderAtmosphere.add(params, 'atmosphereScale', 1.0, 1.08, 0.001).name('Escala atmosfera').onChange(updateScene);

  const folderShadows = gui.addFolder('Sombra dos Anéis');
  folderShadows.add(params, 'ringShadowStrength', 0, 1, 0.01).name('Intensidade').onChange(rebuildPlanetMaps);
  folderShadows.add(params, 'ringShadowSoftness', 0, 2, 0.01).name('Suavidade').onChange(rebuildPlanetMaps);

  const folderRings = gui.addFolder('Anéis');
  folderRings.add(params, 'ringTilt', 50, 89, 0.1).name('Inclinação').onChange(updateScene);
  folderRings.add(params, 'ringOpacity', 0.2, 1.0, 0.01).name('Opacidade').onChange(updateScene);
  folderRings.add(params, 'ringBrightness', 0.4, 1.4, 0.01).name('Brilho').onChange(updateScene);
  folderRings.add(params, 'ringChaos', 0, 1.2, 0.01).name('Caos radial').onFinishChange(buildRingMesh);
  folderRings.add(params, 'ringSpiralWaves', 0, 1.2, 0.01).name('Ondas').onFinishChange(buildRingMesh);

  const folderLight = gui.addFolder('Luz');
  folderLight.add(params, 'lightX', -20, 20, 0.1).name('Luz X').onChange(updateScene);
  folderLight.add(params, 'lightY', -20, 20, 0.1).name('Luz Y').onChange(updateScene);
  folderLight.add(params, 'lightZ', -20, 20, 0.1).name('Luz Z').onChange(updateScene);
  folderLight.add(params, 'lightIntensity', 0, 5, 0.01).name('Intensidade').onChange(updateScene);
  folderLight.add(params, 'ambientIntensity', 0, 0.08, 0.001).name('Luz ambiente').onChange(updateScene);

  const folderRender = gui.addFolder('Render');
  folderRender.add(params, 'rendererExposure', 0.3, 1.5, 0.01).name('Exposição').onChange(updateScene);
  folderRender.add(params, 'starBrightness', 0, 0.5, 0.01).name('Brilho estrelas').onChange(rebuildStars);
  folderRender.add(params, 'starSize', 0.005, 0.1, 0.001).name('Tam. estrelas').onChange(rebuildStars);
  folderRender.add(params, 'starCount', 0, 1500, 1).name('Qtd estrelas').onFinishChange(rebuildStars);
  folderRender.add(params, 'showUI').name('Mostrar UI').onChange(setUIVisibility);

  const actions = {
    export4K: () => exportPNG(3840, 2160, 'Saturno_Cassini_4K.png'),
    exportVertical: () => exportPNG(2160, 3840, 'Saturno_Cassini_4K_Vertical.png'),
    exportSquare: () => exportPNG(4096, 4096, 'Saturno_Cassini_4096.png'),
    presetCassini: applyCameraProfile,
    presetMobile: applyMobileWallpaperPreset,
    reset: resetView
  };

  const folderActions = gui.addFolder('Ações');
  folderActions.add(actions, 'export4K').name('Capturar 3840x2160');
  folderActions.add(actions, 'exportVertical').name('Capturar 2160x3840');
  folderActions.add(actions, 'exportSquare').name('Capturar 4096x4096');
  folderActions.add(actions, 'presetCassini').name('Aplicar perfil');
  folderActions.add(actions, 'presetMobile').name('Preset celular');
  folderActions.add(actions, 'reset').name('Reset');

  folderCamera.open();
  folderCameraMode.open();
  folderPlanet.open();
  folderAtmosphere.open();
  folderRings.open();
  folderActions.open();
}

/* =========================================================
   UPDATE
========================================================= */

function updateCameraPosition() {
  if (!camera) return;

  camera.position.set(
    params.cameraOffsetX,
    params.cameraOffsetY + 0.55,
    params.cameraDistance
  );

  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function updateScene() {
  renderer.toneMappingExposure = params.rendererExposure;

  camera.fov = params.cameraFov;
  camera.updateProjectionMatrix();

  updateCameraPosition();

  saturnGroup.rotation.z = THREE.MathUtils.degToRad(params.frameRotationZ);

  if (planetMesh) {
    planetMesh.scale.set(1, params.polarFlattening, 1);

    planetMesh.material.color.setRGB(
      params.planetBrightness,
      params.planetBrightness,
      params.planetBrightness
    );

    planetMesh.material.bumpScale = params.bumpScale;
  }

  if (cloudMesh) {
    cloudMesh.scale.set(1, params.polarFlattening, 1);
    cloudMesh.material.opacity = params.cloudOpacity;
  }

  if (atmosphereMesh) {
    atmosphereMesh.scale.set(
      params.atmosphereScale,
      params.polarFlattening * params.atmosphereScale,
      params.atmosphereScale
    );

    atmosphereMesh.material.uniforms.uGlowIntensity.value = params.atmosphereGlow;
    atmosphereMesh.material.uniforms.uPower.value = params.atmospherePower;
    atmosphereMesh.material.uniforms.uLightDirection.value.copy(sunLight.position).normalize();
  }

  if (ringGroup) {
    ringGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
  }

  if (ringMesh) {
    ringMesh.material.opacity = params.ringOpacity;
    ringMesh.material.color.setRGB(
      params.ringBrightness,
      params.ringBrightness,
      params.ringBrightness
    );
  }

  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  sunLight.intensity = params.lightIntensity;

  ambientLight.intensity = params.ambientIntensity;

  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;
}

function rebuildPlanetMaps() {
  if (planetMesh?.material?.map) planetMesh.material.map.dispose();
  if (planetMesh?.material?.bumpMap) planetMesh.material.bumpMap.dispose();
  if (cloudMesh?.material?.map) cloudMesh.material.map.dispose();

  const { colorMap, bumpMap } = createSaturnMaps();

  planetMesh.material.map = colorMap;
  planetMesh.material.bumpMap = bumpMap;
  planetMesh.material.needsUpdate = true;

  cloudMesh.material.map = createCloudTexture();
  cloudMesh.material.needsUpdate = true;
}

function rebuildStars() {
  if (stars) {
    scene.remove(stars);
    stars.geometry.dispose();
    stars.material.dispose();
    stars = null;
  }

  createStars();
}

function setUIVisibility() {
  document.body.classList.toggle('ui-hidden', !params.showUI);
}

function refreshGui() {
  if (!gui || typeof gui.controllersRecursive !== 'function') return;

  gui.controllersRecursive().forEach((controller) => {
    controller.updateDisplay();
  });
}

/* =========================================================
   PRESETS
========================================================= */

function applyCameraProfile() {
  if (params.cameraProfile === 'Cassini Natural') {
    params.cameraMono = false;
    params.sensorGrain = 0.014;
    params.cameraVignette = 0.20;
    params.cameraBloom = 0.025;

    params.starCount = 55;
    params.starBrightness = 0.045;
    params.starSize = 0.026;

    params.ambientIntensity = 0.0;
    params.bumpScale = 0.003;
    params.rendererExposure = 0.96;

    params.atmosphereGlow = 0.34;
    params.ringShadowStrength = 0.34;
  }

  if (params.cameraProfile === 'Cassini Mono') {
    params.cameraMono = true;
    params.sensorGrain = 0.018;
    params.cameraVignette = 0.27;
    params.cameraBloom = 0.018;

    params.starCount = 35;
    params.starBrightness = 0.035;
    params.starSize = 0.023;

    params.ambientIntensity = 0.0;
    params.bumpScale = 0.001;
    params.rendererExposure = 0.90;

    params.atmosphereGlow = 0.30;
    params.ringShadowStrength = 0.42;
  }

  if (params.cameraProfile === 'Deep Black Print') {
    params.cameraMono = true;
    params.sensorGrain = 0.012;
    params.cameraVignette = 0.38;
    params.cameraBloom = 0.012;

    params.starCount = 0;
    params.starBrightness = 0;

    params.ambientIntensity = 0.0;
    params.bumpScale = 0.0;
    params.rendererExposure = 0.84;

    params.atmosphereGlow = 0.25;
    params.ringShadowStrength = 0.48;
  }

  if (params.cameraProfile === 'Wallpaper Celular') {
    applyMobileWallpaperPreset();
    return;
  }

  rebuildPlanetMaps();
  buildRingMesh();
  rebuildStars();
  updateScene();
  refreshGui();
}

function applyMobileWallpaperPreset() {
  params.cameraProfile = 'Wallpaper Celular';
  params.mobileWallpaperMode = true;

  params.cameraFov = 21;
  params.cameraDistance = 18.6;
  params.cameraOffsetX = 0.0;
  params.cameraOffsetY = -0.35;

  params.frameRotationZ = -7.5;

  params.ringTilt = 74.2;
  params.ringOpacity = 0.96;
  params.ringBrightness = 0.98;
  params.ringChaos = 0.50;
  params.ringSpiralWaves = 0.34;

  params.lightX = 8.4;
  params.lightY = 4.2;
  params.lightZ = 10.8;
  params.lightIntensity = 2.5;
  params.ambientIntensity = 0.0;

  params.starCount = 25;
  params.starBrightness = 0.025;
  params.starSize = 0.02;

  params.rendererExposure = 0.92;

  params.cameraMono = false;
  params.sensorGrain = 0.014;
  params.cameraVignette = 0.32;
  params.cameraBloom = 0.018;

  params.atmosphereGlow = 0.32;
  params.ringShadowStrength = 0.38;

  rebuildPlanetMaps();
  buildRingMesh();
  rebuildStars();
  updateCameraPosition();
  updateScene();
  refreshGui();
}

function resetView() {
  params.showUI = true;
  params.cameraProfile = 'Cassini Natural';
  params.mobileWallpaperMode = false;

  params.autoRotate = false;
  params.autoRotateSpeed = 0.04;

  params.cameraFov = 24;
  params.cameraDistance = 16.8;
  params.cameraOffsetX = 0.0;
  params.cameraOffsetY = 0.2;

  params.frameRotationZ = -8;
  params.planetSpinSpeed = 0.0;
  params.cloudSpeed = 0.0;
  params.polarFlattening = 0.902;

  params.lightX = 8.5;
  params.lightY = 4.0;
  params.lightZ = 10.5;
  params.lightIntensity = 2.55;
  params.ambientIntensity = 0.0;

  params.planetBrightness = 1.0;
  params.bumpScale = 0.003;
  params.cloudOpacity = 0.09;
  params.showHexagonHint = true;

  params.atmosphereGlow = 0.34;
  params.atmospherePower = 2.7;
  params.atmosphereScale = 1.025;

  params.ringShadowStrength = 0.34;
  params.ringShadowSoftness = 0.72;

  params.ringTilt = 73.5;
  params.ringOpacity = 0.97;
  params.ringBrightness = 1.0;
  params.ringChaos = 0.52;
  params.ringSpiralWaves = 0.38;

  params.starCount = 65;
  params.starBrightness = 0.055;
  params.starSize = 0.028;

  params.rendererExposure = 0.96;

  params.sensorGrain = 0.014;
  params.cameraVignette = 0.20;
  params.cameraBloom = 0.025;
  params.cameraMono = false;

  setUIVisibility();
  rebuildPlanetMaps();
  buildRingMesh();
  rebuildStars();
  updateCameraPosition();
  updateScene();
  refreshGui();
}

/* =========================================================
   EVENTOS
========================================================= */

function bindButtons() {
  document.getElementById('btn-export-4k')?.addEventListener('click', () => {
    exportPNG(3840, 2160, 'Saturno_Cassini_4K.png');
  });

  document.getElementById('btn-export-vertical')?.addEventListener('click', () => {
    exportPNG(2160, 3840, 'Saturno_Cassini_4K_Vertical.png');
  });

  document.getElementById('btn-export-square')?.addEventListener('click', () => {
    exportPNG(4096, 4096, 'Saturno_Cassini_4096.png');
  });

  document.getElementById('btn-reset')?.addEventListener('click', resetView);

  document.getElementById('btn-toggle-ui')?.addEventListener('click', () => {
    params.showUI = !params.showUI;
    setUIVisibility();
    refreshGui();
  });
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (key === 'h') {
      params.showUI = !params.showUI;
      setUIVisibility();
      refreshGui();
    }

    if (key === 'p') {
      exportPNG(3840, 2160, 'Saturno_Cassini_4K.png');
    }
  });
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/* =========================================================
   LOOP
========================================================= */

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (planetMesh) {
    planetMesh.rotation.y += params.planetSpinSpeed * delta * 60;
  }

  if (cloudMesh) {
    cloudMesh.rotation.y += params.cloudSpeed * delta * 60;
  }

  controls.update();
  renderer.render(scene, camera);
}

/* =========================================================
   EXPORTAÇÃO
========================================================= */

async function exportPNG(width, height, fileName) {
  showCaptureStatus(true);
  triggerFlash();

  await nextFrame();

  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);

  const oldPixelRatio = renderer.getPixelRatio();
  const oldAspect = camera.aspect;
  const oldAutoRotate = controls.autoRotate;
  const oldShowUI = params.showUI;

  try {
    params.showUI = false;
    setUIVisibility();

    controls.autoRotate = false;

    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    const processedCanvas = applyCameraPostProcess(renderer.domElement, width, height);

    await saveCanvasAsPNG(processedCanvas, fileName);
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    renderer.setSize(oldSize.x, oldSize.y, false);

    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();

    controls.autoRotate = oldAutoRotate;

    params.showUI = oldShowUI;
    setUIVisibility();

    showCaptureStatus(false);
  }
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

      if (params.cameraMono || params.cameraProfile === 'Cassini Mono') {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = gray;
        g = gray;
        b = gray;
      }

      const grain = (Math.random() - 0.5) * 255 * params.sensorGrain;

      r += grain;
      g += grain;
      b += grain;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const vignette = 1.0 - Math.pow(dist, 1.7) * params.cameraVignette;

      r *= vignette;
      g *= vignette;
      b *= vignette;

      data[i] = clamp(r, 0, 255);
      data[i + 1] = clamp(g, 0, 255);
      data[i + 2] = clamp(b, 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  if (params.cameraBloom > 0) {
    ctx.save();
    ctx.globalAlpha = params.cameraBloom;
    ctx.filter = 'blur(2px)';
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(output, 0, 0);
    ctx.restore();
  }

  return output;
}

function saveCanvasAsPNG(sourceCanvas, fileName) {
  return new Promise((resolve) => {
    sourceCanvas.toBlob((blob) => {
      if (!blob) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = sourceCanvas.toDataURL('image/png');
        link.click();
        resolve();
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.download = fileName;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png', 1);
  });
}

function showCaptureStatus(show) {
  if (!captureStatus) return;

  captureStatus.style.display = show ? 'block' : 'none';
}

function triggerFlash() {
  if (!flash) return;

  flash.style.opacity = '1';

  setTimeout(() => {
    flash.style.opacity = '0';
  }, 90);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/* =========================================================
   TEXTURA DE SATURNO
========================================================= */

function createSaturnMaps() {
  const width = 4096;
  const height = 2048;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;

  const ctx = colorCanvas.getContext('2d');

  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0.00, '#d8d2be');
  baseGradient.addColorStop(0.10, '#d9cfb2');
  baseGradient.addColorStop(0.22, '#e2d8bf');
  baseGradient.addColorStop(0.34, '#d7ccb0');
  baseGradient.addColorStop(0.48, '#ead9b2');
  baseGradient.addColorStop(0.60, '#dbc7a5');
  baseGradient.addColorStop(0.78, '#e7d7b8');
  baseGradient.addColorStop(0.92, '#d5c8ac');
  baseGradient.addColorStop(1.00, '#cdbf9f');

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;

    const largeBand =
      Math.sin(v * 42 + 0.4) * 0.035 +
      Math.sin(v * 95 + 1.3) * 0.015 +
      Math.sin(v * 180 + 0.8) * 0.008;

    const warm =
      Math.sin(v * 22 + 2.1) * 7 +
      Math.sin(v * 58 + 0.9) * 3;

    const darkAlpha = clamp(0.018 + Math.abs(largeBand) * 0.11, 0, 0.12);
    const lightAlpha = clamp(0.008 + Math.abs(largeBand) * 0.06, 0, 0.07);

    if (largeBand > 0) {
      ctx.fillStyle = `rgba(${214 + warm}, ${194 + warm * 0.7}, ${155 + warm * 0.4}, ${lightAlpha})`;
    } else {
      ctx.fillStyle = `rgba(92, 86, 80, ${darkAlpha})`;
    }

    ctx.fillRect(0, y, width, 1);
  }

  ctx.save();

  for (let i = 0; i < 1500; i++) {
    const y = randomRange(0, height);
    const h = randomRange(2, 10);
    const alpha = randomRange(0.008, 0.035);

    const gradient = ctx.createLinearGradient(0, y, width, y);
    gradient.addColorStop(0.00, `rgba(255,255,255,${alpha * 0.2})`);
    gradient.addColorStop(0.25, `rgba(255,248,230,${alpha})`);
    gradient.addColorStop(0.50, `rgba(235,216,180,${alpha * 0.8})`);
    gradient.addColorStop(0.75, `rgba(255,248,230,${alpha})`);
    gradient.addColorStop(1.00, `rgba(255,255,255,${alpha * 0.2})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, width, h);
  }

  for (let i = 0; i < 650; i++) {
    const y = randomRange(0, height);
    const h = randomRange(1, 6);
    const alpha = randomRange(0.006, 0.022);

    ctx.fillStyle = `rgba(55, 48, 42, ${alpha})`;
    ctx.fillRect(0, y, width, h);
  }

  ctx.filter = 'blur(18px)';

  for (let i = 0; i < 36; i++) {
    const x = randomRange(0, width);
    const y = randomRange(height * 0.18, height * 0.82);
    const w = randomRange(60, 240);
    const h = randomRange(20, 80);
    const alpha = randomRange(0.018, 0.050);

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randomRange(-0.4, 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245,235,210,${alpha})`;
    ctx.fill();
  }

  for (let i = 0; i < 26; i++) {
    const x = randomRange(0, width);
    const y = randomRange(height * 0.18, height * 0.82);
    const w = randomRange(40, 180);
    const h = randomRange(12, 55);
    const alpha = randomRange(0.018, 0.048);

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randomRange(-0.5, 0.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(88,78,68,${alpha})`;
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();

  if (params.showHexagonHint) {
    const hexY = height * 0.115;
    const hexRadius = 190;

    ctx.save();
    ctx.filter = 'blur(24px)';

    ctx.beginPath();
    drawIrregularHexagon(ctx, width * 0.5, hexY, hexRadius, 0.22);
    ctx.fillStyle = 'rgba(80, 94, 105, 0.11)';
    ctx.fill();

    ctx.beginPath();
    drawIrregularHexagon(ctx, width * 0.5, hexY, hexRadius * 0.68, 0.34);
    ctx.fillStyle = 'rgba(230, 236, 232, 0.045)';
    ctx.fill();

    ctx.restore();
  }

  drawRingShadowOnAtmosphere(ctx, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = randomRange(-2.2, 2.2);

    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;

  const bctx = bumpCanvas.getContext('2d');
  bctx.drawImage(colorCanvas, 0, 0);

  const bumpData = bctx.getImageData(0, 0, width, height);
  const bd = bumpData.data;

  for (let i = 0; i < bd.length; i += 4) {
    const gray = bd[i] * 0.299 + bd[i + 1] * 0.587 + bd[i + 2] * 0.114;
    const contrasted = clamp(((gray / 255 - 0.5) * 1.15 + 0.5) * 255, 0, 255);

    bd[i] = contrasted;
    bd[i + 1] = contrasted;
    bd[i + 2] = contrasted;
  }

  bctx.putImageData(bumpData, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.anisotropy = 16;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = 16;

  return { colorMap, bumpMap };
}

function createCloudTexture() {
  const width = 4096;
  const height = 2048;

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = width;
  cloudCanvas.height = height;

  const ctx = cloudCanvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < 1300; i++) {
    const y = randomRange(0, height);
    const h = randomRange(1, 5);
    const alpha = randomRange(0.008, 0.038);

    const gradient = ctx.createLinearGradient(0, y, width, y);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.15})`);
    gradient.addColorStop(0.25, `rgba(255,255,255,${alpha * 0.5})`);
    gradient.addColorStop(0.50, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.75, `rgba(255,255,255,${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(255,255,255,${alpha * 0.15})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, width, h);
  }

  ctx.filter = 'blur(14px)';

  for (let i = 0; i < 28; i++) {
    const x = randomRange(0, width);
    const y = randomRange(height * 0.15, height * 0.85);
    const w = randomRange(60, 220);
    const h = randomRange(20, 60);
    const alpha = randomRange(0.012, 0.045);

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randomRange(-0.4, 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }

  ctx.filter = 'none';

  const texture = new THREE.CanvasTexture(cloudCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

  return texture;
}

/* =========================================================
   TEXTURA DOS ANÉIS
========================================================= */

function createRingTexture() {
  const width = 4096;
  const height = 512;

  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = width;
  ringCanvas.height = height;

  const ctx = ringCanvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);

      let density = ringDensityProfile(u);

      const largeChaos =
        fbm1D(u * 18.0 + v * 1.7) * 0.42 +
        fbm1D(u * 53.0 + v * 3.1) * 0.24 +
        fbm1D(u * 140.0 + v * 8.0) * 0.12;

      const spiral =
        Math.sin(
          u * 155.0 +
          v * 24.0 +
          fbm1D(u * 32.0) * 7.0
        );

      const fine =
        Math.sin(u * 2400.0 + fbm1D(v * 40.0) * 4.0) * 0.035 +
        Math.sin(u * 7100.0 + v * 11.0) * 0.018;

      density *= 1.0 + (largeChaos - 0.5) * params.ringChaos;
      density += spiral * 0.045 * params.ringSpiralWaves;
      density += fine;

      density = clamp(density, 0, 1);

      const gapNoise = fbm1D(u * 310.0 + v * 2.0);

      if (gapNoise > 0.82) {
        density *= 0.72;
      }

      const iceTint = 0.88 + density * 0.20;

      const r = 228 * iceTint;
      const g = 222 * iceTint;
      const b = 210 * iceTint;
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

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(tempCanvas, 0, 0);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.filter = 'blur(0.65px)';
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

function drawRingShadowOnAtmosphere(ctx, width, height) {
  const strength = params.ringShadowStrength;
  const softness = params.ringShadowSoftness;

  if (strength <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  const shadowBands = [
    { y: 0.438, h: 8, a: 0.08 },
    { y: 0.456, h: 16, a: 0.15 },
    { y: 0.482, h: 32, a: 0.26 },
    { y: 0.522, h: 18, a: 0.17 },
    { y: 0.548, h: 9,  a: 0.09 }
  ];

  for (const band of shadowBands) {
    const baseY = height * band.y;
    const bandHeight = band.h * (0.55 + softness);

    for (let x = 0; x < width; x += 8) {
      const u = x / width;

      const curve =
        Math.sin(u * Math.PI * 2.0) * 7.0 +
        Math.sin(u * Math.PI * 5.0 + 1.2) * 2.5;

      const localY = baseY + curve;

      const g = ctx.createLinearGradient(
        0,
        localY - bandHeight,
        0,
        localY + bandHeight
      );

      g.addColorStop(0.0, 'rgba(0,0,0,0)');
      g.addColorStop(0.45, `rgba(0,0,0,${band.a * strength})`);
      g.addColorStop(0.55, `rgba(0,0,0,${band.a * strength})`);
      g.addColorStop(1.0, 'rgba(0,0,0,0)');

      ctx.fillStyle = g;
      ctx.fillRect(x, localY - bandHeight, 9, bandHeight * 2);
    }
  }

  ctx.restore();
}

/* =========================================================
   HELPERS
========================================================= */

function fixRingUV(geometry, innerRadius, outerRadius) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vector = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vector.fromBufferAttribute(position, i);

    const radius = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    const radial = (radius - innerRadius) / (outerRadius - innerRadius);

    const angle = Math.atan2(vector.y, vector.x);
    const azimuth = (angle + Math.PI) / (Math.PI * 2);

    uv.setXY(i, radial, azimuth);
  }

  uv.needsUpdate = true;
}

function drawIrregularHexagon(ctx, cx, cy, r, irregularity = 0.18) {
  const points = 6;

  for (let i = 0; i < points; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    const noise = 1.0 + (pseudoNoise1D(i * 13.17 + r * 0.01) - 0.5) * irregularity;

    const x = cx + Math.cos(angle) * r * noise;
    const y = cy + Math.sin(angle) * r * noise;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
}

function fbm1D(x) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;

  for (let i = 0; i < 5; i++) {
    value += amplitude * pseudoNoise1D(x * frequency);
    frequency *= 2.03;
    amplitude *= 0.52;
  }

  return value;
}

function gaussian(x, mean, sigma, amplitude) {
  const exponent = -((x - mean) * (x - mean)) / (2 * sigma * sigma);
  return amplitude * Math.exp(exponent);
}

function pseudoNoise1D(x) {
  return fract(Math.sin(x * 12.9898) * 43758.5453123);
}

function fract(n) {
  return n - Math.floor(n);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
