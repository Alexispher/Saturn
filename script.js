import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const canvas = document.getElementById('space-canvas');
const hud = document.getElementById('hud');
const captureStatus = document.getElementById('capture-status');

const params = {
  // Cena
  autoRotate: true,
  autoRotateSpeed: 0.1,
  
  // Câmera
  cameraFov: 35,
  cameraDistance: 6.5,

  // Saturno (Dados NASA)
  planetRotation: 26.73, // Inclinação axial real
  planetScale: 1.0,      // Raio base estabilizado
  planetBrightness: 1.0,
  planetContrast: 1.3,
  surfaceSpeed: 0.02,
  
  // Filtro Estético
  monochrome: true,      // "Comer tudo" em P&B

  // Anéis (Proporção NASA: 1.12 a 2.37 do raio)
  ringTilt: 26.73,       // Alinhado com o planeta
  ringOpacity: 0.9,
  ringBrightness: 1.2,
  ringInnerRadius: 1.12,
  ringOuterRadius: 2.37,

  // Luz Estelar (Sol)
  lightX: -8.0,
  lightY: 2.5,
  lightZ: 5.0,
  lightIntensity: 3.5,
  ambientIntensity: 0.05, // Quase zero para realismo no espaço escuro

  // Fundo (Via Láctea realista)
  starAmount: 8000,
  starBrightness: 0.8,
  starMotion: 0.005,

  // Render Engine
  exposure: 1.1,
};

let scene, camera, renderer, controls, clock;
let saturnGroup, planetMesh, ringMesh, stars, starMaterial, sunLight, ambientLight;
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
  // Tone mapping ACESFilmic garante que os brancos não estourem feio
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;
}

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
}

function createCamera() {
  camera = new THREE.PerspectiveCamera(params.cameraFov, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, params.cameraDistance);
}

function createLights() {
  // Luz ambiente fria e fraca
  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
  scene.add(ambientLight);

  // Luz do sol direta e dura
  sunLight = new THREE.DirectionalLight(0xffffff, params.lightIntensity);
  sunLight.position.set(params.lightX, params.lightY, params.lightZ);
  scene.add(sunLight);
}

function createSaturn() {
  saturnGroup = new THREE.Group();
  scene.add(saturnGroup);

  // O planeta
  const planetGeometry = new THREE.SphereGeometry(1.0, 128, 128); // Mesh densa para silhueta perfeita
  const planetMaterial = new THREE.MeshStandardMaterial({
    map: createSaturnTexture(),
    roughness: 0.9,
    metalness: 0.0,
  });

  planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
  planetMesh.rotation.z = THREE.MathUtils.degToRad(params.planetRotation);
  saturnGroup.add(planetMesh);

  // Os anéis
  const ringGeometry = new THREE.RingGeometry(params.ringInnerRadius, params.ringOuterRadius, 512, 32);
  fixRingUV(ringGeometry, params.ringInnerRadius, params.ringOuterRadius);

  const ringMaterial = new THREE.MeshBasicMaterial({
    map: createRingTexture(),
    transparent: true,
    opacity: params.ringOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = THREE.MathUtils.degToRad(90 - params.ringTilt); // Alinha com o equador do planeta
  saturnGroup.add(ringMesh);
  
  applyMonochromeState();
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  // Criação de um cinturão da Via Láctea + estrelas dispersas
  for (let i = 0; i < params.starAmount; i++) {
    const radius = THREE.MathUtils.randFloat(50, 200);
    
    // Viés para o equador galáctico (banda da Via Láctea)
    let phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    if (Math.random() > 0.4) {
      phi = Math.PI / 2 + THREE.MathUtils.randFloatSpread(0.5); // Concentra no meio
    }
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    // No modo monocromático absoluto, estrelas são puramente cinzas/brancas
    const intensity = THREE.MathUtils.randFloat(0.2, 1.0);
    colors.push(intensity, intensity, intensity);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  starMaterial = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: params.starBrightness,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  stars = new THREE.Points(geometry, starMaterial);
  scene.add(stars);
}

// ==========================================
// GERADORES PROCEDURAIS DE TEXTURA
// ==========================================

function createSaturnTexture() {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Gradiente base mais realista (tons de amônia e metano)
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  if (params.monochrome) {
    baseGradient.addColorStop(0.00, '#333333');
    baseGradient.addColorStop(0.15, '#777777');
    baseGradient.addColorStop(0.35, '#555555');
    baseGradient.addColorStop(0.50, '#999999');
    baseGradient.addColorStop(0.65, '#666666');
    baseGradient.addColorStop(0.85, '#888888');
    baseGradient.addColorStop(1.00, '#222222');
  } else {
    baseGradient.addColorStop(0.00, '#8c7e6d');
    baseGradient.addColorStop(0.15, '#d3c1a5');
    baseGradient.addColorStop(0.35, '#c5b08e');
    baseGradient.addColorStop(0.50, '#e8d8b7');
    baseGradient.addColorStop(0.65, '#c1aa82');
    baseGradient.addColorStop(0.85, '#d1c0a8');
    baseGradient.addColorStop(1.00, '#6b6154');
  }

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  // Faixas atmosféricas (ventos supersônicos)
  for (let y = 0; y < height; y += 4) {
    const alpha = 0.02 + Math.random() * 0.05;
    const bandHeight = 1 + Math.random() * 8;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, y, width, bandHeight);
  }

  // Ruído para dar textura de gás
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));

    // Aplica o contraste extra pedido para o visual fotográfico
    if (params.monochrome) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrasted = ((gray / 255 - 0.5) * params.planetContrast + 0.5) * 255;
      data[i] = data[i+1] = data[i+2] = contrasted;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createRingTexture() {
  const width = 2048;
  const height = 128; // 1D map stretched
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, width, height);

  // Posições baseadas nos anéis C, B, A, Divisão de Cassini, etc.
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  
  // Cores adaptáveis ao modo P&B
  const cGap = 'rgba(0,0,0,0)';
  const cFaint = params.monochrome ? 'rgba(255,255,255,0.1)' : 'rgba(210,190,170,0.1)';
  const cMed = params.monochrome ? 'rgba(255,255,255,0.5)' : 'rgba(210,190,170,0.5)';
  const cDense = params.monochrome ? 'rgba(255,255,255,0.9)' : 'rgba(220,200,180,0.9)';

  gradient.addColorStop(0.00, cGap);
  gradient.addColorStop(0.05, cFaint); // Anel C (translúcido)
  gradient.addColorStop(0.20, cMed);
  gradient.addColorStop(0.25, cGap);   // Divisão
  gradient.addColorStop(0.26, cDense); // Anel B (denso e brilhante)
  gradient.addColorStop(0.50, cDense);
  gradient.addColorStop(0.65, cMed);
  gradient.addColorStop(0.72, cGap);   // Divisão de Cassini
  gradient.addColorStop(0.76, cGap);
  gradient.addColorStop(0.77, cMed);   // Anel A
  gradient.addColorStop(0.90, cFaint);
  gradient.addColorStop(0.95, cGap);   // Divisão de Encke
  gradient.addColorStop(0.98, cFaint);
  gradient.addColorStop(1.00, cGap);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Ranhuras procedurais finas (densidade das partículas)
  for (let x = 0; x < width; x += 2) {
    if (Math.random() > 0.6) {
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, 0, 1 + Math.random() * 2, height);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function fixRingUV(geometry, innerRadius, outerRadius) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const radius = Math.sqrt(v.x * v.x + v.y * v.y);
    uv.setXY(i, (radius - innerRadius) / (outerRadius - innerRadius), 0.5);
  }
  uv.needsUpdate = true;
}

