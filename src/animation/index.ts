import { Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap } from 'three';
import Earth from './Earth';
import { J2000_EPOCH, SOLAR_SYSTEM_RADIUS } from '../constants';
import * as THREE from 'three';
import Sun from './Sun';
import Satellite from './Satellite';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stars from './Stars';
import dat from 'dat.gui';

const FOV = 70;

export interface GUIData {
    autoRotate: boolean;
    showAxes: boolean;
    showStars: boolean;
    rotationSpeed: number;
}

export const startAnimation = async (): Promise<void> => {
    // Initialize GUI data
    const guiData: GUIData = getLocalGUIData();

    // Create the scene
    const scene = new Scene();

    // Setup the camera
    const camera = new PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, SOLAR_SYSTEM_RADIUS);
    // const eyeVector = new THREE.Vector3(Earth.RADIUS * 1.9, Earth.RADIUS, 0);
    // const eyeVector = new THREE.Vector3(0, 0, Earth.RADIUS * 1.9);
    const eyeVector = new THREE.Vector3(0, Earth.RADIUS * 2, -Earth.RADIUS * 3);
    camera.position.set(eyeVector.x, eyeVector.y, eyeVector.z);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Setup the renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    await stars.initialize(scene, renderer);

    // Setup the sun
    const sun = new Sun();
    await sun.initialize(scene, renderer);

    // Setup the earth
    const earth = new Earth(sun);
    await earth.initialize(scene, renderer);

    // Setup the satellites
    const satellite = new Satellite();
    await satellite.initialize(scene, renderer);

    document.body.appendChild(renderer.domElement);

    // Setup the GUI
    const gui = new dat.GUI({ closeOnTop: true });
    const saveLocalGUIData = (): void => {
        localStorage.setItem('gui', JSON.stringify(guiData));
    };
    gui.add(guiData, 'autoRotate').onChange(saveLocalGUIData);
    gui.add(guiData, 'showAxes').onChange(saveLocalGUIData);
    gui.add(guiData, 'showStars').onChange(saveLocalGUIData);
    gui.add(guiData, 'rotationSpeed', 1, 24 * 60 * 1000).onChange(saveLocalGUIData);

    let date = J2000_EPOCH;
    const animate = () => {
        requestAnimationFrame(animate);

        controls.autoRotate = guiData.autoRotate;
        controls.update();

        date = new Date(date.getTime() + guiData.rotationSpeed);
        // console.log(date);

        stars.render(date, camera, guiData);
        sun.render(date, camera, guiData);
        earth.render(date, camera, guiData);
        satellite.render(date, camera, guiData);

        renderer.render(scene, camera);
    };

    animate();
};

const getLocalGUIData = (): GUIData => {
    const localData = localStorage.getItem('gui');
    if (localData !== null) {
        return JSON.parse(localData) as GUIData;
    }
    return { autoRotate: true, showAxes: false, showStars: true, rotationSpeed: 10000 };
};
