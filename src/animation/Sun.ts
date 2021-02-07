import SceneComponent from './SceneComponent';
import { Camera, DirectionalLight, Renderer, Scene } from 'three';
import { getJ200SiderealYearPercentage, percentageToRadians } from '../utils';
import * as THREE from 'three';
import { AXIAL_TILT_RAD } from '../constants';

export default class Sun extends SceneComponent {
    private sun?: DirectionalLight;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        this.sun = new DirectionalLight(0xaaff33, 10);
        this.sun.position.set(0, 0, 0);
        scene.add(this.sun);
    }

    public render(date: Date, camera: Camera): void {
        if (!this.sun) {
            return;
        }

        const revolutionPercentage = getJ200SiderealYearPercentage(date);
        console.log(revolutionPercentage);

        const sunVector = new THREE.Vector3(1, 0, 0);
        const sunEuler = new THREE.Euler(0, percentageToRadians(revolutionPercentage), -AXIAL_TILT_RAD * Math.cos(percentageToRadians(revolutionPercentage)));
        const sunMatrix = new THREE.Matrix4().makeRotationFromEuler(sunEuler);
        const sunPosition = sunVector.applyMatrix4(sunMatrix);
        this.sun.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
    }

    public getPosition(): THREE.Vector3 {
        if (!this.sun) {
            return (null as unknown) as THREE.Vector3;
        }
        return this.sun.position.clone();
    }
}
