import SceneComponent from './SceneComponent';
import { AmbientLight, Camera, DirectionalLight, Renderer, Scene } from 'three';
import { getJ200SiderealYearPercentage, percentageToRadians } from '../utils';
import * as THREE from 'three';
import { AXIAL_TILT_RAD } from '../constants';
import Earth from './Earth';

export default class Sun extends SceneComponent {
    private sun?: DirectionalLight;
    private sunSecondary?: DirectionalLight;
    private backgroundLight?: AmbientLight;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        this.sun = new DirectionalLight(0xffffff, 0.8);
        this.sun.position.set(0, 0, 0);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;
        this.sun.shadow.camera.top = Earth.RADIUS * 2;
        this.sun.shadow.camera.bottom = -Earth.RADIUS * 2;
        this.sun.shadow.camera.left = -Earth.RADIUS * 2;
        this.sun.shadow.camera.right = Earth.RADIUS * 2;
        this.sun.shadow.camera.near = -Earth.RADIUS * 2;
        this.sun.shadow.camera.far = Earth.GEOSTATIONARY * 1.5;
        scene.add(this.sun);

        this.sunSecondary = new DirectionalLight(0xffffff, 0.2);
        this.sunSecondary.position.set(0, 0, 0);
        this.sunSecondary.castShadow = false;
        scene.add(this.sunSecondary);

        this.backgroundLight = new AmbientLight(0xffffff, 0.2);
        // scene.add(this.backgroundLight);

        // const helper = new THREE.CameraHelper(this.sun.shadow.camera);
        // scene.add(helper);
    }

    public render(date: Date, camera: Camera): void {
        if (!this.sun || !this.sunSecondary) {
            return;
        }

        const revolutionPercentage = getJ200SiderealYearPercentage(date);
        console.log(revolutionPercentage);

        const sunVector = new THREE.Vector3(1, 0, 0);
        const sunEuler = new THREE.Euler(0, percentageToRadians(revolutionPercentage), -AXIAL_TILT_RAD * Math.cos(percentageToRadians(revolutionPercentage)));
        const sunMatrix = new THREE.Matrix4().makeRotationFromEuler(sunEuler);
        const sunPosition = sunVector.applyMatrix4(sunMatrix);
        this.sun.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
        this.sunSecondary.position.set(sunPosition.x * 5, sunPosition.y * 5, sunPosition.z * 5);
    }

    public getPosition(): THREE.Vector3 {
        if (!this.sun) {
            return (null as unknown) as THREE.Vector3;
        }
        return this.sun.position.clone();
    }
}
