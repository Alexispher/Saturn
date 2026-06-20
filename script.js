import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const canvas = document.getElementById('space-canvas');
const hud = document.getElementById('hud');
const captureStatus = document.getElementById('capture-status');

const params = {
  // Cena
  autoRotate: true,
  autoRotateSpeed: 0.18,
  backgroundDarkness: 1,

  // Câmera
  cameraFov: 35,
  cameraDistance: 8.2,

  // Saturno
  planetRotation: -13,
  planetScale: 1,
  planetBrightness: 0.92,
  planetContrast: 1.18,
  surfaceSpeed: 0.035,
  monochrome: true,

  // Anéis
  ringTilt: 74,
  ringOpacity: 0.86,
  ringBrightness: 1.12,
  ringInnerRadius: 2.2,
  ringOuterRadius: 4.35,

  // Luz
  lightX: -5.5,
  lightY: 3.2,
  lightZ: 6.5,
  lightIntensity: 3.2,
  ambientIntensity: 0.26,

  // Estrelas
  starAmount: 2600,
  starBrightness: 0.78,
  starMotion: 0.015,

  // Render
  exposure: 1.08,
  bloomFake: 0.32
};

let scene;
let camera;
let renderer;
let controls;
let clock;

let saturnGroup;
let planetMesh;
let ringMesh;
let stars;
let starMaterial;
let sunLight;
let ambientLight;

let gui;

init();
animate();

function init() {
  clock = new THREE.Clock();

  createRenderer();
  createScene();
  createCamera();
  createLights();
  createSaturn();
  createStars();
  createControls();
  createGui();
  bindButtons();
  bindKeyboard();

  window.addEventListener('resize', onResize);
  onResize();
}

function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });

  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;
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
    2000
  );

  camera.position.set(0, 0.7, params.cameraDistance);
}

function createLights() {
  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, params.lightIntensity);
  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  scene.add(sunLight);
}

