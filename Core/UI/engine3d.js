const canvas = document.getElementById('bg3d');
if (!canvas) throw new Error('Canvas not found');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const PARTICLE_COUNT = 2000;
const geo = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);
const velocities = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const i3 = i * 3;
  const radius = 8 + Math.random() * 20;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = radius * Math.cos(phi);
  const c = new THREE.Color().setHSL(0.7 + Math.random() * 0.15, 0.8, 0.5 + Math.random() * 0.3);
  colors[i3] = c.r;
  colors[i3 + 1] = c.g;
  colors[i3 + 2] = c.b;
  sizes[i] = 0.5 + Math.random() * 2;
  velocities[i3] = (Math.random() - 0.5) * 0.005;
  velocities[i3 + 1] = (Math.random() - 0.5) * 0.005;
  velocities[i3 + 2] = (Math.random() - 0.5) * 0.005;
}

geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const vertShader = `
  attribute float size;
  varying vec3 vColor;
      void main() {
      vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
      }
`;
const fragShader = `
  varying vec3 vColor;
      void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.2, 0.5, d);
      gl_FragColor = vec4(vColor, alpha * 0.7);
      }
`;

const mat = new THREE.ShaderMaterial({
  vertexShader: vertShader,
  fragmentShader: fragShader,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(geo, mat);
scene.add(particles);

const NODE_COUNT = 30;
const nodeGeo = new THREE.BufferGeometry();
const nodePositions = new Float32Array(NODE_COUNT * 3);
const nodeColors = new Float32Array(NODE_COUNT * 3);
const nodeSizes = new Float32Array(NODE_COUNT);

for (let i = 0; i < NODE_COUNT; i++) {
  const i3 = i * 3;
  const r = 5 + Math.random() * 12;
  const t = Math.random() * Math.PI * 2;
  const p = Math.acos(2 * Math.random() - 1);
  nodePositions[i3] = r * Math.sin(p) * Math.cos(t);
  nodePositions[i3 + 1] = r * Math.sin(p) * Math.sin(t);
  nodePositions[i3 + 2] = r * Math.cos(p);
  const c = new THREE.Color().setHSL(0.75, 1.0, 0.6);
  nodeColors[i3] = c.r;
  nodeColors[i3 + 1] = c.g;
  nodeColors[i3 + 2] = c.b;
  nodeSizes[i] = 2 + Math.random() * 3;
}

nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
nodeGeo.setAttribute('size', new THREE.BufferAttribute(nodeSizes, 1));

const nodeMat = new THREE.ShaderMaterial({
  vertexShader: vertShader,
  fragmentShader: fragShader,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const nodes = new THREE.Points(nodeGeo, nodeMat);
scene.add(nodes);

const EDGE_MAX = 60;
const edgeGeo = new THREE.BufferGeometry();
const edgePositions = new Float32Array(EDGE_MAX * 6);
const edgeColors = new Float32Array(EDGE_MAX * 6);
edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
const edges = new THREE.LineSegments(edgeGeo, edgeMat);
scene.add(edges);

const coreGeo = new THREE.IcosahedronGeometry(1.5, 2);
const coreMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, transparent: true, opacity: 0.4 });
const core = new THREE.Mesh(coreGeo, coreMat);
scene.add(core);

const coreGlowGeo = new THREE.SphereGeometry(1.8, 32, 32);
const coreGlowMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.08 });
const coreGlow = new THREE.Mesh(coreGlowGeo, coreGlowMat);
scene.add(coreGlow);

