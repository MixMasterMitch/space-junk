import { Scene, PerspectiveCamera, WebGLRenderer, SphereGeometry, MeshPhongMaterial, Mesh, Color, DirectionalLight } from 'three';
import Earth from './animation/Earth';

const FOV = 70;

export const startAnimation = async (): Promise<void> => {
    // Create the scene
    const scene = new Scene();
    scene.background = new Color('#0e151e');

    // Setup the camera
    const camera = new PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 4;

    // Setup the sun
    const sun = new DirectionalLight(0xaaff33, 10);
    sun.position.set(-1, 1, 0).normalize();
    scene.add(sun);

    // Setup the renderer
    const renderer = new WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.className = 'fade-in animation-delayed';

    // Setup the earth
    const earth = new Earth();
    await earth.initialize(scene, renderer);
    // const geometry = new SphereGeometry(0.75, 32, 32);
    // const material = new MeshPhongMaterial({ color: 0xf0f5f6 });
    // const earth = new Mesh(geometry, material);
    // scene.add(earth);

    document.body.appendChild(renderer.domElement);

    const animate = function () {
        requestAnimationFrame(animate);

        // const t = Date.now() * 0.001;
        // sun.position.x = Math.sin(t);
        // sun.position.y = Math.cos(t);

        earth.render(new Date(), camera);

        renderer.render(scene, camera);
    };

    animate();
};
