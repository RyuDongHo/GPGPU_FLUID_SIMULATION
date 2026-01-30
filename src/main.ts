import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SPH } from "./mesh/sph";

//////////////////////// three.js setup ////////////////////////
//////////////////////// three.js setup ////////////////////////
//////////////////////// three.js setup ////////////////////////
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // 배경색 추가

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer({ canvas });

renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(5, 5, 10); // x, y, z 모두 설정

// OrbitControls 추가
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
//////////////////////// three.js setup ////////////////////////
//////////////////////// three.js setup ////////////////////////
//////////////////////// three.js setup ////////////////////////

const particles: SPH[] = [];
const meshes: THREE.Mesh[] = [];
const gravity = new THREE.Vector3(0, -9.8, 0);
const deltaTime = 0.016; // 약 60 FPS
const boxWidth = 5;
const boxHeight = 5;
const floorY = -2;

const initLight = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.intensity = 3;
  scene.add(ambientLight);
  scene.add(directionalLight);
};

const initSpheres = (numToSpawn: number = 125) => {
  const geometry = new THREE.SphereGeometry(0.1, 32, 32);
  const material = new THREE.MeshPhongMaterial({ color: "blue" });
  const sphere = new THREE.Mesh(geometry, material);
  numToSpawn = numToSpawn > 125 ? numToSpawn : 125;
  // numToSpawn을 3의 제곱근으로 수정
  numToSpawn = Math.cbrt(numToSpawn);
  numToSpawn = Math.floor(numToSpawn);

  for (let x = 0; x < numToSpawn; ++x) {
    for (let y = 0; y < numToSpawn; ++y) {
      for (let z = 0; z < numToSpawn; ++z) {
        const spacing = 0.6;
        const pos_x = (x - numToSpawn / 2) * spacing;
        const pos_y = (y - numToSpawn / 2) * spacing;
        const pos_z = (z - numToSpawn / 2) * spacing;
        const sph = new SPH(new THREE.Vector3(pos_x, pos_y, pos_z));
        particles.push(sph);

        const new_sphere = sphere.clone();
        new_sphere.position.set(sph.position.x, sph.position.y, sph.position.z);
        scene.add(new_sphere);
        meshes.push(new_sphere);
      }
    }
  }
};

const gravityUpdate = () => {
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    // 중력 적용
    p.force.add(gravity.clone());
    // 속도 계산, v += a*t
    p.velocity.add(
      p.force
        .clone()
        .multiplyScalar(1 / p.mass)
        .multiplyScalar(deltaTime),
    );
    // 위치 업데이트
    p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
    // 힘 초기화
    p.force.set(0, 0, 0);
    // 메쉬 위치 업데이트
    meshes[i].position.set(p.position.x, p.position.y, p.position.z);
  }
};
const collisionUpdate = () => {
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    if (p.position.y < floorY) {
      p.position.y = floorY;
      p.velocity.y *= p.boundDamping; // 반발 계수 적용
    }
    if(p.position.y > floorY + boxHeight) {
      p.position.y = floorY + boxHeight;
      p.velocity.y *= p.boundDamping;
    }
    if (p.position.x < -boxWidth / 2) {
      p.position.x = -boxWidth / 2;
      p.velocity.x *= p.boundDamping;
    }
    if (p.position.x > boxWidth / 2) {
      p.position.x = boxWidth / 2;
      p.velocity.x *= p.boundDamping;
    }
    if (p.position.z < -boxWidth / 2) {
      p.position.z = -boxWidth / 2;
      p.velocity.z *= p.boundDamping;
    }
    if (p.position.z > boxWidth / 2) {
      p.position.z = boxWidth / 2;
      p.velocity.z *= p.boundDamping;
    }
  }
};
const densityUpdate = () => {
  for(let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    p.density = 0.0;
    const h = 2.0; // Smoothing length
    for(let j = 0; j < particles.length; ++j) {
      if(i === j) continue;
      const neighbor = particles[j];
      const dist = p.position.distanceTo(neighbor.position);
      if(dist < h) {
        // Poly6 Kernel
        const coeff = 315 / (64 * Math.PI * Math.pow(h, 9));
        const term = Math.pow((h * h - dist * dist), 3);
        p.density += neighbor.mass * coeff * term;
      }
    }
  }
}
const pressureUpdate = () => {
  const gasConstant = 200;
  const restDensity = 60;
  for(let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    p.pressure = gasConstant * Math.max(0, p.density - restDensity);
  }
}
const pressureForceUpdate = () => {
  for(let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    const h = 2.0;
    for(let j = 0; j < particles.length; ++j) {
      if(i === j) continue;
      const neighbor = particles[j];
      const dist = p.position.distanceTo(neighbor.position);
      if(dist < h) {
        // Spiky Kernel Gradient
        const coeff = -45 / (Math.PI * Math.pow(h, 6));
        const term = Math.pow((h - dist), 2);
        const direction = neighbor.position.clone().sub(p.position).normalize();
        const pressureTerm = (p.pressure + neighbor.pressure) / (2 * Math.max(neighbor.density, 0.0001));
        const forceMagnitude = neighbor.mass * coeff * term * pressureTerm;
        const pressureForce = direction.multiplyScalar(forceMagnitude);
        p.force.add(pressureForce);
      }
    }
  }
}
const viscosityForceUpdate = () => {
  const viscosityCoefficient = 0.1;
  const h = 2.0;
  for(let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    for(let j = 0; j < particles.length; ++j) {
      if(i === j) continue;
      const neighbor = particles[j];
      const dist = p.position.distanceTo(neighbor.position);
      if(dist < h) {
        // Viscosity Kernel Laplacian
        const coeff = 45 / (Math.PI * Math.pow(h, 6));
        const term = (h - dist);
        const velocityDiff = neighbor.velocity.clone().sub(p.velocity);
        const viscosityForce = velocityDiff.multiplyScalar(viscosityCoefficient * neighbor.mass * coeff * term / Math.max(neighbor.density, 0.0001));
        p.force.add(viscosityForce);
      }
    }
  }
}

const animate = () => {
  requestAnimationFrame(animate);
  densityUpdate();
  pressureUpdate();
  pressureForceUpdate();
  viscosityForceUpdate();
  gravityUpdate();
  collisionUpdate();
  controls.update(); // controls 업데이트 추가
  renderer.render(scene, camera);
};

initSpheres(600);
initLight();
animate();
