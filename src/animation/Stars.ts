import SceneComponent from './SceneComponent';
import { BackSide, BoxGeometry, Camera, Color, MathUtils, Mesh, MeshBasicMaterial, Renderer, Scene, TextureLoader } from 'three';
import { SOLAR_SYSTEM_RADIUS } from '../constants';
import { GUIData } from './index';
import { DateTime } from 'luxon';

export default class Stars extends SceneComponent {
    // https://en.wikipedia.org/wiki/Galactic_plane
    private static GALACTIC_CENTER_RA_RAD = MathUtils.degToRad(-192.9);
    private static GALACTIC_CENTER_DEC_RAD = MathUtils.degToRad(-27.13);
    private static GALACTIC_CENTER_POSITION_ANGLE_RAD = MathUtils.degToRad(-31.4);

    private mesh?: Mesh;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const textureLoader = new TextureLoader();
        textureLoader.setPath('images/starsLowContrast/');
        const [px, nx, py, ny, pz, nz] = await Promise.all([
            textureLoader.loadAsync('px.jpg'),
            textureLoader.loadAsync('nx.jpg'),
            textureLoader.loadAsync('py.jpg'),
            textureLoader.loadAsync('ny.jpg'),
            textureLoader.loadAsync('pz.jpg'),
            textureLoader.loadAsync('nz.jpg'),
        ]);

        const cubeGeometry = new BoxGeometry(SOLAR_SYSTEM_RADIUS * 0.9, SOLAR_SYSTEM_RADIUS * 0.9, SOLAR_SYSTEM_RADIUS * 0.9);
        const materialArray = [
            new MeshBasicMaterial({ map: px, side: BackSide }),
            new MeshBasicMaterial({ map: nx, side: BackSide }),
            new MeshBasicMaterial({ map: py, side: BackSide }),
            new MeshBasicMaterial({ map: ny, side: BackSide }),
            new MeshBasicMaterial({ map: pz, side: BackSide }),
            new MeshBasicMaterial({ map: nz, side: BackSide }),
        ];
        this.mesh = new Mesh(cubeGeometry, materialArray);
        this.mesh.rotation.x = Stars.GALACTIC_CENTER_DEC_RAD;
        // Rotate an extra 180 degrees because the default texture center is positioned looking from the center of
        // the milky way, not towards it.
        this.mesh.rotation.y = Math.PI + Stars.GALACTIC_CENTER_RA_RAD;
        this.mesh.rotation.z = Stars.GALACTIC_CENTER_POSITION_ANGLE_RAD;
        scene.add(this.mesh);

        // Set the fallback background color for when the stars are disabled
        scene.background = new Color('#0e151e');
    }

    render(dateTime: DateTime, camera: Camera, guiData: GUIData): void {
        if (!this.mesh) {
            return;
        }
        this.mesh.visible = guiData.showStars;
    }
}
