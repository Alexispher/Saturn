import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import GUI from 'lil-gui';

const canvas = document.getElementById('space-canvas');
const captureStatus = document.getElementById('capture-status');
const flash = document.getElementById('flash');

/*
  ESCALA REAL NORMALIZADA

  NASA:
  - Diâmetro equatorial de Saturno: aprox. 120.500 km.
  - Raio equatorial aproximado: 60.250 km.
  - Sistema de anéis: até cerca de 282.000 km a partir do planeta.

  Neste render:
  - Raio de Saturno = 1.65 unidade Three.js.
  - Raio externo do sistema de anéis = raio de Saturno + proporção real dos anéis.
*/

const SATURN_DIAMETER_KM = 120500;
const SATURN_RADIUS_KM = SATURN_DIAMETER_KM / 2;
const NASA_RING_EXTENSION_FROM_PLANET_KM = 282000;
const RING_OUTER_RATIO_FROM_CENTER =
  (SATURN_RADIUS_KM + NASA_RING_EXTENSION_FROM_PLANET_KM) / SATURN_RADIUS_KM;

const PLANET_RADIUS = 1.65;
const TRUE_RING_OUTER_RADIUS = PLANET_RADIUS * RING_OUTER_RATIO_FROM_CENTER;

/*
  Perfis proporcionais dos anéis principais.
  Os valores são aproximados em relação ao raio equatorial de Saturno.
  A ideia aqui é obter uma aparência proporcional, legível e fiel o bastante
  para arte/render, sem sacrificar composição.
*/

const ringBands = [
  {
    name: 'D',
    innerRatio: 1.11,
    outerRatio: 1.24,
    opacity: 0.10,
    brightness: 0.35
  },
  {
    name: 'C',
    innerRatio: 1.24,
    outerRatio: 1.53,
    opacity: 0.32,
    brightness: 0.62
  },
  {
    name: 'B',
    innerRatio: 1.53,
    outerRatio: 1.95,
    opacity: 0.78,
    brightness: 1.15
  },
  {
    name: 'Cassini Division',
    innerRatio: 1.95,
    outerRatio: 2.03,
    opacity: 0.02,
    brightness: 0.02
  },
  {
    name: 'A',
    innerRatio: 2.03,
    outerRatio: 2.27,
    opacity: 0.58,
    brightness: 0.94
  },
  {
    name: 'F',
    innerRatio: 2.32,
    outerRatio: 2.36,
    opacity: 0.34,
    brightness: 1.20
  },
  {
    name: 'G',
    innerRatio: 2.75,
    outerRatio: 2.90,
    opacity: 0.10,
    brightness: 0.42
  },
  {
    name: 'E',
    innerRatio: 2.98,
    outerRatio: RING_OUTER_RATIO_FROM_CENTER,
    opacity: 0.045,
    brightness: 0.28
  }
];

const params = {
  // Cena
  autoRotate: false,
  autoRotateSpeed: 0.08,
  showUI: true,

  // Composição para print
  cinematicOffsetX: -1.55,
  cinematicOffsetY: 0.10,
  cameraFov: 31,
  cameraDistance: 12.4,

  // Saturno
  planetRotation: -13,
  planetScale: 1,
  planetBrightness: 0.72,
  planetContrast: 1.34,
  surfaceSpeed: 0.0,
  monochromeTexture: true,

  // Anéis
  ringTilt: 74,
  ringGlobalOpacity: 0.92,
  ringGlobalBrightness: 1.05,
  useTrueRingScale: true,
  showFaintOuterRings: true,

  // Luz
  lightX: -6.5,
  lightY: 3.6,
  lightZ: 7.5,
  lightIntensity: 3.8,
  ambientIntensity: 0.10,

  // Estrelas
  starAmount: 1900,
  starBrightness: 0.48,
  starSize: 0.055,
  starMotion: 0.0,

  // Render base
  rendererExposure: 1.04,

  // Modo Foto / Pós-processamento
  postExposure: 1.04,
  postSaturation: 0.0,
  postContrast: 1.34,
  postVignette: 0.44,
  postGrain: 0.018,
  monochromeFinal: true
};

let scene;
let camera;
let renderer;
let composer;
let renderPass;
let photoPass;
let controls;
let clock;

