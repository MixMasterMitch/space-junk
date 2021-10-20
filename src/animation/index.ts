import { Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, Vector3 } from 'three';
import Earth from './Earth';
import { SOLAR_SYSTEM_RADIUS } from '../constants';
import Sun from './Sun';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stars from './Stars';
import dat from 'dat.gui';
import Moon from './Moon';
import Stats from 'stats.js';
import SceneComponent from './SceneComponent';
import Satellites from './Satellites';
import { log } from '../utils';
import SatellitesData from '../SatellitesData';
import { EventEmitter } from 'tsee';
import { UIEvents } from '../ui';
import { DateTime, Duration } from 'luxon';

export interface GUIData {
    pause: boolean;
    reset: boolean;
    showStats: boolean;
    showAxes: boolean;
    showShadowHelper: boolean;
    showTraceLines: boolean;
    showStars: boolean;
    recordFrames: boolean;
    rotationSpeed: number;
    fov: number;
    speed: number; // Multiplier on real time
    tailLength: number; // In minutes
    satelliteSize: number;
    pixelRatio: number;
}

export const startAnimation = async (satellitesData: SatellitesData, uiEventBus: EventEmitter<UIEvents>): Promise<WebGLRenderer> => {
    // Initialize GUI data
    const guiData: GUIData = getLocalGUIData();

    // Create the scene
    const scene = new Scene();
    const sceneComponents: SceneComponent[] = [];

    // Setup the camera
    const camera = new PerspectiveCamera(guiData.fov, window.innerWidth / window.innerHeight, 0.1, SOLAR_SYSTEM_RADIUS);
    // let cameraPosition = new Vector3(Earth.RADIUS * 1.9, Earth.RADIUS, 0);
    // let cameraPosition = new Vector3(0, 0, Earth.RADIUS * 1.9);
    let cameraPosition = new Vector3(0, Earth.RADIUS * 2, -Earth.RADIUS * 3);
    const storedCameraPosition = vectorFromString(localStorage.getItem('cameraPosition'));
    if (storedCameraPosition !== null && !guiData.reset) {
        cameraPosition = storedCameraPosition;
    }
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    // Setup the renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(guiData.pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.domElement.className = 'fade-in animation-delayed hide-cursor';

    // Setup the controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.minDistance = Earth.RADIUS * 1.5;
    controls.maxDistance = Earth.RADIUS * 100;
    let cameraTarget = new Vector3(0, 0, 0);
    const storedCameraTarget = vectorFromString(localStorage.getItem('cameraTarget'));
    if (storedCameraTarget !== null && !guiData.reset) {
        cameraTarget = storedCameraTarget;
    }
    controls.target = cameraTarget;
    controls.update();

    // Setup the stars
    const stars = new Stars();
    sceneComponents.push(stars);

    // Setup the sun
    const sun = new Sun();
    sceneComponents.push(sun);

    // Setup the earth
    const earth = new Earth(sun);
    sceneComponents.push(earth);

    // Setup the moon
    const moon = new Moon(camera);
    sceneComponents.push(moon);

    // Setup the satellites
    const satellites = new Satellites(sun, satellitesData);
    sceneComponents.push(satellites);

    await Promise.all(sceneComponents.map((sc) => sc.initialize(scene, renderer)));
    document.body.appendChild(renderer.domElement);

    // Initialize FPS meter
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    // Setup the GUI
    const gui = new dat.GUI({ closeOnTop: true });
    const saveLocalGUIData = (): void => {
        localStorage.setItem('gui', JSON.stringify(guiData));
    };
    gui.add(guiData, 'pause').onChange(saveLocalGUIData);
    gui.add(guiData, 'reset').onChange(saveLocalGUIData);
    gui.add(guiData, 'showStats').onChange(saveLocalGUIData);
    gui.add(guiData, 'showAxes').onChange(saveLocalGUIData);
    gui.add(guiData, 'showShadowHelper').onChange(saveLocalGUIData);
    gui.add(guiData, 'showTraceLines').onChange(saveLocalGUIData);
    gui.add(guiData, 'showStars').onChange(saveLocalGUIData);
    gui.add(guiData, 'recordFrames').onChange(saveLocalGUIData);
    gui.add(guiData, 'rotationSpeed', 0, 1).onChange(saveLocalGUIData);
    gui.add(guiData, 'fov', 1, 100).onChange(saveLocalGUIData);
    gui.add(guiData, 'speed', 1, 100).onChange(saveLocalGUIData);
    gui.add(guiData, 'tailLength', 0, 20).onChange(saveLocalGUIData);
    gui.add(guiData, 'satelliteSize', 0, 2).onChange(saveLocalGUIData);
    gui.add(guiData, 'pixelRatio', 0.5, 2).onChange(saveLocalGUIData);

    // Setup resize handler
    let recording = guiData.recordFrames;
    const updateRendererSize = () => {
        let width = window.innerWidth;
        let height = window.innerHeight;
        let pixelRatio = guiData.pixelRatio;
        if (recording) {
            width = 3840;
            height = 2160;
            pixelRatio = 1;
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        renderer.setPixelRatio(pixelRatio);
    };
    window.addEventListener('resize', updateRendererSize, false);

    // let dateTime = J2000_EPOCH;
    let dateTime = DateTime.fromISO('2021-09-02T19:46-07:00');
    // let dateTime = DateTime.now();
    const storedDate = localStorage.getItem('date');
    if (storedDate !== null && !guiData.reset) {
        dateTime = DateTime.fromMillis(JSON.parse(storedDate));
    }
    await satellitesData.loadTLEs(dateTime);
    let lastFrameTimestamp: number;
    let frameNumber = 0;
    const animate = async (frameTimestamp: number) => {
        requestAnimationFrame(animate);

        if (guiData.pause) {
            return;
        }

        frameNumber++;
        if (frameNumber <= 2) {
            lastFrameTimestamp = frameTimestamp;
        }

        if (renderer.getPixelRatio() !== guiData.pixelRatio || recording !== guiData.recordFrames) {
            recording = guiData.recordFrames;
            updateRendererSize();
        }

        const frameTimeDiff = recording ? 16 : frameTimestamp - lastFrameTimestamp;
        lastFrameTimestamp = frameTimestamp;
        dateTime = dateTime.plus(Duration.fromMillis(frameTimeDiff * guiData.speed));
        // uiEventBus.emit('dateTick', dateTime);

        stats.begin();
        stats.dom.hidden = !guiData.showStats;

        camera.fov = guiData.fov;
        camera.updateProjectionMatrix();
        controls.autoRotateSpeed = guiData.rotationSpeed;
        controls.update();

        stars.render(dateTime, camera, guiData);
        sun.render(dateTime, camera, guiData);
        earth.render(dateTime, camera, guiData);
        moon.render(dateTime, camera, guiData);
        satellites.render(dateTime, camera, guiData);

        renderer.render(scene, camera);
        if (recording) {
            const imageBase64 = renderer.domElement.toDataURL('image/png').split(',')[1];
            const response = await fetch('http://localhost:3002/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'image/png',
                },
                body: base64ToArrayBuffer(imageBase64),
            });
            log(await response.json());
        }

        stats.end();
    };
    requestAnimationFrame(animate);

    setInterval(() => {
        satellitesData.purge(dateTime);
        satellitesData.loadTLEs(dateTime);
    }, 50);

    window.addEventListener('unload', function () {
        localStorage.setItem('cameraPosition', vectorToString(camera.position));
        localStorage.setItem('cameraTarget', vectorToString(controls.target));
        localStorage.setItem('date', JSON.stringify(dateTime.toMillis()));
    });

    return renderer;
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

const DEFAULT_GUI_DATA: GUIData = {
    pause: false,
    reset: false,
    showStats: true,
    showAxes: false,
    showShadowHelper: false,
    showTraceLines: false,
    showStars: true,
    recordFrames: true,
    rotationSpeed: 0.1,
    fov: 70,
    speed: 60,
    tailLength: 3,
    satelliteSize: 1,
    pixelRatio: window.devicePixelRatio,
};

const getLocalGUIData = (): GUIData => {
    const localDataString = localStorage.getItem('gui');
    let localData: GUIData = {} as GUIData;
    if (localDataString !== null) {
        localData = JSON.parse(localDataString) as GUIData;
    }
    return { ...DEFAULT_GUI_DATA, ...localData };
};

function vectorToString(v: Vector3): string {
    return JSON.stringify({ x: v.x, y: v.y, z: v.z });
}

function vectorFromString(s: string | null): Vector3 | null {
    if (s === null) {
        return null;
    }
    const parsed = JSON.parse(s);
    return new Vector3(parsed.x, parsed.y, parsed.z);
}
