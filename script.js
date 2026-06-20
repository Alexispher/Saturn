import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const canvas = document.getElementById('space-canvas');
const captureStatus = document.getElementById('capture-status');
const flash = document.getElementById('flash');

const PLANET_RADIUS = 1.85;

const params = {
  // Cena
  showUI: true,
  autoRotate: false,
  autoRotateSpeed: 0.06,

  // Câmera / composição
  cameraFov: 24,
  cameraDistance: 16.8,
  cameraOffsetX: 0.0,
  cameraOffsetY: 0.2,

  // Enquadramento do planeta
  frameRotationZ: -8,
  planetSpinSpeed: 0.0015,
  polarFlattening: 0.902,

  // Luz
  lightX: 8.5,
  lightY: 4.0,
  lightZ: 10.5,
  lightIntensity: 2.25,
  ambientIntensity: 0.03,

  // Saturno
  planetBrightness: 1.0,
  bumpScale: 0.02,
  cloudOpacity: 0.11,
  cloudSpeed: 0.0022,
  showHexagonHint: true,

  // Anéis
  ringTilt: 73.5,
  ringOpacity: 0.97,
  ringBrightness: 1.0,
  ringInnerRadius: 2.24,
  ringOuterRadius: 4.95,

  // Fundo
  starCount: 480,
  starBrightness: 0.18,
  starSize: 0.04,

  // Export / visual
  rendererExposure: 0.95
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
  onResize();

  window.addEventListener('resize', onResize);
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

function createRings() {
  ringGroup = new THREE.Group();
  ringGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
  saturnGroup.add(ringGroup);

  const ringGeometry = new THREE.RingGeometry(
    params.ringInnerRadius,
    params.ringOuterRadius,
    1024,
    8
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
    title: 'SATURN REALISM',
    width: 330
  });

  const folderCamera = gui.addFolder('Composição');
  folderCamera.add(params, 'cameraFov', 12, 65, 1).name('FOV').onChange(updateScene);
  folderCamera.add(params, 'cameraDistance', 5, 35, 0.1).name('Distância').onChange(updateCameraPosition);
  folderCamera.add(params, 'cameraOffsetX', -8, 8, 0.01).name('Offset X').onChange(updateCameraPosition);
  folderCamera.add(params, 'cameraOffsetY', -5, 5, 0.01).name('Offset Y').onChange(updateCameraPosition);
  folderCamera.add(params, 'frameRotationZ', -30, 30, 0.1).name('Rotação quadro').onChange(updateScene);

  const folderPlanet = gui.addFolder('Saturno');
  folderPlanet.add(params, 'polarFlattening', 0.82, 1.0, 0.001).name('Achatamento polar').onChange(updateScene);
  folderPlanet.add(params, 'planetBrightness', 0.5, 1.5, 0.01).name('Brilho').onChange(updateScene);
  folderPlanet.add(params, 'bumpScale', 0, 0.06, 0.001).name('Relevo nuvens').onChange(rebuildPlanetMaps);
  folderPlanet.add(params, 'cloudOpacity', 0, 0.35, 0.01).name('Opac. nuvens').onChange(updateScene);
  folderPlanet.add(params, 'planetSpinSpeed', 0, 0.01, 0.0001).name('Rot. planeta');
  folderPlanet.add(params, 'cloudSpeed', 0, 0.02, 0.0001).name('Rot. nuvens');

  const folderRings = gui.addFolder('Anéis');
  folderRings.add(params, 'ringTilt', 50, 89, 0.1).name('Inclinação').onChange(updateScene);
  folderRings.add(params, 'ringOpacity', 0.2, 1.0, 0.01).name('Opacidade').onChange(updateScene);
  folderRings.add(params, 'ringBrightness', 0.4, 1.4, 0.01).name('Brilho').onChange(updateScene);

  const folderLight = gui.addFolder('Luz');
  folderLight.add(params, 'lightX', -20, 20, 0.1).name('Luz X').onChange(updateScene);
  folderLight.add(params, 'lightY', -20, 20, 0.1).name('Luz Y').onChange(updateScene);
  folderLight.add(params, 'lightZ', -20, 20, 0.1).name('Luz Z').onChange(updateScene);
  folderLight.add(params, 'lightIntensity', 0, 5, 0.01).name('Intensidade').onChange(updateScene);
  folderLight.add(params, 'ambientIntensity', 0, 0.3, 0.001).name('Luz ambiente').onChange(updateScene);

  const folderRender = gui.addFolder('Render');
  folderRender.add(params, 'rendererExposure', 0.3, 1.5, 0.01).name('Exposição').onChange(updateScene);
  folderRender.add(params, 'starBrightness', 0, 0.5, 0.01).name('Brilho estrelas').onChange(rebuildStars);
  folderRender.add(params, 'starCount', 0, 1500, 1).name('Qtd estrelas').onFinishChange(rebuildStars);
  folderRender.add(params, 'showUI').name('Mostrar UI').onChange(setUIVisibility);

  const actions = {
    export4K: () => exportPNG(3840, 2160, 'Saturno_Realista_4K.png'),
    exportVertical: () => exportPNG(2160, 3840, 'Saturno_Realista_4K_Vertical.png'),
    exportSquare: () => exportPNG(4096, 4096, 'Saturno_Realista_4096.png'),
    presetReal: applyRealisticPreset,
    reset: resetView
  };

  const folderActions = gui.addFolder('Ações');
  folderActions.add(actions, 'export4K').name('Capturar 3840x2160');
  folderActions.add(actions, 'exportVertical').name('Capturar 2160x3840');
  folderActions.add(actions, 'exportSquare').name('Capturar 4096x4096');
  folderActions.add(actions, 'presetReal').name('Preset fiel');
  folderActions.add(actions, 'reset').name('Reset');

  folderCamera.open();
  folderPlanet.open();
  folderRings.open();
  folderActions.open();
}

