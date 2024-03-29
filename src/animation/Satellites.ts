import {
    BufferAttribute,
    BufferGeometry,
    Camera,
    Color as Color3JS,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    Renderer,
    Scene,
    SphereBufferGeometry,
    Vector2,
    Vector3,
} from 'three';
import Earth from './Earth';
import { GUIData } from './index';
import SatellitePositionState from './SatellitePositionState';
import { SatelliteTrailMaterial } from './SatelliteTrailMaterial';
import { SatelliteSphereMaterial } from './SatelliteSphereMaterial';
import { memcpy } from './utils';
import Sun from './Sun';
import SceneComponent from './SceneComponent';
import SatellitesData from '../SatellitesData';
import { DateTime, Duration } from 'luxon';
import { modelUnitsToKm } from '../utils';
import Color from './Color';

export interface SatelliteStats {
    large: number;
    medium: number;
    small: number;
    payload: number;
    rocketBody: number;
    debris: number;
    starlink: number;
    gps: number;
    leo: number;
    geo: number;
    total: number;
}

export default class Satellites extends SceneComponent {
    private static NUM_TAIL_SEGMENTS = 20;
    private static NUM_TAIL_TRIANGLES = Satellites.NUM_TAIL_SEGMENTS + 1;
    private static NUM_TAIL_VERTICES = Satellites.NUM_TAIL_SEGMENTS + 3;
    private static ZERO_VECTOR = new Vector3(0, 0, 0);
    private static ZERO_VECTOR_ARRAY = new Float32Array([0, 0, 0]);
    private static STATUS_UPDATE_FREQUENCY = 60;

    private spheres?: Mesh;
    private trails?: Mesh;
    private prevDateTime?: DateTime;
    public stats?: SatelliteStats;

    private sun: Sun;
    private satellitePositionStates: SatellitePositionState[] = [];
    private trailTimestamps: DateTime[] = [];
    private iterationNum = 0;

    constructor(sun: Sun, satellitesData: SatellitesData) {
        super();
        this.sun = sun;
        for (const satellite of satellitesData) {
            this.satellitePositionStates.push(new SatellitePositionState(satellite, Duration.fromObject({ minutes: 1 })));
        }
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // Initialize all of the satellite data
        const numSatellites = this.satellitePositionStates.length;
        for (const satellitePositionState of this.satellitePositionStates) {
            await satellitePositionState.initialize(scene, renderer);
        }

        // Colors
        const saturation = 1;
        const lightness = 0.5;
        const energy = 0.2;
        const shininess = 16;

        // The satellite spheres geometry is stored as an InstancedBufferGeometry, meaning that all of the spheres are rendered as a single geometry,
        // with some properties (e.g. the vertices of the sphere shape) being shared across all instances (i.e. individual spheres) and other properties
        // (e.g. the translation of each sphere) are set per instance.
        // The translation math to shift the position of each vertex of each sphere is being done in the GPU to free up the CPU.
        const sphereGeometry = new InstancedBufferGeometry().copy(new SphereBufferGeometry(100 / 1000, 12, 8));
        sphereGeometry.instanceCount = numSatellites;
        sphereGeometry.setAttribute('translation', new InstancedBufferAttribute(new Float32Array(numSatellites * 3), 3));
        const sizeArray = new Float32Array(numSatellites);
        const diffuseArray = new Float32Array(numSatellites * 3);
        const emissiveArray = new Float32Array(numSatellites * 3);
        for (let i = 0; i < this.satellitePositionStates.length; i++) {
            const satellitePositionState = this.satellitePositionStates[i];
            sizeArray[i] = satellitePositionState.size;
            let hue;
            if (satellitePositionState.isISS) {
                hue = Color.SKY_BLUE.HUE;
            } else if (satellitePositionState.isHubble) {
                hue = Color.ORANGE.HUE;
            } else if (satellitePositionState.isGPS) {
                hue = Color.GREEN.HUE;
            } else if (satellitePositionState.isStarlinkSatellite) {
                hue = Color.PURPLE.HUE;
            } else if (satellitePositionState.type === 'PAYLOAD') {
                hue = Color.YELLOW.HUE;
            } else if (satellitePositionState.type === 'ROCKET BODY') {
                hue = Color.BLUE.HUE;
            } else {
                hue = Color.RED.HUE;
            }
            const diffuse = new Color3JS().setHSL(hue, saturation, lightness * 1.2).multiplyScalar(1.0 - energy);
            const emissive = new Color3JS().setHSL(hue, saturation, lightness / 1.2).multiplyScalar(1.0 - energy);
            diffuseArray.set([diffuse.r, diffuse.g, diffuse.b], i * 3);
            emissiveArray.set([emissive.r, emissive.g, emissive.b], i * 3);
        }
        sphereGeometry.setAttribute('size', new InstancedBufferAttribute(sizeArray, 1));
        sphereGeometry.setAttribute('diffuse', new InstancedBufferAttribute(diffuseArray, 3));
        sphereGeometry.setAttribute('emissive', new InstancedBufferAttribute(emissiveArray, 3));

        const sphereMaterial = new SatelliteSphereMaterial({
            specular: new Color3JS(0xffffff).multiplyScalar(energy),
            shininess,
        });
        this.spheres = new Mesh(sphereGeometry, sphereMaterial);
        this.spheres.receiveShadow = true;
        this.spheres.frustumCulled = false;
        scene.add(this.spheres);

        const trailGeometry = new BufferGeometry();
        // trailGeometry.instanceCount = SatellitesData.NUM_SATELLITES;
        trailGeometry.setAttribute('position', new BufferAttribute(new Float32Array(numSatellites * Satellites.NUM_TAIL_VERTICES * 3), 3));
        trailGeometry.setAttribute('previous', new BufferAttribute(new Float32Array(numSatellites * Satellites.NUM_TAIL_VERTICES * 3), 3));
        const sideArray = new Float32Array(numSatellites * Satellites.NUM_TAIL_VERTICES);
        trailGeometry.setAttribute('side', new BufferAttribute(sideArray, 1));
        for (let i = 0; i < numSatellites; i++) {
            const offset = i * Satellites.NUM_TAIL_VERTICES;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES; j++) {
                sideArray[offset + j * 2] = i % 2 === 0 ? 1 : -1;
            }
        }
        const widthArray = new Float32Array(numSatellites * Satellites.NUM_TAIL_VERTICES);
        trailGeometry.setAttribute('width', new BufferAttribute(widthArray, 1));
        for (let i = 0; i < numSatellites; i++) {
            const size = this.satellitePositionStates[i].size;
            const offset = i * Satellites.NUM_TAIL_VERTICES;
            widthArray[offset] = 0;
            for (let j = 0; j < Satellites.NUM_TAIL_VERTICES - 2; j++) {
                widthArray[offset + 1 + j] = (j / (Satellites.NUM_TAIL_VERTICES - 3)) * size;
            }
            widthArray[offset + Satellites.NUM_TAIL_VERTICES - 1] = size;
        }
        const indexArray = new Uint32Array(numSatellites * Satellites.NUM_TAIL_TRIANGLES * 3);
        trailGeometry.setIndex(new BufferAttribute(indexArray, 1));
        for (let i = 0; i < numSatellites; i++) {
            const offset = i * Satellites.NUM_TAIL_TRIANGLES * 3;
            const vertexOffset = i * Satellites.NUM_TAIL_VERTICES;
            for (let j = 0; j < Satellites.NUM_TAIL_TRIANGLES; j++) {
                indexArray[offset + j * 3] = vertexOffset + j;
                indexArray[offset + j * 3 + 1] = vertexOffset + j + 1;
                indexArray[offset + j * 3 + 2] = vertexOffset + j + 2;
            }
        }

