import * as THREE from "three";

export class SPH {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  force: THREE.Vector3;
  mass: number;
  density: number;
  pressure: number;
  boundDamping: number;

  constructor(position: THREE.Vector3, mass: number = 10.0, boundDamping: number = -0.8) {
    this.position = position;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.force = new THREE.Vector3(0, 0, 0);
    this.mass = mass;
    this.density = 0.0;
    this.pressure = 0.0;
    this.boundDamping = boundDamping;
  }
}
