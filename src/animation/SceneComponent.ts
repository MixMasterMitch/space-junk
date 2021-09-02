import { GUIData } from './index';
import { Camera, Renderer, Scene } from 'three';

export default abstract class SceneComponent<T = Date> {
    abstract initialize(scene: Scene, renderer: Renderer): Promise<void>;

    abstract render(data: T, camera: Camera, guiData: GUIData): void;
}