function createSaturn() {
  saturnGroup = new THREE.Group();
  saturnGroup.rotation.z = THREE.MathUtils.degToRad(params.planetRotation);
  scene.add(saturnGroup);

  const planetGeometry = new THREE.SphereGeometry(1.65, 128, 64);

  const planetMaterial = new THREE.MeshStandardMaterial({
    map: createSaturnTexture(),
    roughness: 0.86,
    metalness: 0,
    color: new THREE.Color(params.planetBrightness, params.planetBrightness, params.planetBrightness)
  });

  planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
  planetMesh.scale.setScalar(params.planetScale);
  saturnGroup.add(planetMesh);

  const ringGeometry = new THREE.RingGeometry(
    params.ringInnerRadius,
    params.ringOuterRadius,
    384,
    16
  );

  fixRingUV(ringGeometry, params.ringInnerRadius, params.ringOuterRadius);

  const ringMaterial = new THREE.MeshBasicMaterial({
    map: createRingTexture(),
    transparent: true,
    opacity: params.ringOpacity,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    color: new THREE.Color(params.ringBrightness, params.ringBrightness, params.ringBrightness)
  });

  ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
  saturnGroup.add(ringMesh);
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.045;

  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;

  controls.minDistance = 3.8;
  controls.maxDistance = 18;

  controls.enablePan = true;
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < params.starAmount; i++) {
    const radius = THREE.MathUtils.randFloat(35, 115);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    const intensity = THREE.MathUtils.randFloat(0.45, 1);
    colors.push(intensity, intensity, intensity);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  starMaterial = new THREE.PointsMaterial({
    size: 0.075,
    vertexColors: true,
    transparent: true,
    opacity: params.starBrightness,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  stars = new THREE.Points(geometry, starMaterial);
  scene.add(stars);
}

function createSaturnTexture() {
  const width = 2048;
  const height = 1024;

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;

  const ctx = textureCanvas.getContext('2d');

  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#d8d2c5');
  baseGradient.addColorStop(0.22, '#f2ead8');
  baseGradient.addColorStop(0.48, '#b9ad9a');
  baseGradient.addColorStop(0.65, '#e6dcc8');
  baseGradient.addColorStop(1, '#7e766b');

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += 8) {
    const alpha = 0.035 + Math.random() * 0.07;
    const bandHeight = 2 + Math.random() * 12;

    ctx.fillStyle = Math.random() > 0.52
      ? `rgba(255,255,255,${alpha})`
      : `rgba(0,0,0,${alpha})`;

    ctx.fillRect(0, y, width, bandHeight);
  }

  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = Math.random() * 0.055;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  if (params.monochrome) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrasted = ((gray / 255 - 0.5) * params.planetContrast + 0.5) * 255;

      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;

  return texture;
}

function createRingTexture() {
  const width = 2048;
  const height = 256;

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;

  const ctx = textureCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);

  gradient.addColorStop(0.00, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.08, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(0.14, 'rgba(255,255,255,0.52)');
  gradient.addColorStop(0.20, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(0.28, 'rgba(255,255,255,0.78)');
  gradient.addColorStop(0.36, 'rgba(255,255,255,0.32)');
  gradient.addColorStop(0.44, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(0.50, 'rgba(255,255,255,0.0)');
  gradient.addColorStop(0.56, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(0.66, 'rgba(255,255,255,0.72)');
  gradient.addColorStop(0.76, 'rgba(255,255,255,0.36)');
  gradient.addColorStop(0.88, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1.00, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 5) {
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, 0, 1 + Math.random() * 3, height);
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;

  return texture;
}

function fixRingUV(geometry, innerRadius, outerRadius) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  const vector = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vector.fromBufferAttribute(position, i);

    const radius = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    const normalizedRadius = (radius - innerRadius) / (outerRadius - innerRadius);

    uv.setXY(i, normalizedRadius, 0.5);
  }

  uv.needsUpdate = true;
}

function createGui() {
  gui = new GUI({
    title: 'ISOMIUM CONTROLS',
    width: 330
  });

  const folderScene = gui.addFolder('Cena');
  folderScene.add(params, 'autoRotate').name('Auto rotação').onChange(updateLive);
  folderScene.add(params, 'autoRotateSpeed', -2, 2, 0.01).name('Vel. auto rotação').onChange(updateLive);
  folderScene.add(params, 'exposure', 0.3, 2.5, 0.01).name('Exposição').onChange(updateLive);

  const folderCamera = gui.addFolder('Câmera');
  folderCamera.add(params, 'cameraFov', 15, 90, 1).name('FOV').onChange(updateLive);
  folderCamera.add(params, 'cameraDistance', 4, 15, 0.1).name('Distância').onChange(() => {
    camera.position.z = params.cameraDistance;
  });

  const folderPlanet = gui.addFolder('Saturno');
  folderPlanet.add(params, 'planetRotation', -180, 180, 1).name('Inclinação').onChange(updateLive);
  folderPlanet.add(params, 'planetScale', 0.6, 1.8, 0.01).name('Escala').onChange(updateLive);
  folderPlanet.add(params, 'planetBrightness', 0.2, 2, 0.01).name('Brilho').onChange(updateLive);
  folderPlanet.add(params, 'planetContrast', 0.5, 2.5, 0.01).name('Contraste').onChange(rebuildPlanetTexture);
  folderPlanet.add(params, 'surfaceSpeed', -0.2, 0.2, 0.001).name('Rotação superfície');
  folderPlanet.add(params, 'monochrome').name('Monocromático').onChange(rebuildPlanetTexture);

  const folderRing = gui.addFolder('Anéis');
  folderRing.add(params, 'ringTilt', 0, 90, 1).name('Inclinação anéis').onChange(updateLive);
  folderRing.add(params, 'ringOpacity', 0, 1, 0.01).name('Opacidade').onChange(updateLive);
  folderRing.add(params, 'ringBrightness', 0.1, 2.2, 0.01).name('Brilho').onChange(updateLive);

  const folderLight = gui.addFolder('Luz');
  folderLight.add(params, 'lightX', -12, 12, 0.1).name('Luz X').onChange(updateLive);
  folderLight.add(params, 'lightY', -12, 12, 0.1).name('Luz Y').onChange(updateLive);
  folderLight.add(params, 'lightZ', -12, 12, 0.1).name('Luz Z').onChange(updateLive);
  folderLight.add(params, 'lightIntensity', 0, 8, 0.1).name('Intensidade').onChange(updateLive);
  folderLight.add(params, 'ambientIntensity', 0, 2, 0.01).name('Ambiente').onChange(updateLive);

  const folderStars = gui.addFolder('Estrelas');
  folderStars.add(params, 'starBrightness', 0, 1.5, 0.01).name('Brilho estrelas').onChange(updateLive);
  folderStars.add(params, 'starMotion', -0.08, 0.08, 0.001).name('Movimento');

  folderScene.open();
  folderPlanet.open();
  folderRing.open();
}

function updateLive() {
  renderer.toneMappingExposure = params.exposure;

  camera.fov = params.cameraFov;
  camera.updateProjectionMatrix();

  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;

  saturnGroup.rotation.z = THREE.MathUtils.degToRad(params.planetRotation);

  planetMesh.scale.setScalar(params.planetScale);

  planetMesh.material.color.setRGB(
    params.planetBrightness,
    params.planetBrightness,
    params.planetBrightness
  );

  ringMesh.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
  ringMesh.material.opacity = params.ringOpacity;
  ringMesh.material.color.setRGB(
    params.ringBrightness,
    params.ringBrightness,
    params.ringBrightness
  );

  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  sunLight.intensity = params.lightIntensity;

  ambientLight.intensity = params.ambientIntensity;

  starMaterial.opacity = params.starBrightness;
}

function rebuildPlanetTexture() {
  if (planetMesh.material.map) {
    planetMesh.material.map.dispose();
  }

  planetMesh.material.map = createSaturnTexture();
  planetMesh.material.needsUpdate = true;
}

function bindButtons() {
  document.getElementById('btn-export-4k').addEventListener('click', () => {
    exportPNG(3840, 2160, 'Isomium_Saturn_4K.png');
  });

  document.getElementById('btn-export-vertical').addEventListener('click', () => {
    exportPNG(2160, 3840, 'Isomium_Saturn_4K_Vertical.png');
  });

  document.getElementById('btn-export-square').addEventListener('click', () => {
    exportPNG(4096, 4096, 'Isomium_Saturn_4096x4096.png');
  });

  document.getElementById('btn-reset').addEventListener('click', resetView);

  document.getElementById('btn-toggle-ui').addEventListener('click', toggleUI);
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (key === 'h') {
      toggleUI();
    }

    if (key === 'p') {
      exportPNG(3840, 2160, 'Isomium_Saturn_4K.png');
    }
  });
}

