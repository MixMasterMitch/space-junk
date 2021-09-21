import {
    Camera,
    Mesh,
    Renderer,
    Scene,
    SphereBufferGeometry,
    Color,
    InstancedBufferGeometry,
    InstancedBufferAttribute,
    BufferAttribute,
    Vector2,
    BufferGeometry,
} from 'three';
import Earth from './Earth';
import { GUIData } from './index';
import Satellite from './Satellite';
import { SatelliteTrailMaterial } from './SatelliteTrailMaterial';
import { SatelliteSphereMaterial } from './SatelliteSphereMaterial';
import { memcpy } from './utils';
import { log } from '../utils';
import Sun from './Sun';
import SceneComponent from './SceneComponent';

export default class Satellites extends SceneComponent {
    private static NUM_SATELLITES = 25000;
    private static NUM_TAIL_VERTICES = 20;

    private satelliteData?: Satellite[];
    private spheres?: Mesh;
    private trails?: Mesh;
    private trailTimestamps: number[] = [];

    private sun: Sun;

    constructor(sun: Sun) {
        super();
        this.sun = sun;
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // Initialize all of the satellite data
        this.satelliteData = [];
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = new Satellite(Math.round(-Math.random() * 14 * 24 * 60 * 60 * 1000), Math.random() + 1, 60 * 1000);
            await satelliteData.initialize(scene, renderer);
            this.satelliteData.push(satelliteData);
        }

