import SceneComponent from './SceneComponent';
import { BackSide, Camera, Color, MathUtils, Mesh, Renderer, Scene } from 'three';
import * as THREE from 'three';
import { SOLAR_SYSTEM_RADIUS } from '../constants';
import { GUIData } from './index';

export default class Stars extends SceneComponent {
    // https://en.wikipedia.org/wiki/Galactic_plane
    private static GALACTIC_CENTER_RA_RAD = MathUtils.degToRad(-192.9);
    private static GALACTIC_CENTER_DEC_RAD = MathUtils.degToRad(-27.13);
    private static GALACTIC_CENTER_POSITION_ANGLE_RAD = MathUtils.degToRad(-31.4);

    private mesh?: Mesh;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const cubeGeometry = new THREE.BoxGeometry(SOLAR_SYSTEM_RADIUS * 0.9, SOLAR_SYSTEM_RADIUS * 0.9, SOLAR_SYSTEM_RADIUS * 0.9);
        const loader = new THREE.TextureLoader();
        loader.setPath('images/stars/');
        const materialArray = [
            new THREE.MeshBasicMaterial({ map: loader.load('px.jpg'), side: BackSide }),
            new THREE.MeshBasicMaterial({ map: loader.load('nx.jpg'), side: BackSide }),
            new THREE.MeshBasicMaterial({ map: loader.load('py.jpg'), side: BackSide }),
            new THREE.MeshBasicMaterial({ map: loader.load('ny.jpg'), side: BackSide }),
            new THREE.MeshBasicMaterial({ map: loader.load('pz.jpg'), side: BackSide }),
            new THREE.MeshBasicMaterial({ map: loader.load('nz.jpg'), side: BackSide }),
        ];
        this.mesh = new THREE.Mesh(cubeGeometry, materialArray);
        this.mesh.rotation.x = Stars.GALACTIC_CENTER_DEC_RAD;
        // Rotate an extra 180 degrees because the default texture center is positioned looking from the center of
        // the milky way, not towards it.
        this.mesh.rotation.y = Math.PI + Stars.GALACTIC_CENTER_RA_RAD;
        this.mesh.rotation.z = Stars.GALACTIC_CENTER_POSITION_ANGLE_RAD;
        scene.add(this.mesh);

        // Set the fallback background color for when the stars are disabled
        scene.background = new Color('#0e151e');
    }

    render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.mesh) {
            return;
        }
        this.mesh.visible = guiData.showStars;
    }
}
