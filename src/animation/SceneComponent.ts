import * as THREE from 'three';

export default abstract class SceneComponent {
    abstract initialize(scene: THREE.Scene, renderer: THREE.Renderer): Promise<void>;

    abstract render(date: Date, camera: THREE.Camera): void;
}
