import SceneComponent from './SceneComponent';
import {
    Camera,
    Mesh,
    Renderer,
    Scene,
    SphereGeometry,
    MeshPhongMaterial,
    LineBasicMaterial,
    BufferGeometry,
    MeshBasicMaterial,
    BufferAttribute,
    LineSegments,
    ShaderMaterial,
    AdditiveBlending,
    Color, Vector3, SphereBufferGeometry,
} from 'three';
import Earth from './Earth';
import { GUIData } from './index';
import { initializeSatellite, SatelliteData, satellitePosition } from '../orb';
import { log, propagate } from '../utils';
import { fetchTLEsAndParse } from '../io';
import { SatRec, twoline2satrec } from 'satellite.js';

export default class Satellite {
    private readonly timeOffset: number;
    private sphere?: Mesh;
    private satellite?: SatelliteData;
    // private iss?: SatRec;
    private trailVertices?: Float32Array;
    private trailVerticesCount?: number;
    private trailPrevPositionTimestamp?: Date;
    private trailMesh?: LineSegments;
    private pos?: Vector3;

    private static NUM_TRAIL_SEGMENTS = 1;
    private static NUM_TRAIL_VERTICES = Satellite.NUM_TRAIL_SEGMENTS + 1;
    private static TRAIL_COLOR = new Color(0xffffff);

    private static TRAIL_VERTEX_SHADER = `
precision mediump float;
precision mediump int;

attribute vec4 color;
varying vec4 vColor;

void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

    private static TRAIL_FRAGMENT_SHADER = `
precision mediump float;
precision mediump int;

varying vec4 vColor;

void main() {
    vec4 color = vec4( vColor );
    gl_FragColor = color;
}
`;
    public constructor(timeOffset: number) {
        super();
        this.timeOffset = timeOffset;
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // const geometry = new BoxGeometry(1, 5 * Earth.RADIUS, 5 * Earth.RADIUS);
        const geometry = new SphereBufferGeometry(Earth.RADIUS * 0.01);
        const material = new MeshPhongMaterial({ color: 0xffffff, emissive: 0xffc602, emissiveIntensity: 0.6 });
        this.sphere = new Mesh(geometry, material);
        this.sphere.receiveShadow = true;
        scene.add(this.sphere);

        const tle = {
            name: 'ISS',
            line1: `1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995`,
            line2: `2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581`,
        };
        this.satellite = initializeSatellite(tle);
        // this.iss = twoline2satrec(tle.line1, tle.line2);

        // Trail
        const trailGeometry = new BufferGeometry();
        const trailGeometryIndex = [];
        for (let i = 0; i < Satellite.NUM_TRAIL_SEGMENTS; i++) {
            trailGeometryIndex[i * 2] = i;
            trailGeometryIndex[i * 2 + 1] = i + 1;
        }
        trailGeometry.setIndex(trailGeometryIndex);
        this.trailVertices = new Float32Array(Satellite.NUM_TRAIL_VERTICES * 3);
        this.trailVerticesCount = 0;
        trailGeometry.setAttribute('position', new BufferAttribute(this.trailVertices, 3));
        const trailColors = new Float32Array(Satellite.NUM_TRAIL_VERTICES * 4);
        for (let i = 0; i < Satellite.NUM_TRAIL_VERTICES; i++) {
            const a = Math.pow((Satellite.NUM_TRAIL_SEGMENTS - i) / Satellite.NUM_TRAIL_SEGMENTS, 4);
            trailColors[i * 4] = Satellite.TRAIL_COLOR.r;
            trailColors[i * 4 + 1] = Satellite.TRAIL_COLOR.g;
            trailColors[i * 4 + 2] = Satellite.TRAIL_COLOR.b;
            trailColors[i * 4 + 3] = a;
        }
        trailGeometry.setAttribute('color', new BufferAttribute(trailColors, 4, true));
        const trailMaterial = new ShaderMaterial({
            vertexShader: Satellite.TRAIL_VERTEX_SHADER,
            fragmentShader: Satellite.TRAIL_FRAGMENT_SHADER,
            transparent: true,
            blending: AdditiveBlending,
            depthTest: true,
        });
        this.trailMesh = new LineSegments(trailGeometry, trailMaterial);
        scene.add(this.trailMesh);
    }

    public render(rawDate: Date, camera: Camera, guiData: GUIData): void {
        if (!this.sphere || !this.satellite || !this.trailVertices || !this.trailMesh || this.trailVerticesCount === undefined) {
            return;
        }
        const date = new Date(rawDate.getTime() + this.timeOffset);

        if (!this.pos) {
            const position2 = satellitePosition(date, this.satellite);
            this.pos = position2;
        }
        // const { position } = propagate(this.iss, date);
        // log(position);
        // log(position2);
        this.sphere.position.set(this.pos.x + Math.random(), this.pos.y + Math.random(), this.pos.z + Math.random());

        // const saveTrailPrevPosition =
        //     this.trailPrevPositionTimestamp === undefined || date.getTime() - this.trailPrevPositionTimestamp.getTime() > guiData.extraRotation * 30 * 1000;
        // if (saveTrailPrevPosition) {
        //     this.trailPrevPositionTimestamp = date;
        // }
        //
        // // Shift all vertices
        // if (saveTrailPrevPosition) {
        //     this.trailVertices.copyWithin(3, 0, Satellite.NUM_TRAIL_VERTICES * 3);
        // }
        //
        // // Add next vertex
        // this.trailVertices[0] = position.x;
        // this.trailVertices[1] = position.y;
        // this.trailVertices[2] = position.z;
        //
        // // Increment vertices count
        // if (saveTrailPrevPosition) {
        //     this.trailVerticesCount = Math.min(this.trailVerticesCount + 1, Satellite.NUM_TRAIL_VERTICES);
        //     this.trailMesh.geometry.setDrawRange(0, Math.max(this.trailVerticesCount - 1, 0));
        // }
        //
        // this.trailMesh.geometry.attributes.position.needsUpdate = true;
    }
}
