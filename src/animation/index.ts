import { Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, Vector3 } from 'three';
import Earth from './Earth';
import { SOLAR_SYSTEM_RADIUS } from '../constants';
import Sun from './Sun';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stars from './Stars';
import dat from 'dat.gui';
import Moon from './Moon';
import Stats, { Panel } from 'stats.js';
import SceneComponent from './SceneComponent';
import Satellites from './Satellites';
import { getDayOfYear, log } from '../utils';
import SatellitesData from '../SatellitesData';

export interface GUIData {
    autoRotate: boolean;
    showStats: boolean;
    showAxes: boolean;
    showShadowHelper: boolean;
    showTraceLines: boolean;
    showStars: boolean;
    recordFrames: boolean;
    fov: number;
    speed: number; // Multiplier on real time
    tailLength: number; // In minutes
    pixelRatio: number;
}

export const startAnimation = async (satellitesData: SatellitesData): Promise<void> => {
    // Initialize GUI data
    const guiData: GUIData = getLocalGUIData();

    // Create the scene
    const scene = new Scene();
    const sceneComponents: SceneComponent[] = [];

    // Setup the camera
    const camera = new PerspectiveCamera(guiData.fov, window.innerWidth / window.innerHeight, 0.1, SOLAR_SYSTEM_RADIUS);
    // const eyeVector = new Vector3(Earth.RADIUS * 1.9, Earth.RADIUS, 0);
    // const eyeVector = new Vector3(0, 0, Earth.RADIUS * 1.9);
    const eyeVector = new Vector3(0, Earth.RADIUS * 2, -Earth.RADIUS * 3);
    camera.position.set(eyeVector.x, eyeVector.y, eyeVector.z);
    camera.lookAt(new Vector3(0, 0, 0));
    // camera.position.set(0, 0, 0);

    // Setup the renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(guiData.pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.domElement.className = 'fade-in animation-delayed';

    // Setup the controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotateSpeed = 0.1;
    controls.minDistance = Earth.RADIUS * 1.5;
    controls.maxDistance = Earth.RADIUS * 100;
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
    const panel = stats.addPanel(new Panel('Sats', '#0f0', '#020'));
    document.body.appendChild(stats.dom);

    // Setup the GUI
    const gui = new dat.GUI({ closeOnTop: true });
    const saveLocalGUIData = (): void => {
        localStorage.setItem('gui', JSON.stringify(guiData));
    };
    gui.add(guiData, 'autoRotate').onChange(saveLocalGUIData);
    gui.add(guiData, 'showStats').onChange(saveLocalGUIData);
    gui.add(guiData, 'showAxes').onChange(saveLocalGUIData);
    gui.add(guiData, 'showShadowHelper').onChange(saveLocalGUIData);
    gui.add(guiData, 'showTraceLines').onChange(saveLocalGUIData);
    gui.add(guiData, 'showStars').onChange(saveLocalGUIData);
    gui.add(guiData, 'recordFrames').onChange(saveLocalGUIData);
    gui.add(guiData, 'fov', 1, 100).onChange(saveLocalGUIData);
    gui.add(guiData, 'speed', 1, 100).onChange(saveLocalGUIData);
    gui.add(guiData, 'tailLength', 0, 20).onChange(saveLocalGUIData);
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

    // let date = J2000_EPOCH;
    let date = new Date('2021-09-02T19:46-07:00');
    // let date = new Date('2021-09-22T17:21-00:00');
    // let date = new Date('2021-03-20T09:36-00:00');
    // let date = new Date('1970-09-22T17:20-00:00');
    // let date = new Date();
    await satellitesData.loadTLEs(date);
    let lastFrameTimestamp: number;
    let frameNumber = 0;
    const animate = async (frameTimestamp: number) => {
        frameNumber++;
        requestAnimationFrame(animate);

        if (frameNumber <= 2) {
            lastFrameTimestamp = frameTimestamp;
        }

        if (renderer.getPixelRatio() !== guiData.pixelRatio || recording !== guiData.recordFrames) {
            recording = guiData.recordFrames;
            updateRendererSize();
        }

        const frameTimeDiff = recording ? 16 : frameTimestamp - lastFrameTimestamp;
        lastFrameTimestamp = frameTimestamp;
        date = new Date(date.getTime() + frameTimeDiff * guiData.speed);
        // log(date);

        stats.begin();
        stats.dom.hidden = !guiData.showStats;
        panel.update(getDayOfYear(date), 366);

        camera.fov = guiData.fov;
        camera.updateProjectionMatrix();
        controls.autoRotate = guiData.autoRotate;
        controls.update();

        stars.render(date, camera, guiData);
        sun.render(date, camera, guiData);
        earth.render(date, camera, guiData);
        moon.render(date, camera, guiData);
        satellites.render(date, camera, guiData);

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
        satellitesData.purge(date);
        satellitesData.loadTLEs(date);
    }, 50);
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
    autoRotate: true,
    showStats: true,
    showAxes: false,
    showShadowHelper: false,
    showTraceLines: false,
    showStars: true,
    recordFrames: true,
    fov: 70,
    speed: 60,
    tailLength: 3,
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