// ==========================================
// CONTROLES E ATUALIZAÇÃO
// ==========================================

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;
  controls.minDistance = 2.0;
  controls.maxDistance = 25.0;
}

function applyMonochromeState() {
  if (params.monochrome) {
    sunLight.color.setHex(0xffffff);
    ambientLight.color.setHex(0xffffff);
    ringMesh.material.color.setRGB(params.ringBrightness, params.ringBrightness, params.ringBrightness);
    planetMesh.material.color.setRGB(params.planetBrightness, params.planetBrightness, params.planetBrightness);
  } else {
    sunLight.color.setHex(0xfff5e6); // Luz solar levemente quente
    ambientLight.color.setHex(0x223344);
    ringMesh.material.color.setRGB(params.ringBrightness, params.ringBrightness * 0.95, params.ringBrightness * 0.85);
    planetMesh.material.color.setRGB(params.planetBrightness, params.planetBrightness * 0.95, params.planetBrightness * 0.9);
  }
  
  // Regera as texturas procedurais para respeitar a paleta
  if(planetMesh.material.map) planetMesh.material.map.dispose();
  planetMesh.material.map = createSaturnTexture();
  
  if(ringMesh.material.map) ringMesh.material.map.dispose();
  ringMesh.material.map = createRingTexture();
}

function createGui() {
  gui = new GUI({ title: 'NASA DATA CONTROLS' });

  gui.add(params, 'monochrome').name('B&W Film Mode').onChange(applyMonochromeState);
  gui.add(params, 'exposure', 0.5, 3.0, 0.01).name('Exposição da Lente').onChange(v => renderer.toneMappingExposure = v);
  gui.add(params, 'cameraDistance', 2, 15, 0.1).name('Distância Focal').onChange(v => camera.position.z = v);
  
  const folderFisica = gui.addFolder('Física e Escala');
  folderFisica.add(params, 'planetRotation', -90, 90, 0.1).name('Inclinação Planeta').onChange(v => planetMesh.rotation.z = THREE.MathUtils.degToRad(v));
  folderFisica.add(params, 'ringTilt', 0, 90, 0.1).name('Inclinação Anéis').onChange(v => ringMesh.rotation.x = THREE.MathUtils.degToRad(90 - v));
}

// ... [O restante do código de exportação PNG (bindButtons, exportPNG, saveCanvasAsPNG) permanece idêntico ao seu original, já que ele funciona perfeitamente para gerar as prints 4K] ...

function bindButtons() {
  // Mantendo sua lógica de exportação limpa e precisa
  document.getElementById('btn-export-4k').addEventListener('click', () => exportPNG(3840, 2160, 'Isomium_Saturn_4K.png'));
  document.getElementById('btn-export-vertical').addEventListener('click', () => exportPNG(2160, 3840, 'Isomium_Saturn_4K_Vert.png'));
  document.getElementById('btn-toggle-ui').addEventListener('click', () => document.body.classList.toggle('ui-hidden'));
}

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') document.body.classList.toggle('ui-hidden');
    if (e.key.toLowerCase() === 'p') exportPNG(3840, 2160, 'Isomium_Saturn_4K.png');
  });
}

async function exportPNG(width, height, filename) {
  const wasHidden = document.body.classList.contains('ui-hidden');
  document.body.classList.add('ui-hidden');

  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);
  const oldPixelRatio = renderer.getPixelRatio();
  const oldAspect = camera.aspect;

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    const sourceCanvas = renderer.domElement;
    sourceCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png', 1);
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    renderer.setSize(oldSize.x, oldSize.y, false);
    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();
    if (!wasHidden) document.body.classList.remove('ui-hidden');
  }
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
  stars.rotation.y += delta * params.starMotion;
  controls.update();
  renderer.render(scene, camera);
}
