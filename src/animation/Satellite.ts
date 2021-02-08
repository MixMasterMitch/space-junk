import SceneComponent from './SceneComponent';
import { Camera, Mesh, Renderer, Scene, SphereGeometry, MeshPhongMaterial } from 'three';
import Earth from './Earth';

export default class Satellite extends SceneComponent {
    private sphere?: Mesh;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // const geometry = new BoxGeometry(1, 5 * Earth.RADIUS, 5 * Earth.RADIUS);
        const geometry = new SphereGeometry(Earth.RADIUS * 0.01);
        const material = new MeshPhongMaterial({ color: 0xffffff, emissive: 0xffc602, emissiveIntensity: 0.6 });
        this.sphere = new Mesh(geometry, material);
        this.sphere.receiveShadow = true;
        scene.add(this.sphere);
    }

    public render(date: Date, camera: Camera): void {
        if (!this.sphere) {
            return;
        }

        this.sphere.position.set(-Earth.RADIUS * 2, 0, 0);
    }
}