        const trailMaterial = new SatelliteTrailMaterial({
            color: new Color3JS(0xffffff),
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

    public render(dateTime: DateTime, camera: Camera, guiData: GUIData): void {
        if (!this.spheres || !this.trails) {
            return;
        }
        const updateStats = this.iterationNum % Satellites.STATUS_UPDATE_FREQUENCY === 0;
        if (updateStats) {
            this.stats = {
                large: 0,
                medium: 0,
                small: 0,
                payload: 0,
                rocketBody: 0,
                debris: 0,
                starlink: 0,
                gps: 0,
                leo: 0,
                geo: 0,
                total: 0,
            };
        }

        const trailDuration = Duration.fromObject({ minutes: guiData.trailLength });

        if (!this.prevDateTime || Math.abs(dateTime.diff(this.prevDateTime).toMillis()) > trailDuration.toMillis()) {
            this.initializeTrail(dateTime, guiData);
        }

        (this.spheres.material as SatelliteSphereMaterial).baseSize = guiData.satelliteSize;

        const translationArray = this.spheres.geometry.attributes.translation.array as Float32Array;
        const positionArray = this.trails.geometry.attributes.position.array as Float32Array;
        const previousArray = this.trails.geometry.attributes.previous.array as Float32Array;

        const advanceTrail = dateTime.diff(this.trailTimestamps[this.trailTimestamps.length - 1]) >= Satellites.getTailDurationPerSegment(guiData);
        if (advanceTrail) {
            this.trailTimestamps.push(dateTime);
            if (this.trailTimestamps.length > Satellites.NUM_TAIL_TRIANGLES) {
                this.trailTimestamps.shift();
            }

            // PREVIOUS
            memcpy(positionArray, 0, previousArray, 0, positionArray.length);

            // POSITIONS
            memcpy(positionArray, 3, positionArray, 0, positionArray.length - 3);
        }

        (this.trails.material as SatelliteTrailMaterial).sunPosition = this.sun.getPosition();

        // For each satellite, get an updated position and save it to the translation array and update the trail
        const dateTimeMs = dateTime.toMillis();
        const l = positionArray.length / this.satellitePositionStates.length;
        for (let i = 0; i < this.satellitePositionStates.length; i++) {
            const index = i * 3;
            const satelliteData = this.satellitePositionStates[i];
            let positionVectorArray = Satellites.ZERO_VECTOR_ARRAY;
            let position = null;
            if (satelliteData.isInOrbit(dateTimeMs)) {
                position = satelliteData.getPosition(dateTimeMs);
                positionVectorArray = new Float32Array([position.x, position.y, position.z]);
            }

            if (
                updateStats &&
                this.stats !== undefined &&
                position !== null &&
                positionVectorArray[0] !== 0 &&
                positionVectorArray[1] !== 0 &&
                positionVectorArray[2] !== 0
            ) {
                this.stats.large += satelliteData.sizeName === 'LARGE' ? 1 : 0;
                this.stats.medium += satelliteData.sizeName === 'MEDIUM' ? 1 : 0;
                this.stats.small += satelliteData.sizeName === 'SMALL' ? 1 : 0;
                this.stats.payload += satelliteData.type === 'PAYLOAD' ? 1 : 0;
                this.stats.rocketBody += satelliteData.type === 'ROCKET BODY' ? 1 : 0;
                this.stats.debris += satelliteData.type === 'DEBRIS' ? 1 : 0;
                this.stats.starlink += satelliteData.isStarlinkSatellite ? 1 : 0;
                this.stats.gps += satelliteData.isGPS ? 1 : 0;
                const distanceKm = modelUnitsToKm(position.length());
                this.stats.leo += distanceKm - Earth.RADIUS_KM < 3000 ? 1 : 0;
                this.stats.geo += Math.abs(distanceKm - Earth.GEOSTATIONARY_KM) < 200 ? 1 : 0;
                this.stats.total += 1;
            }

            const offset = index * Satellites.NUM_TAIL_VERTICES;
            translationArray.set(positionVectorArray, index);
            positionArray.set(positionVectorArray, offset + l - 6);
            positionArray.set(positionVectorArray, offset + l - 3);
            // Technically, the first position also needs to be updated but since the width is 0, it doesn't actually make
            // a difference visually. Therefore, that step is cut out here.

            // On the first position calculation, initialize
            if (this.trailTimestamps.length === 1) {
                for (let j = 0; j < Satellites.NUM_TAIL_VERTICES; j++) {
                    positionArray.set(positionVectorArray, offset + 3 * j);
                    previousArray.set(positionVectorArray, offset + 3 * j);
                }
            }
        }

        this.spheres.geometry.attributes.translation.needsUpdate = true;
        this.trails.geometry.attributes.position.needsUpdate = true;
        this.trails.geometry.attributes.previous.needsUpdate = true;

        this.prevDateTime = dateTime;
        this.iterationNum++;
    }

    public async resetData(dateTime: DateTime, guiData: GUIData): Promise<void> {
        for (const satelliteState of this.satellitePositionStates) {
            satelliteState.reset();
        }
        this.initializeTrail(dateTime, guiData);
        this.prevDateTime = dateTime;
    }

    private initializeTrail(dateTime: DateTime, guiData: GUIData): void {
        if (!this.trails) {
            return;
        }
        this.trailTimestamps = [];
        const positionArray = this.trails.geometry.attributes.position.array as Float32Array;
        const previousArray = this.trails.geometry.attributes.previous.array as Float32Array;
        for (let i = 0; i < Satellites.NUM_TAIL_TRIANGLES; i++) {
            const stepDateTime = dateTime.minus(Satellites.getTailDurationPerSegment(guiData).toMillis() * (Satellites.NUM_TAIL_SEGMENTS - i));
            const stepDateTimeMs = stepDateTime.toMillis();
            this.trailTimestamps.push(stepDateTime);
            for (let j = 0; j < this.satellitePositionStates.length; j++) {
                const state = this.satellitePositionStates[j];
                const satelliteOffset = j * Satellites.NUM_TAIL_VERTICES * 3;
                let positionVectorArray = Satellites.ZERO_VECTOR_ARRAY;
                let position = null;
                if (state.isInOrbit(stepDateTimeMs)) {
                    position = state.getPosition(stepDateTimeMs);
                    positionVectorArray = new Float32Array([position.x, position.y, position.z]);
                }
                if (i === 0) {
                    positionArray.set(positionVectorArray, satelliteOffset);
                    previousArray.set(positionVectorArray, satelliteOffset);
                    previousArray.set(positionVectorArray, satelliteOffset + (i + 1) * 3);
                }
                positionArray.set(positionVectorArray, satelliteOffset + (i + 1) * 3);
                previousArray.set(positionVectorArray, satelliteOffset + (i + 2) * 3);
                if (i === Satellites.NUM_TAIL_TRIANGLES - 1) {
                    positionArray.set(positionVectorArray, satelliteOffset + (i + 2) * 3);
                }
            }
        }
    }

    private static getTailDurationPerSegment(guiData: GUIData): Duration {
        return Duration.fromMillis((guiData.trailLength * 60 * 1000) / Satellites.NUM_TAIL_SEGMENTS);
    }
}
