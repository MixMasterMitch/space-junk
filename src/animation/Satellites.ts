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
    BufferGeometry, Vector3
} from 'three';
import Earth from './Earth';
import { GUIData } from './index';
import Satellite from './Satellite';
import { SatelliteTrailMaterial } from './SatelliteTrailMaterial';
import { MeshLine } from './meshline';
import { SatelliteSphereMaterial } from './SatelliteSphereMaterial';
import {isEqual, memcpy} from "./utils";
import {log} from "../utils";

export default class Satellites {
    private satelliteData?: Satellite[];
    private spheres?: Mesh;
    private trails?: Mesh;
    private trail?: Mesh;
    private trail2?: Mesh;
    private curTrailIndex = 0;

    private static NUM_SATELLITES = 3;
    private static NUM_TAIL_VERTICES = 10;

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
        trailGeometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3),
        );
        trailGeometry.setAttribute(
            'previous',
            new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3),
        );
        trailGeometry.setAttribute(
            'next',
            new BufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * Satellites.NUM_TAIL_VERTICES * 2 * 3), 3),
        );
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
            lineWidth: 0.05,
            resolution: new Vector2(window.innerWidth, window.innerHeight),
            opacity: 0.5,
        });
        this.trails = new Mesh(trailGeometry, trailMaterial);
        // this.trails.receiveShadow = true;
        this.trails.frustumCulled = false;
        scene.add(this.trails);

        const geometry = new MeshLine();
        const points = [];
        for (let i = 0; i < Satellites.NUM_TAIL_VERTICES * 3; i++) {
            points[i] = 0;
        }
        geometry.setPoints(points, (i) => {
            return i;
        });
        this.trail = new Mesh(geometry, trailMaterial);
        this.trail.frustumCulled = false;
        // scene.add(this.trail);

        const geometry2 = new MeshLine();
        const points2 = [];
        for (let i = 0; i < Satellites.NUM_TAIL_VERTICES * 3; i++) {
            points2[i] = 0;
        }
        geometry2.setPoints(points2, (i) => {
            return i;
        });
        this.trail2 = new Mesh(geometry2, trailMaterial);
        this.trail2.frustumCulled = false;
        // scene.add(this.trail2);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.satelliteData || !this.spheres || !this.trails || !this.trail || !this.trail2) {
            return;
        }
        // const prevTrailIndex = (this.curTrailIndex - 1 + Satellites.NUM_TAIL_VERTICES) % Satellites.NUM_TAIL_VERTICES;
        // const nextTrailIndex = (this.curTrailIndex + 1) % Satellites.NUM_TAIL_VERTICES;
        // For each satellite, get an updated position and save it to the translation array
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = this.satelliteData[i];
            const position = satelliteData.getPosition(date);

            if (i === 0) {
                (this.trail.geometry as MeshLine).advance(position);
            } else {
                (this.trail2.geometry as MeshLine).advance(position);
            }

            const translationArray = this.spheres.geometry.attributes.translation.array as Float32Array;
            translationArray[i * 3] = position.x;
            translationArray[i * 3 + 1] = position.y;
            translationArray[i * 3 + 2] = position.z;

            const positionArray = this.trails.geometry.attributes.position.array as Float32Array;
            const previousArray = this.trails.geometry.attributes.previous.array as Float32Array;
            const nextArray = this.trails.geometry.attributes.next.array as Float32Array;
            const { x, y, z } = position;
            const l = positionArray.length / Satellites.NUM_SATELLITES;
            // const indexl = (this.trails.geometry.getIndex()?.array.length || 0) / Satellites.NUM_SATELLITES;
            // const prevPosition = new Vector3(positionArray[l - 6], positionArray[l - 5], positionArray[l - 4]);
            // log(prevPosition.sub(position).length());
            const offset = i * Satellites.NUM_TAIL_VERTICES * 2 * 3;
            // const indexOffset = i * (Satellites.NUM_TAIL_VERTICES - 1) * 2 * 3;

            // PREVIOUS
            memcpy(positionArray, offset, previousArray, offset, l);

            // POSITIONS
            memcpy(positionArray, offset + 6, positionArray, offset, l - 6);

            positionArray[offset + l - 6] = x;
            positionArray[offset + l - 5] = y;
            positionArray[offset + l - 4] = z;
            positionArray[offset + l - 3] = x;
            positionArray[offset + l - 2] = y;
            positionArray[offset + l - 1] = z;

            // NEXT
            memcpy(positionArray, offset + 6, nextArray, offset, l - 6);

            nextArray[offset + l - 6] = x;
            nextArray[offset + l - 5] = y;
            nextArray[offset + l - 4] = z;
            nextArray[offset + l - 3] = x;
            nextArray[offset + l - 2] = y;
            nextArray[offset + l - 1] = z;


            // positionArray[(i + this.curTrailIndex) * 3] = position.x;
            // positionArray[(i + this.curTrailIndex) * 3 + 1] = position.y;
            // positionArray[(i + this.curTrailIndex) * 3 + 2] = position.z;
            // previousArray[(i + this.curTrailIndex) * 3] = positionArray[(i + prevTrailIndex) * 3];
            // previousArray[(i + this.curTrailIndex) * 3 + 1] = positionArray[(i + prevTrailIndex) * 3 + 1];
            // previousArray[(i + this.curTrailIndex) * 3 + 2] = positionArray[(i + prevTrailIndex) * 3 + 2];
            // previousArray[(i + nextTrailIndex) * 3] = positionArray[(i + nextTrailIndex) * 3];
            // previousArray[(i + nextTrailIndex) * 3 + 1] = positionArray[(i + nextTrailIndex) * 3 + 1];
            // previousArray[(i + nextTrailIndex) * 3 + 2] = positionArray[(i + nextTrailIndex) * 3 + 2];
            // nextArray[(i + prevTrailIndex) * 3] = position.x;
            // nextArray[(i + prevTrailIndex) * 3 + 1] = position.y;
            // nextArray[(i + prevTrailIndex) * 3 + 2] = position.z;
            // nextArray[(i + this.curTrailIndex) * 3] = position.x;
            // nextArray[(i + this.curTrailIndex) * 3 + 1] = position.y;
            // nextArray[(i + this.curTrailIndex) * 3 + 2] = position.z;

            // if (i === 0) {
            //     log(isEqual(positionArray.subarray(offset, offset + l), this.trail.geometry.attributes.position.array));
            //     log(isEqual(previousArray.subarray(offset, offset + l), this.trail.geometry.attributes.previous.array));
            //     log(isEqual(nextArray.subarray(offset, offset + l), this.trail.geometry.attributes.next.array));
            //     log(isEqual(this.trails.geometry.attributes.width.array.subarray(offset / 3, (offset + l) / 3), this.trail.geometry.attributes.width.array));
            //     log(isEqual(this.trails.geometry.attributes.side.array.subarray(offset / 3, (offset + l) / 3), this.trail.geometry.attributes.side.array));
            //     log(isEqual(this.trails.geometry.getIndex()?.array.subarray(indexOffset, indexOffset + indexl) as Uint32Array, this.trail.geometry.getIndex()?.array as Uint32Array));
            // } else {
            //     log(isEqual(positionArray.subarray(offset, offset + l), this.trail2.geometry.attributes.position.array));
            //     log(isEqual(previousArray.subarray(offset, offset + l), this.trail2.geometry.attributes.previous.array));
            //     log(isEqual(nextArray.subarray(offset, offset + l), this.trail2.geometry.attributes.next.array));
            //     log(isEqual(this.trails.geometry.attributes.width.array.subarray(offset / 3, (offset + l) / 3), this.trail2.geometry.attributes.width.array));
            //     log(isEqual(this.trails.geometry.attributes.side.array.subarray(offset / 3, (offset + l) / 3), this.trail2.geometry.attributes.side.array));
            //     log(isEqual(this.trails.geometry.getIndex()?.array.subarray(indexOffset, indexOffset + indexl) as Uint32Array, this.trail2.geometry.getIndex()?.array as Uint32Array));
            // }
        }
        this.spheres.geometry.attributes.translation.needsUpdate = true;

        this.trails.geometry.attributes.position.needsUpdate = true;
        this.trails.geometry.attributes.previous.needsUpdate = true;
        this.trails.geometry.attributes.next.needsUpdate = true;
        // log('test');
        // log(isEqual(this.trails.geometry.attributes.position.array, this.trail.geometry.attributes.position.array));
        // log(isEqual(this.trails.geometry.attributes.previous.array, this.trail.geometry.attributes.previous.array));
        // log(isEqual(this.trails.geometry.attributes.next.array, this.trail.geometry.attributes.next.array));
        // log(isEqual(this.trails.geometry.attributes.width.array, this.trail.geometry.attributes.width.array));
        // log(isEqual(this.trails.geometry.attributes.side.array, this.trail.geometry.attributes.side.array));
        // log(isEqual(this.trails.geometry.getIndex()?.array as Uint32Array, this.trail.geometry.getIndex()?.array as Uint32Array));
        // const trailIndex = this.trails.geometry.getIndex()?.array as Uint32Array;

        // this.curTrailIndex = (this.curTrailIndex + 1) % Satellites.NUM_TAIL_VERTICES;
    }
}