        // The satellite spheres geometry is stored as an InstancedBufferGeometry, meaning that all of the spheres are rendered as a single geometry,
        // with some properties (e.g. the vertices of the sphere shape) being shared across all instances (i.e. individual spheres) and other properties
        // (e.g. the translation of each sphere) are set per instance.
        // The translation math to shift the position of each vertex of each sphere is being done in the GPU to free up the CPU.
        const sphereGeometry = new InstancedBufferGeometry().copy(new SphereBufferGeometry(Earth.RADIUS * 0.01, 12, 8));
        sphereGeometry.instanceCount = Satellites.NUM_SATELLITES;
        sphereGeometry.setAttribute('translation', new InstancedBufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * 3), 3));

        const sphereMaterial = new SatelliteSphereMaterial({
            diffuse: new Color(0xffffff),
            emissive: new Color(0xffc602).multiplyScalar(0.5),
        });
        this.spheres = new Mesh(sphereGeometry, sphereMaterial);
        this.spheres.receiveShadow = true;
        scene.add(this.spheres);

        const trailGeometry = new BufferGeometry();
        // trailGeometry.instanceCount = Satellites.NUM_SATELLITES;
        trailGeometry.setAttribute('position', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3));
        trailGeometry.setAttribute('previous', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3));
        trailGeometry.setAttribute('next', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3));
        trailGeometry.setAttribute('sunPosition', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3));
        const sideArray = new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2);
        trailGeometry.setAttribute('side', new BufferAttribute(sideArray, 1));
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const offset = i * Satellites.NUM_TAIL_VERTICES * 2;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES; j++) {
                sideArray[offset + j * 2] = 1;
                sideArray[offset + j * 2 + 1] = -1;
            }
        }
        const widthArray = new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2);
        trailGeometry.setAttribute('width', new BufferAttribute(widthArray, 1));
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const offset = i * Satellites.NUM_TAIL_VERTICES * 2;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES; j++) {
                const width = j / (Satellites.NUM_TAIL_VERTICES - 1);
                widthArray[offset + j * 2] = width;
                widthArray[offset + j * 2 + 1] = width;
            }
        }
        const indexArray = new Uint32Array(Satellites.NUM_SATELLITES * (Satellites.NUM_TAIL_VERTICES - 1) * 2 * 3);
        trailGeometry.setIndex(new BufferAttribute(indexArray, 1));
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const offset = i * (Satellites.NUM_TAIL_VERTICES - 1) * 2 * 3;
            const vertxOffset = i * Satellites.NUM_TAIL_VERTICES * 2;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES - 1; j++) {
                indexArray[offset + j * 2 * 3] = vertxOffset + j * 2;
                indexArray[offset + j * 2 * 3 + 1] = vertxOffset + j * 2 + 1;
                indexArray[offset + j * 2 * 3 + 2] = vertxOffset + j * 2 + 2;
                indexArray[offset + j * 2 * 3 + 3] = vertxOffset + j * 2 + 2;
                indexArray[offset + j * 2 * 3 + 4] = vertxOffset + j * 2 + 1;
                indexArray[offset + j * 2 * 3 + 5] = vertxOffset + j * 2 + 3;
            }
        }

        const trailMaterial = new SatelliteTrailMaterial({
            color: new Color(0xffffff),
            sizeAttenuation: 1,
            lineWidth: 0.02,
            resolution: new Vector2(window.innerWidth, window.innerHeight),
            opacity: 0.25,
            earthRadius: Earth.RADIUS,
        });
        this.trails = new Mesh(trailGeometry, trailMaterial);
        // this.trails.receiveShadow = true;
        this.trails.frustumCulled = false;
        scene.add(this.trails);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.satelliteData || !this.spheres || !this.trails) {
            return;
        }

        const translationArray = this.spheres.geometry.attributes.translation.array as Float32Array;
        const positionArray = this.trails.geometry.attributes.position.array as Float32Array;
        const previousArray = this.trails.geometry.attributes.previous.array as Float32Array;
        const nextArray = this.trails.geometry.attributes.next.array as Float32Array;
        const sunPositionArray = this.trails.geometry.attributes.sunPosition.array as Float32Array;

        const advanceTrail =
            this.trailTimestamps.length < Satellites.NUM_TAIL_VERTICES ||
            date.getTime() - this.trailTimestamps[this.trailTimestamps.length - 1] >= (guiData.tailLength * 60 * 1000) / (Satellites.NUM_TAIL_VERTICES - 1);
        if (advanceTrail) {
            this.trailTimestamps.push(date.getTime());
            if (this.trailTimestamps.length > Satellites.NUM_TAIL_VERTICES) {
                this.trailTimestamps.shift();
            }

            // PREVIOUS
            memcpy(positionArray, 0, previousArray, 0, positionArray.length);

            // POSITIONS
            memcpy(positionArray, 6, positionArray, 0, positionArray.length - 6);

            // NEXT
            memcpy(positionArray, 6, nextArray, 0, positionArray.length - 6);

            // SUN POSITION
            memcpy(sunPositionArray, 6, sunPositionArray, 0, sunPositionArray.length - 6);
        }

        const sunPosition = this.sun.getPosition();
        const sunPositionVectorArray = new Float32Array([sunPosition.x, sunPosition.y, sunPosition.z]);

        // For each satellite, get an updated position and save it to the translation array and update the trail
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = this.satelliteData[i];
            const position = satelliteData.getPosition(date);

            translationArray[i * 3] = position.x;
            translationArray[i * 3 + 1] = position.y;
            translationArray[i * 3 + 2] = position.z;

            const l = positionArray.length / Satellites.NUM_SATELLITES;
            const offset = i * Satellites.NUM_TAIL_VERTICES * 2 * 3;

            const positionVectorArray = new Float32Array([position.x, position.y, position.z]);
            positionArray.set(positionVectorArray, offset + l - 6);
            positionArray.set(positionVectorArray, offset + l - 3);
            nextArray.set(positionVectorArray, offset + l - 12);
            nextArray.set(positionVectorArray, offset + l - 9);
            nextArray.set(positionVectorArray, offset + l - 6);
            nextArray.set(positionVectorArray, offset + l - 3);
            sunPositionArray.set(sunPositionVectorArray, offset + l - 6);
            sunPositionArray.set(sunPositionVectorArray, offset + l - 3);
        }
        this.spheres.geometry.attributes.translation.needsUpdate = true;

        this.trails.geometry.attributes.position.needsUpdate = true;
        this.trails.geometry.attributes.previous.needsUpdate = true;
        this.trails.geometry.attributes.next.needsUpdate = true;
        this.trails.geometry.attributes.sunPosition.needsUpdate = true;
    }
}