function updateCameraPosition() {
  camera.position.set(
    params.cameraOffsetX,
    params.cameraOffsetY + 0.55,
    params.cameraDistance
  );
  controls.target.set(0, 0, 0);
  controls.update();
}

function updateScene() {
  renderer.toneMappingExposure = params.rendererExposure;

  camera.fov = params.cameraFov;
  camera.updateProjectionMatrix();

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

function bindButtons() {
  document.getElementById('btn-export-4k')?.addEventListener('click', () => {
    exportPNG(3840, 2160, 'Saturno_Realista_4K.png');
  });

  document.getElementById('btn-export-vertical')?.addEventListener('click', () => {
    exportPNG(2160, 3840, 'Saturno_Realista_4K_Vertical.png');
  });

  document.getElementById('btn-export-square')?.addEventListener('click', () => {
    exportPNG(4096, 4096, 'Saturno_Realista_4096.png');
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
      exportPNG(3840, 2160, 'Saturno_Realista_4K.png');
    }
  });
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

function applyRealisticPreset() {
  params.cameraFov = 24;
  params.cameraDistance = 16.8;
  params.cameraOffsetX = 0.0;
  params.cameraOffsetY = 0.2;
  params.frameRotationZ = -8;

  params.polarFlattening = 0.902;
  params.planetBrightness = 1.0;
  params.bumpScale = 0.02;
  params.cloudOpacity = 0.11;

  params.ringTilt = 73.5;
  params.ringOpacity = 0.97;
  params.ringBrightness = 1.0;

  params.lightX = 8.5;
  params.lightY = 4.0;
  params.lightZ = 10.5;
  params.lightIntensity = 2.25;
  params.ambientIntensity = 0.03;

  params.rendererExposure = 0.95;
  params.starBrightness = 0.18;
  params.starCount = 480;

  rebuildPlanetMaps();
  rebuildStars();
  updateCameraPosition();
  updateScene();
  refreshGui();
}

function resetView() {
  applyRealisticPreset();
  params.showUI = true;
  setUIVisibility();
  refreshGui();
}

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

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

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

    await saveCanvasAsPNG(renderer.domElement, fileName);
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
   TEXTURAS
========================================================= */

function createSaturnMaps() {
  const width = 4096;
  const height = 2048;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d');

  // Base suave e realista
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

  // Bandas atmosféricas sutis
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

  // Faixas largas e nuvens sinuosas
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  for (let i = 0; i < 1800; i++) {
    const y = randomRange(0, height);
    const h = randomRange(2, 12);
    const alpha = randomRange(0.012, 0.048);

    const gradient = ctx.createLinearGradient(0, y, width, y);
    gradient.addColorStop(0.00, `rgba(255,255,255,${alpha * 0.2})`);
    gradient.addColorStop(0.25, `rgba(255,248,230,${alpha})`);
    gradient.addColorStop(0.50, `rgba(235,216,180,${alpha * 0.8})`);
    gradient.addColorStop(0.75, `rgba(255,248,230,${alpha})`);
    gradient.addColorStop(1.00, `rgba(255,255,255,${alpha * 0.2})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, width, h);
  }

  // Correntes escuras mais delicadas
  for (let i = 0; i < 850; i++) {
    const y = randomRange(0, height);
    const h = randomRange(1, 8);
    const alpha = randomRange(0.006, 0.028);

    ctx.fillStyle = `rgba(55, 48, 42, ${alpha})`;
    ctx.fillRect(0, y, width, h);
  }

  // Tempestades suaves e detalhes atmosféricos
  ctx.filter = 'blur(18px)';
  for (let i = 0; i < 40; i++) {
    const x = randomRange(0, width);
    const y = randomRange(height * 0.18, height * 0.82);
    const w = randomRange(60, 240);
    const h = randomRange(20, 80);
    const alpha = randomRange(0.025, 0.06);

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randomRange(-0.4, 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245,235,210,${alpha})`;
    ctx.fill();
  }

  for (let i = 0; i < 28; i++) {
    const x = randomRange(0, width);
    const y = randomRange(height * 0.18, height * 0.82);
    const w = randomRange(40, 180);
    const h = randomRange(12, 55);
    const alpha = randomRange(0.02, 0.055);

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randomRange(-0.5, 0.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(88,78,68,${alpha})`;
    ctx.fill();
  }
  ctx.filter = 'none';

  // Indício do hexágono polar
  if (params.showHexagonHint) {
    const hexY = height * 0.12;
    const hexRadius = 180;
    const hexBlur = 35;

    ctx.save();
    ctx.filter = `blur(${hexBlur}px)`;
    ctx.beginPath();
    drawHexagon(ctx, width * 0.5, hexY, hexRadius);
    ctx.fillStyle = 'rgba(110, 120, 130, 0.09)';
    ctx.fill();

    ctx.beginPath();
    drawHexagon(ctx, width * 0.5, hexY, hexRadius * 0.72);
    ctx.fillStyle = 'rgba(225, 235, 240, 0.05)';
    ctx.fill();
    ctx.restore();
  }

  // Granulação muito leve
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = randomRange(-3, 3);
    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);

  // Bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bctx = bumpCanvas.getContext('2d');
  bctx.drawImage(colorCanvas, 0, 0);

  const bumpData = bctx.getImageData(0, 0, width, height);
  const bd = bumpData.data;

  for (let i = 0; i < bd.length; i += 4) {
    const gray = bd[i] * 0.299 + bd[i + 1] * 0.587 + bd[i + 2] * 0.114;
    const contrasted = clamp(((gray / 255 - 0.5) * 1.6 + 0.5) * 255, 0, 255);

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

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  // camadas finas de nuvem
  for (let i = 0; i < 1500; i++) {
    const y = randomRange(0, height);
    const h = randomRange(1, 5);
    const alpha = randomRange(0.01, 0.05);

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
  for (let i = 0; i < 30; i++) {
    const x = randomRange(0, width);
    const y = randomRange(height * 0.15, height * 0.85);
    const w = randomRange(60, 220);
    const h = randomRange(20, 60);
    const alpha = randomRange(0.015, 0.06);

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randomRange(-0.4, 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }
  ctx.filter = 'none';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

  return texture;
}

function createRingTexture() {
  const width = 4096;
  const height = 512;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  for (let x = 0; x < width; x++) {
    const u = x / (width - 1); // raio normalizado
    let density = ringDensityProfile(u);

    // microestrutura radial
    density *= 0.92 + 0.08 * Math.sin(u * 900);
    density *= 0.94 + 0.06 * Math.sin(u * 3100 + 1.4);
    density *= 0.97 + 0.03 * Math.sin(u * 7600 + 0.8);
    density *= 0.92 + 0.08 * pseudoNoise1D(x * 0.25);
    density = clamp(density, 0, 1);

    const brightness = clamp(
      0.70 + density * 0.45 + 0.05 * Math.sin(u * 1200),
      0,
      1
    );

    const r = Math.floor(225 * brightness);
    const g = Math.floor(218 * brightness);
    const b = Math.floor(205 * brightness);
    const a = clamp(density, 0, 1);

    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(x, 0, 1, height);
  }

  // Estruturas e granulação vertical leve
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    const rowFactor =
      0.98 +
      0.02 * Math.sin(y * 0.15) +
      0.02 * pseudoNoise1D(y * 0.8);

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = clamp(data[i] * rowFactor, 0, 255);
      data[i + 1] = clamp(data[i + 1] * rowFactor, 0, 255);
      data[i + 2] = clamp(data[i + 2] * rowFactor, 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

  return texture;
}

/* =========================================================
   PERFIL DE DENSIDADE DOS ANÉIS
   Aproximação visual inspirada na estrutura A, B, C e lacunas.
========================================================= */

function ringDensityProfile(u) {
  // fade das bordas
  if (u < 0.02 || u > 0.995) return 0;

  let d = 0;

  // C ring (mais tênue)
  d += gaussian(u, 0.18, 0.06, 0.18);
  d += gaussian(u, 0.26, 0.05, 0.22);
  d += gaussian(u, 0.34, 0.06, 0.28);

  // B ring (mais brilhante e denso)
  d += gaussian(u, 0.45, 0.08, 0.72);
  d += gaussian(u, 0.56, 0.07, 0.92);
  d += gaussian(u, 0.63, 0.05, 0.88);

  // Divisão de Cassini
  d -= gaussian(u, 0.72, 0.018, 0.82);

  // A ring
  d += gaussian(u, 0.78, 0.045, 0.52);
  d += gaussian(u, 0.86, 0.038, 0.46);

  // F ring / outer structures
  d += gaussian(u, 0.91, 0.010, 0.22);
  d += gaussian(u, 0.95, 0.014, 0.12);

  // lacunas finas internas
  d -= gaussian(u, 0.22, 0.008, 0.08);
  d -= gaussian(u, 0.31, 0.006, 0.07);
  d -= gaussian(u, 0.49, 0.005, 0.11);
  d -= gaussian(u, 0.60, 0.006, 0.10);
  d -= gaussian(u, 0.84, 0.006, 0.08);

  return clamp(d, 0, 1);
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

    uv.setXY(i, radial, 0.5);
  }

  uv.needsUpdate = true;
}

function drawHexagon(ctx, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
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