const ringGeo = new THREE.RingGeometry(2.5, 2.7, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
const ring1 = new THREE.Mesh(ringGeo, ringMat);
ring1.rotation.x = Math.PI / 2.5;
scene.add(ring1);

const ring2Geo = new THREE.RingGeometry(3.2, 3.4, 64);
const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
ring2.rotation.x = Math.PI / 1.8;
ring2.rotation.z = Math.PI / 4;
scene.add(ring2);

let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

let aiActivity = 0;
window.setAIActivity = (level) => { aiActivity = Math.max(0, Math.min(1, level)); };

function updateEdges() {
  const pos = nodeGeo.attributes.position.array;
  const col = edgeGeo.attributes.color.array;
  const ePos = edgeGeo.attributes.position.array;
  let edgeIdx = 0;
  for (let i = 0; i < NODE_COUNT && edgeIdx < EDGE_MAX; i++) {
    for (let j = i + 1; j < NODE_COUNT && edgeIdx < EDGE_MAX; j++) {
      const dx = pos[i*3] - pos[j*3];
      const dy = pos[i*3+1] - pos[j*3+1];
      const dz = pos[i*3+2] - pos[j*3+2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 8) {
        const e3 = edgeIdx * 6;
        ePos[e3] = pos[i*3]; ePos[e3+1] = pos[i*3+1]; ePos[e3+2] = pos[i*3+2];
        ePos[e3+3] = pos[j*3]; ePos[e3+4] = pos[j*3+1]; ePos[e3+5] = pos[j*3+2];
        const alpha = 1 - dist / 8;
        col[e3] = 0.3; col[e3+1] = 0.6; col[e3+2] = 0.9;
        col[e3+3] = 0.3; col[e3+4] = 0.6; col[e3+5] = 0.9;
        edgeIdx++;
      }
    }
  }
  for (let k = edgeIdx * 6; k < EDGE_MAX * 6; k++) { ePos[k] = 0; col[k] = 0; }
  edgeGeo.attributes.position.needsUpdate = true;
  edgeGeo.attributes.color.needsUpdate = true;
  edgeGeo.setDrawRange(0, edgeIdx * 2);
}

function animate() {
  requestAnimationFrame(animate);
  const t = Date.now() * 0.001;

  const pos = geo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    pos[i3] += velocities[i3];
    pos[i3 + 1] += velocities[i3 + 1];
    pos[i3 + 2] += velocities[i3 + 2];
    const r = Math.sqrt(pos[i3]**2 + pos[i3+1]**2 + pos[i3+2]**2);
    if (r > 30) { velocities[i3] *= -1; velocities[i3+1] *= -1; velocities[i3+2] *= -1; }
  }
  geo.attributes.position.needsUpdate = true;

  const nPos = nodeGeo.attributes.position.array;
  for (let i = 0; i < NODE_COUNT; i++) {
    const i3 = i * 3;
    nPos[i3] += Math.sin(t * 0.3 + i) * 0.01;
    nPos[i3 + 1] += Math.cos(t * 0.2 + i * 0.5) * 0.01;
    nPos[i3 + 2] += Math.sin(t * 0.15 + i * 0.3) * 0.01;
  }
  nodeGeo.attributes.position.needsUpdate = true;

  updateEdges();

  core.rotation.x += 0.003 + aiActivity * 0.01;
  core.rotation.y += 0.005 + aiActivity * 0.015;
  core.scale.setScalar(1 + Math.sin(t * 2) * 0.05 + aiActivity * 0.3);

  coreGlow.scale.setScalar(1 + Math.sin(t * 1.5) * 0.1 + aiActivity * 0.5);
  coreGlowMat.opacity = 0.08 + aiActivity * 0.15;

  ring1.rotation.z += 0.005 + aiActivity * 0.02;
  ring2.rotation.y -= 0.003 + aiActivity * 0.01;

  particles.rotation.y += 0.0003;
  nodes.rotation.y -= 0.0005;

  camera.position.x += (mouseX * 3 - camera.position.x) * 0.02;
  camera.position.y += (-mouseY * 2 - camera.position.y) * 0.02;
  camera.lookAt(scene.position);

  const orb = document.getElementById('aiOrb');
  if (orb) orb.style.setProperty('--activity', aiActivity);

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