let saturnGroup;
let planetMesh;
let ringsGroup;
let stars;
let starMaterial;
let sunLight;
let ambientLight;
let gui;

const PhotoShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: params.postExposure },
    uSaturation: { value: params.postSaturation },
    uContrast: { value: params.postContrast },
    uVignette: { value: params.postVignette },
    uGrain: { value: params.postGrain },
    uMonochrome: { value: params.monochromeFinal ? 1.0 : 0.0 },
    uTime: { value: 0 }
  },

  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uMonochrome;
    uniform float uTime;

    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      color.rgb *= uExposure;

      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

      if (uMonochrome > 0.5) {
        color.rgb = vec3(gray);
      } else {
        color.rgb = mix(vec3(gray), color.rgb, uSaturation);
      }

      color.rgb = (color.rgb - 0.5) * uContrast + 0.5;

      float dist = distance(vUv, vec2(0.5));
      float vignette = smoothstep(0.86, 0.22, dist);
      color.rgb *= mix(1.0, vignette, uVignette);

      float grain = random(vUv * 2200.0 + uTime * 0.11);
      color.rgb += (grain - 0.5) * uGrain;

      color.rgb = clamp(color.rgb, 0.0, 1.0);

      gl_FragColor = color;
    }
  `
};

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
  createComposer();
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

  camera.position.set(params.cinematicOffsetX, 0.72 + params.cinematicOffsetY, params.cameraDistance);
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

  const planetGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 192, 96);

  const planetMaterial = new THREE.MeshStandardMaterial({
    map: createSaturnTexture(),
    roughness: 0.92,
    metalness: 0,
    color: new THREE.Color(
      params.planetBrightness,
      params.planetBrightness,
      params.planetBrightness
    )
  });

  planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
  planetMesh.scale.setScalar(params.planetScale);
  saturnGroup.add(planetMesh);

  ringsGroup = new THREE.Group();
  ringsGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);
  saturnGroup.add(ringsGroup);

  createPhysicalRingSystem();
}

function createPhysicalRingSystem() {
  clearRings();

  ringBands.forEach((band) => {
    if (!params.showFaintOuterRings && ['G', 'E'].includes(band.name)) {
      return;
    }

    const innerRadius = PLANET_RADIUS * band.innerRatio;
    const outerRadius = params.useTrueRingScale
      ? PLANET_RADIUS * band.outerRatio
      : PLANET_RADIUS * Math.min(band.outerRatio, 2.65);

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 512, 4);
    fixRingUV(geometry, innerRadius, outerRadius);

    const opacity =
      band.opacity *
      params.ringGlobalOpacity *
      (band.name === 'E' ? 0.42 : 1);

    const brightness =
      band.brightness *
      params.ringGlobalBrightness;

    const material = new THREE.MeshBasicMaterial({
      map: createRingBandTexture(band),
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      color: new THREE.Color(brightness, brightness, brightness)
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Ring_${band.name}`;

    ringsGroup.add(mesh);
  });
}

