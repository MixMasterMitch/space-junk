import {
    Camera,
    Mesh,
    Renderer,
    Scene,
    MeshPhongMaterial,
    SphereBufferGeometry,
    Vector3,
    MeshLambertMaterial
} from 'three';
import Earth from './Earth';
import { GUIData } from './index';
import Satellite from './Satellite';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { log } from '../utils';

export default class Satellites {
    private satelliteData?: Satellite[];
    private geometries?: SphereBufferGeometry[];
    private spheres?: Mesh;

    private static NUM_SATELLITES = 10000;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        this.satelliteData = [];
        this.geometries = [];
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = new Satellite(Math.round(Math.random() * 7 * 24 * 60 * 60 * 1000));
            await satelliteData.initialize(scene, renderer);
            this.satelliteData.push(satelliteData);
            const geometry = new SphereBufferGeometry(Earth.RADIUS * 0.01, 9, 6);
            this.geometries.push(geometry);
        }
        const mergedGeometry = mergeBufferGeometries(this.geometries);
        const positionSize = mergedGeometry.attributes.position.array.length / Satellites.NUM_SATELLITES;
        log(positionSize);
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const geometry = this.geometries[i];
            (mergedGeometry.attributes.position.array as Float32Array).set(geometry.attributes.position.array, i * positionSize);
            (geometry.attributes.position.array as Float32Array) = new Float32Array(
                mergedGeometry.attributes.position.array.buffer,
                i * positionSize * Float32Array.BYTES_PER_ELEMENT,
                positionSize,
            );
            (geometry.attributes.normal as unknown) = undefined;
            (geometry.attributes.uv as unknown) = undefined;
        }

        const material = new MeshLambertMaterial({ color: 0xffffff, emissive: 0xffc602, emissiveIntensity: 0.6 });
        this.spheres = new Mesh(mergedGeometry, material);
        this.spheres.receiveShadow = true;
        scene.add(this.spheres);
        log(this.spheres.geometry.attributes.position.array);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.satelliteData || !this.geometries || !this.spheres) {
            return;
        }

        const positionSize = this.spheres.geometry.attributes.position.array.length / Satellites.NUM_SATELLITES;
        const normalSize = this.spheres.geometry.attributes.normal.array.length / Satellites.NUM_SATELLITES;
        const uvSize = this.spheres.geometry.attributes.uv.array.length / Satellites.NUM_SATELLITES;
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = this.satelliteData[i];
            const geometry = this.geometries[i];
            if (Math.round(Math.random() * 0) === 0) {
                const { prev, cur } = satelliteData.getPosition(date);
                const delta = new Vector3(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
                geometry.translate(delta.x, delta.y, delta.z);
                // (this.spheres.geometry.attributes.position.array as Float32Array).set(geometry.attributes.position.array, i * positionSize);
                // (this.spheres.geometry.attributes.normal.array as Float32Array).set(geometry.attributes.normal.array, i * normalSize);
                // (this.spheres.geometry.attributes.uv.array as Float32Array).set(geometry.attributes.uv.array, i * uvSize);
            }
            // (this.spheres.geometry.attributes.position.array as Float32Array).set(geometry.attributes.position.array, i * positionSize);
        }

        this.spheres.geometry.attributes.position.needsUpdate = true;
    }
}
