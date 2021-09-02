import SceneComponent from './SceneComponent';
import { Camera, Renderer, Scene, Line, LineBasicMaterial, BufferAttribute, BufferGeometry, Vector3, ColorRepresentation } from 'three';
import { GUIData } from './index';

interface TraceLineData {
    start: Vector3;
    end: Vector3;
}

export default class TraceLine extends SceneComponent<TraceLineData> {
    private readonly color: ColorRepresentation;
    private positions?: Float32Array;
    private line?: Line;

    public constructor(color: ColorRepresentation) {
        super();
        this.color = color;
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const lineGeometry = new BufferGeometry();
        this.positions = new Float32Array(2 * 3); // 3 vertices per point
        lineGeometry.setAttribute('position', new BufferAttribute(this.positions, 3));
        const drawCount = 2; // draw the first 2 points, only
        lineGeometry.setDrawRange(0, drawCount);
        const lineMaterial = new LineBasicMaterial({ color: this.color });
        this.line = new Line(lineGeometry, lineMaterial);
        scene.add(this.line);
    }

    public render({ start, end }: TraceLineData, camera: Camera, guiData: GUIData): void {
        if (!this.positions || !this.line) {
            return;
        }

        this.line.visible = guiData.showTraceLines;
        if (!guiData.showTraceLines) {
            return;
        }
        this.positions[0] = start.x;
        this.positions[1] = start.y;
        this.positions[2] = start.z;
        this.positions[3] = end.x;
        this.positions[4] = end.y;
        this.positions[5] = end.z;
        this.line.geometry.attributes.position.needsUpdate = true;
    }
}