function clearRings() {
  if (!ringsGroup) return;

  while (ringsGroup.children.length > 0) {
    const child = ringsGroup.children.pop();

    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  }
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < params.starAmount; i++) {
    const radius = THREE.MathUtils.randFloat(65, 220);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    const intensity = THREE.MathUtils.randFloat(0.28, 0.82);
    colors.push(intensity, intensity, intensity);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  starMaterial = new THREE.PointsMaterial({
    size: params.starSize,
    vertexColors: true,
    transparent: true,
    opacity: params.starBrightness,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  stars = new THREE.Points(geometry, starMaterial);
  scene.add(stars);
}

function createComposer() {
  composer = new EffectComposer(renderer);

  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  photoPass = new ShaderPass(PhotoShader);
  composer.addPass(photoPass);

  updatePostFX();
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.045;

  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;

  controls.minDistance = 3.2;
  controls.maxDistance = 42;
  controls.enablePan = true;

  controls.target.set(0, 0, 0);
  controls.update();
}

function createGui() {
  gui = new GUI({
    title: 'ISOMIUM PHOTO MODE',
    width: 340
  });

  const folderPrint = gui.addFolder('Print / Composição');
  folderPrint.add(params, 'cameraFov', 12, 75, 1).name('FOV').onChange(updateLive);
  folderPrint.add(params, 'cameraDistance', 4, 36, 0.1).name('Distância').onChange(updateCameraPosition);
  folderPrint.add(params, 'cinematicOffsetX', -8, 8, 0.01).name('Offset X').onChange(updateCameraPosition);
  folderPrint.add(params, 'cinematicOffsetY', -5, 5, 0.01).name('Offset Y').onChange(updateCameraPosition);

  const folderScene = gui.addFolder('Cena');
  folderScene.add(params, 'autoRotate').name('Auto rotação').onChange(updateLive);
  folderScene.add(params, 'autoRotateSpeed', -2, 2, 0.01).name('Velocidade').onChange(updateLive);
  folderScene.add(params, 'rendererExposure', 0.3, 2.5, 0.01).name('Exposição base').onChange(updateLive);
  folderScene.add(params, 'showUI').name('Mostrar UI').onChange(setUIVisibility);

  const folderPlanet = gui.addFolder('Saturno realista');
  folderPlanet.add(params, 'planetRotation', -180, 180, 1).name('Inclinação').onChange(updateLive);
  folderPlanet.add(params, 'planetScale', 0.6, 1.8, 0.01).name('Escala').onChange(updateLive);
  folderPlanet.add(params, 'planetBrightness', 0.1, 2, 0.01).name('Brilho').onChange(updateLive);
  folderPlanet.add(params, 'planetContrast', 0.5, 2.8, 0.01).name('Contraste textura').onChange(rebuildPlanetTexture);
  folderPlanet.add(params, 'surfaceSpeed', -0.2, 0.2, 0.001).name('Rotação textura');
  folderPlanet.add(params, 'monochromeTexture').name('Textura P&B').onChange(rebuildPlanetTexture);

  const folderRing = gui.addFolder('Anéis em escala');
  folderRing.add(params, 'ringTilt', 0, 90, 1).name('Inclinação').onChange(updateLive);
  folderRing.add(params, 'ringGlobalOpacity', 0, 1.6, 0.01).name('Opacidade').onChange(updateRingMaterials);
  folderRing.add(params, 'ringGlobalBrightness', 0.1, 2.6, 0.01).name('Brilho').onChange(updateRingMaterials);
  folderRing.add(params, 'useTrueRingScale').name('Escala real').onChange(createPhysicalRingSystem);
  folderRing.add(params, 'showFaintOuterRings').name('Mostrar G/E').onChange(createPhysicalRingSystem);

  const folderLight = gui.addFolder('Luz');
  folderLight.add(params, 'lightX', -18, 18, 0.1).name('Luz X').onChange(updateLive);
  folderLight.add(params, 'lightY', -18, 18, 0.1).name('Luz Y').onChange(updateLive);
  folderLight.add(params, 'lightZ', -18, 18, 0.1).name('Luz Z').onChange(updateLive);
  folderLight.add(params, 'lightIntensity', 0, 10, 0.1).name('Intensidade').onChange(updateLive);
  folderLight.add(params, 'ambientIntensity', 0, 1.5, 0.01).name('Ambiente').onChange(updateLive);

  const folderStars = gui.addFolder('Fundo espacial');
  folderStars.add(params, 'starBrightness', 0, 1.5, 0.01).name('Brilho estrelas').onChange(updateLive);
  folderStars.add(params, 'starSize', 0.01, 0.18, 0.001).name('Tamanho estrelas').onChange(updateLive);
  folderStars.add(params, 'starMotion', -0.08, 0.08, 0.001).name('Movimento');

  const folderPhoto = gui.addFolder('Filtro preto e branco');
  folderPhoto.add(params, 'monochromeFinal').name('P&B total').onChange(updatePostFX);
  folderPhoto.add(params, 'postExposure', 0.4, 2.5, 0.01).name('Exposição').onChange(updatePostFX);
  folderPhoto.add(params, 'postSaturation', 0, 2, 0.01).name('Saturação').onChange(updatePostFX);
  folderPhoto.add(params, 'postContrast', 0.4, 2.8, 0.01).name('Contraste').onChange(updatePostFX);
  folderPhoto.add(params, 'postVignette', 0, 1, 0.01).name('Vinheta').onChange(updatePostFX);
  folderPhoto.add(params, 'postGrain', 0, 0.12, 0.001).name('Grão').onChange(updatePostFX);

  const actions = {
    export4K: () => exportPNG(3840, 2160, 'Isomium_Saturn_4K.png'),
    exportVertical: () => exportPNG(2160, 3840, 'Isomium_Saturn_4K_Vertical.png'),
    exportSquare: () => exportPNG(4096, 4096, 'Isomium_Saturn_4096x4096.png'),
    reset: resetView
  };

  folderPhoto.add(actions, 'export4K').name('Capturar 3840x2160');
  folderPhoto.add(actions, 'exportVertical').name('Capturar 2160x3840');
  folderPhoto.add(actions, 'exportSquare').name('Capturar 4096x4096');
  folderPhoto.add(actions, 'reset').name('Resetar cena');

  folderPrint.open();
  folderRing.open();
  folderPhoto.open();
}

function createSaturnTexture() {
  const width = 4096;
  const height = 2048;

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;

  const ctx = textureCanvas.getContext('2d');

  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);

  baseGradient.addColorStop(0.00, '#9f9788');
  baseGradient.addColorStop(0.10, '#beb6a5');
  baseGradient.addColorStop(0.22, '#d4c7ae');
  baseGradient.addColorStop(0.34, '#a99f90');
  baseGradient.addColorStop(0.48, '#c7b8a0');
  baseGradient.addColorStop(0.58, '#9a9184');
  baseGradient.addColorStop(0.68, '#d9cbb0');
  baseGradient.addColorStop(0.78, '#b7aa99');
  baseGradient.addColorStop(0.90, '#817a70');
  baseGradient.addColorStop(1.00, '#5f5b55');

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += 4) {
    const alpha = 0.02 + Math.random() * 0.085;
    const bandHeight = 1 + Math.random() * 10;

    ctx.fillStyle = Math.random() > 0.52
      ? `rgba(255,255,255,${alpha})`
      : `rgba(0,0,0,${alpha})`;

    ctx.fillRect(0, y, width, bandHeight);
  }

  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = Math.random() * 0.04;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  if (params.monochromeTexture) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray =
        data[i] * 0.299 +
        data[i + 1] * 0.587 +
        data[i + 2] * 0.114;

      const contrasted =
        ((gray / 255 - 0.5) * params.planetContrast + 0.5) * 255;

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
  texture.anisotropy = 16;

  return texture;
}

