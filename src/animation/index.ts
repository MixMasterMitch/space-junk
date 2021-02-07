import { Scene, PerspectiveCamera, WebGLRenderer, Color } from 'three';
import Earth from './Earth';
import { J2000_EPOCH } from '../constants';
import * as THREE from 'three';
import Sun from './Sun';

const FOV = 70;

export const startAnimation = async (): Promise<void> => {
    // Create the scene
    const scene = new Scene();
    scene.background = new Color('#0e151e');

    // Setup the camera
    const camera = new PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 50000);
    const eyeVector = new THREE.Vector3(Earth.RADIUS * 1.9, Earth.RADIUS, 0);
    camera.position.set(eyeVector.x, eyeVector.y, eyeVector.z);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Setup the renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.className = 'fade-in animation-delayed';

    // Setup the sun
    const sun = new Sun();
    await sun.initialize(scene, renderer);

    // Setup the earth
    const earth = new Earth(sun);
    await earth.initialize(scene, renderer);

    document.body.appendChild(renderer.domElement);

    let date = J2000_EPOCH;
    const animate = function () {
        requestAnimationFrame(animate);

        date = new Date(date.getTime() + 30 * 60 * 1000);
        console.log(date);

        sun.render(date, camera);
        earth.render(date, camera);

        renderer.render(scene, camera);
    };

    animate();
};