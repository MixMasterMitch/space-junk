import {
    BufferAttribute,
    BufferGeometry,
    Camera,
    Color,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    Renderer,
    Scene,
    SphereBufferGeometry,
    Vector2,
} from 'three';
import Earth from './Earth';
import {GUIData} from './index';
import Satellite from './Satellite';
import {SatelliteTrailMaterial} from './SatelliteTrailMaterial';
import {SatelliteSphereMaterial} from './SatelliteSphereMaterial';
import {memcpy} from './utils';
import Sun from './Sun';
import SceneComponent from './SceneComponent';

export default class Satellites extends SceneComponent {
    private static NUM_SATELLITES = 25000;
    private static NUM_TAIL_SEGMENTS = 20;
    private static NUM_TAIL_TRIANGLES = Satellites.NUM_TAIL_SEGMENTS + 1;
    private static NUM_TAIL_VERTICES = Satellites.NUM_TAIL_SEGMENTS + 3;

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
        this.spheres.frustumCulled = false;
        scene.add(this.spheres);

        const trailGeometry = new BufferGeometry();
        // trailGeometry.instanceCount = Satellites.NUM_SATELLITES;
        trailGeometry.setAttribute('position', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 3), 3));
        trailGeometry.setAttribute('previous', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 3), 3));
        trailGeometry.setAttribute('sunPosition', new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 3), 3));
        const sideArray = new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES);
        trailGeometry.setAttribute('side', new BufferAttribute(sideArray, 1));
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const offset = i * Satellites.NUM_TAIL_VERTICES;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES; j++) {
                sideArray[offset + j * 2] = i % 2 === 0 ? 1 : -1;
            }
        }
        const widthArray = new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES);
        trailGeometry.setAttribute('width', new BufferAttribute(widthArray, 1));
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const offset = i * Satellites.NUM_TAIL_VERTICES;
            widthArray[offset] = 0;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES - 2; j++) {
                widthArray[offset + 1 + j] = j / (Satellites.NUM_TAIL_VERTICES - 3);
            }
            widthArray[offset + Satellites.NUM_TAIL_VERTICES - 1] = 1;
        }
        const indexArray = new Uint32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_TRIANGLES * 3);
        trailGeometry.setIndex(new BufferAttribute(indexArray, 1));
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const offset = i * Satellites.NUM_TAIL_TRIANGLES * 3;
            const vertexOffset = i * Satellites.NUM_TAIL_VERTICES;
            for (let j = 0; j < Satellites.NUM_TAIL_TRIANGLES; j++) {
                indexArray[offset + j * 3] = vertexOffset + j;
                indexArray[offset + j * 3 + 1] = vertexOffset + j + 1;
                indexArray[offset + j * 3 + 2] = vertexOffset + j + 2;
            }
        }

        const trailMaterial = new SatelliteTrailMaterial({
            color: new Color(0xffffff),
            sizeAttenuation: 1,
            lineWidth: 0.02,
            resolution: new Vector2(window.innerWidth, window.innerHeight),
            opacity: 0.25,
            earthRadius: Earth.RADIUS,
            depthWrite: false,
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
        const sunPositionArray = this.trails.geometry.attributes.sunPosition.array as Float32Array;

        const advanceTrail =
            this.trailTimestamps.length < Satellites.NUM_TAIL_TRIANGLES ||
            date.getTime() - this.trailTimestamps[this.trailTimestamps.length - 1] >= (guiData.tailLength * 60 * 1000) / (Satellites.NUM_TAIL_TRIANGLES - 1);
        if (advanceTrail) {
            this.trailTimestamps.push(date.getTime());
            if (this.trailTimestamps.length > Satellites.NUM_TAIL_TRIANGLES) {
                this.trailTimestamps.shift();
            }

            // PREVIOUS
            memcpy(positionArray, 0, previousArray, 0, positionArray.length);

            // POSITIONS
            memcpy(positionArray, 3, positionArray, 0, positionArray.length - 3);

            // SUN POSITION
            memcpy(sunPositionArray, 3, sunPositionArray, 0, sunPositionArray.length - 3);
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
            const offset = i * Satellites.NUM_TAIL_VERTICES * 3;

            const positionVectorArray = new Float32Array([position.x, position.y, position.z]);
            positionArray.set(positionVectorArray, offset + l - 6);
            positionArray.set(positionVectorArray, offset + l - 3);
            sunPositionArray.set(sunPositionVectorArray, offset + l - 6);
            sunPositionArray.set(sunPositionVectorArray, offset + l - 3);
            // Technically, the first position also needs to be updated but since the width is 0, it doesn't actually make
            // a difference visually. Therefore, that step is cut out here.
        }
        this.spheres.geometry.attributes.translation.needsUpdate = true;

        this.trails.geometry.attributes.position.needsUpdate = true;
        this.trails.geometry.attributes.previous.needsUpdate = true;
        this.trails.geometry.attributes.sunPosition.needsUpdate = true;
    }
}