function createRingBandTexture(band) {
  const width = 2048;
  const height = 128;

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;

  const ctx = textureCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);

  if (band.name === 'Cassini Division') {
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    gradient.addColorStop(0.00, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.08, 'rgba(255,255,255,0.20)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.70)');
    gradient.addColorStop(0.34, 'rgba(255,255,255,0.36)');
    gradient.addColorStop(0.48, 'rgba(255,255,255,0.88)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.40)');
    gradient.addColorStop(0.82, 'rgba(255,255,255,0.22)');
    gradient.addColorStop(1.00, 'rgba(255,255,255,0)');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 2) {
    const alpha = Math.random() * 0.11;
    const lineWidth = 1 + Math.random() * 2;

    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${alpha * 0.55})`
      : `rgba(0,0,0,${alpha})`;

    ctx.fillRect(x, 0, lineWidth, height);
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

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

function updateCameraPosition() {
  camera.position.set(
    params.cinematicOffsetX,
    0.72 + params.cinematicOffsetY,
    params.cameraDistance
  );

  controls.target.set(0, 0, 0);
  controls.update();
}

function updateLive() {
  renderer.toneMappingExposure = params.rendererExposure;

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

  ringsGroup.rotation.x = THREE.MathUtils.degToRad(params.ringTilt);

  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  sunLight.intensity = params.lightIntensity;

  ambientLight.intensity = params.ambientIntensity;

  starMaterial.opacity = params.starBrightness;
  starMaterial.size = params.starSize;

  updateRingMaterials();
  updatePostFX();
}

function updateRingMaterials() {
  if (!ringsGroup) return;

  ringsGroup.children.forEach((mesh) => {
    const bandName = mesh.name.replace('Ring_', '');
    const band = ringBands.find((item) => item.name === bandName);

    if (!band) return;

    const opacity =
      band.opacity *
      params.ringGlobalOpacity *
      (band.name === 'E' ? 0.42 : 1);

    const brightness =
      band.brightness *
      params.ringGlobalBrightness;

    mesh.material.opacity = opacity;
    mesh.material.color.setRGB(brightness, brightness, brightness);
  });
}

function updatePostFX() {
  if (!photoPass) return;

  photoPass.uniforms.uExposure.value = params.postExposure;
  photoPass.uniforms.uSaturation.value = params.postSaturation;
  photoPass.uniforms.uContrast.value = params.postContrast;
  photoPass.uniforms.uVignette.value = params.postVignette;
  photoPass.uniforms.uGrain.value = params.postGrain;
  photoPass.uniforms.uMonochrome.value = params.monochromeFinal ? 1.0 : 0.0;
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

  document.getElementById('btn-toggle-ui').addEventListener('click', () => {
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
      exportPNG(3840, 2160, 'Isomium_Saturn_4K.png');
    }
  });
}

function setUIVisibility() {
  document.body.classList.toggle('ui-hidden', !params.showUI);
}

function resetView() {
  params.autoRotate = false;
  params.autoRotateSpeed = 0.08;
  params.showUI = true;

  params.cinematicOffsetX = -1.55;
  params.cinematicOffsetY = 0.10;
  params.cameraFov = 31;
  params.cameraDistance = 12.4;

  params.planetRotation = -13;
  params.planetScale = 1;
  params.planetBrightness = 0.72;
  params.planetContrast = 1.34;
  params.surfaceSpeed = 0.0;
  params.monochromeTexture = true;

  params.ringTilt = 74;
  params.ringGlobalOpacity = 0.92;
  params.ringGlobalBrightness = 1.05;
  params.useTrueRingScale = true;
  params.showFaintOuterRings = true;

  params.lightX = -6.5;
  params.lightY = 3.6;
  params.lightZ = 7.5;
  params.lightIntensity = 3.8;
  params.ambientIntensity = 0.10;

  params.starBrightness = 0.48;
  params.starSize = 0.055;
  params.starMotion = 0.0;

  params.rendererExposure = 1.04;

  params.postExposure = 1.04;
  params.postSaturation = 0.0;
  params.postContrast = 1.34;
  params.postVignette = 0.44;
  params.postGrain = 0.018;
  params.monochromeFinal = true;

  updateCameraPosition();
  setUIVisibility();
  rebuildPlanetTexture();
  createPhysicalRingSystem();
  updateLive();
  refreshGui();
}

async function exportPNG(width, height, filename) {
  showCaptureStatus(true);
  triggerFlash();

  await nextFrame();

  const previousShowUI = params.showUI;
  const previousAutoRotate = controls.autoRotate;

  params.showUI = false;
  controls.autoRotate = false;
  setUIVisibility();

  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);

  const oldPixelRatio = renderer.getPixelRatio();
  const oldAspect = camera.aspect;

  try {
    renderer.setPixelRatio(1);
    composer.setPixelRatio(1);

    renderer.setSize(width, height, false);
    composer.setSize(width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    controls.update();

    renderFrame();

    await saveCanvasAsPNG(renderer.domElement, filename);
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    composer.setPixelRatio(oldPixelRatio);

    renderer.setSize(oldSize.x, oldSize.y, false);
    composer.setSize(oldSize.x, oldSize.y);

    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();

    controls.autoRotate = previousAutoRotate;

    params.showUI = previousShowUI;
    setUIVisibility();

    refreshGui();

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

function triggerFlash() {
  if (!flash) return;

  flash.style.opacity = '1';

  setTimeout(() => {
    flash.style.opacity = '0';
  }, 95);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function refreshGui() {
  if (!gui || typeof gui.controllersRecursive !== 'function') return;

  gui.controllersRecursive().forEach((controller) => {
    controller.updateDisplay();
  });
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);
  composer.setSize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function renderFrame() {
  if (photoPass) {
    photoPass.uniforms.uTime.value = clock.elapsedTime;
  }

  composer.render();
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
  renderFrame();
}