function toggleUI() {
  document.body.classList.toggle('ui-hidden');
}

function resetView() {
  params.autoRotate = true;
  params.autoRotateSpeed = 0.18;
  params.cameraFov = 35;
  params.cameraDistance = 8.2;
  params.planetRotation = -13;
  params.planetScale = 1;
  params.planetBrightness = 0.92;
  params.planetContrast = 1.18;
  params.surfaceSpeed = 0.035;
  params.monochrome = true;
  params.ringTilt = 74;
  params.ringOpacity = 0.86;
  params.ringBrightness = 1.12;
  params.lightX = -5.5;
  params.lightY = 3.2;
  params.lightZ = 6.5;
  params.lightIntensity = 3.2;
  params.ambientIntensity = 0.26;
  params.starBrightness = 0.78;
  params.starMotion = 0.015;
  params.exposure = 1.08;

  camera.position.set(0, 0.7, params.cameraDistance);
  controls.target.set(0, 0, 0);
  controls.update();

  rebuildPlanetTexture();
  updateLive();

  gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
}

async function exportPNG(width, height, filename) {
  showCaptureStatus(true);

  const wasHidden = document.body.classList.contains('ui-hidden');
  document.body.classList.add('ui-hidden');

  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);

  const oldPixelRatio = renderer.getPixelRatio();
  const oldAspect = camera.aspect;

  const oldCameraPosition = camera.position.clone();
  const oldTarget = controls.target.clone();

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    controls.update();

    renderer.render(scene, camera);

    await saveCanvasAsPNG(renderer.domElement, filename);
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    renderer.setSize(oldSize.x, oldSize.y, false);

    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();

    camera.position.copy(oldCameraPosition);
    controls.target.copy(oldTarget);
    controls.update();

    if (!wasHidden) {
      document.body.classList.remove('ui-hidden');
    }

    showCaptureStatus(false);
  }
}

function saveCanvasAsPNG(sourceCanvas, filename) {
  return new Promise((resolve) => {
    sourceCanvas.toBlob((blob) => {
      if (!blob) {
        const fallback = document.createElement('a');
        fallback.download = filename;
        fallback.href = sourceCanvas.toDataURL('image/png');
        fallback.click();
        resolve();
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.download = filename;
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

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  planetMesh.rotation.y += delta * params.surfaceSpeed;

  if (stars) {
    stars.rotation.y += delta * params.starMotion;
    stars.rotation.x += delta * params.starMotion * 0.22;
  }

  controls.update();
  renderer.render(scene, camera);
}
