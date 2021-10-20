import { GUIData } from './index';
import { Camera, Renderer, Scene } from 'three';
import { DateTime } from 'luxon';

export default abstract class SceneComponent<T = DateTime> {
    abstract initialize(scene: Scene, renderer: Renderer): Promise<void>;

    abstract render(data: T, camera: Camera, guiData: GUIData): void;
}
