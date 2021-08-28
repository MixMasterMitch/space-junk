import * as THREE from 'three';
import { GUIData } from './index';

export default abstract class SceneComponent {
    abstract initialize(scene: THREE.Scene, renderer: THREE.Renderer): Promise<void>;

    abstract render(date: Date, camera: THREE.Camera, guiData: GUIData): void;
}
