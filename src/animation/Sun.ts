import SceneComponent from './SceneComponent';
import {
    AmbientLight,
    Camera,
    CameraHelper,
    Color,
    DirectionalLight,
    Mesh,
    MeshPhongMaterial,
    Renderer,
    Scene,
    SphereGeometry,
    TextureLoader,
    Vector3,
} from 'three';
import { kmToModelUnits, log } from '../utils';
import Earth from './Earth';
import { GUIData } from './index';
import TraceLine from './TraceLine';
import { sunPosition as getSunPosition } from '../orb';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare';

export default class Sun extends SceneComponent {
    private static RADIUS_KM = 696_340;
    private static RADIUS = kmToModelUnits(Sun.RADIUS_KM);

    private sphere?: Mesh;
    private lensflare?: Lensflare;
    private lensflareElements?: { element: LensflareElement; baseSize: number }[];
    private primaryDirectionalLight?: DirectionalLight;
    private secondaryDirectionalLight?: DirectionalLight;
    private backgroundLight?: AmbientLight;
    private shadowHelper?: CameraHelper;
    private traceLine?: TraceLine;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const textureLoader = new TextureLoader();
        const [lensflareTexture0, lensflareTexture1, lensflareTexture2, lensflareTexture3] = await Promise.all([
            textureLoader.loadAsync('images/lensflare/lensflare0.png'),
            textureLoader.loadAsync('images/lensflare/lensflare1.png'),
            textureLoader.loadAsync('images/lensflare/lensflare2.png'),
            textureLoader.loadAsync('images/lensflare/lensflare3.png'),
        ]);

        const geometry = new SphereGeometry(Sun.RADIUS, 100, 100);
        const material = new MeshPhongMaterial({
            color: 0xffffdd,
            emissive: 0xffffdd,
        });
        this.sphere = new Mesh(geometry, material);
        this.sphere.receiveShadow = true;
        scene.add(this.sphere);

        const sunColor = new Color(0xffdd88);
        const lensflare = new Lensflare();
        this.lensflareElements = [];
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture0, 0, 0, sunColor), baseSize: 100 });
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture1, 0, 0, sunColor), baseSize: 200 });
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture2, 0, 0, sunColor), baseSize: 300 });
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture3, 0, 0.03, sunColor), baseSize: 25 });
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture3, 0, 0.05, sunColor), baseSize: 40 });
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture3, 0, 0.1, sunColor), baseSize: 55 });
        this.lensflareElements.push({ element: new LensflareElement(lensflareTexture3, 0, 0.13, sunColor), baseSize: 40 });

        this.lensflareElements.forEach(({ element }) => {
            lensflare.addElement(element);
        });
        this.lensflare = lensflare;
        scene.add(this.lensflare);

        this.primaryDirectionalLight = new DirectionalLight(0xffffff, 0.8);
        this.primaryDirectionalLight.position.set(0, 0, 0);
        this.primaryDirectionalLight.castShadow = true;
        this.primaryDirectionalLight.shadow.mapSize.width = 1024;
        this.primaryDirectionalLight.shadow.mapSize.height = 1024;
        this.primaryDirectionalLight.shadow.camera.top = Earth.RADIUS * 2;
        this.primaryDirectionalLight.shadow.camera.bottom = -Earth.RADIUS * 2;
        this.primaryDirectionalLight.shadow.camera.left = -Earth.RADIUS * 2;
        this.primaryDirectionalLight.shadow.camera.right = Earth.RADIUS * 2;
        this.primaryDirectionalLight.shadow.camera.near = -Earth.RADIUS * 2;
        this.primaryDirectionalLight.shadow.camera.far = Earth.GEOSTATIONARY * 1.5;
        scene.add(this.primaryDirectionalLight);

        this.secondaryDirectionalLight = new DirectionalLight(0xffffff, 0.2);
        this.secondaryDirectionalLight.position.set(0, 0, 0);
        this.secondaryDirectionalLight.castShadow = false;
        scene.add(this.secondaryDirectionalLight);

        this.backgroundLight = new AmbientLight(0xffffff, 0.2);
        scene.add(this.backgroundLight);

        this.shadowHelper = new CameraHelper(this.primaryDirectionalLight.shadow.camera);
        scene.add(this.shadowHelper);

        this.traceLine = new TraceLine(0xffffff);
        await this.traceLine.initialize(scene, renderer);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (
            !this.sphere ||
            !this.lensflare ||
            !this.lensflareElements ||
            !this.primaryDirectionalLight ||
            !this.secondaryDirectionalLight ||
            !this.shadowHelper ||
            !this.traceLine
        ) {
            return;
        }

        getSunPosition(date, this.sphere.position);
        this.sphere.position.copy(this.sphere.position);
        this.lensflare.position.copy(this.sphere.position).multiplyScalar(0.9); // Make sure the lensflare is not blocked by the sun sphere
        this.primaryDirectionalLight.position.copy(this.sphere.position);
        this.secondaryDirectionalLight.position.copy(this.sphere.position);

        this.shadowHelper.visible = guiData.showShadowHelper;
        this.traceLine.render({ start: new Vector3(0, 0, 0), end: this.sphere.position }, camera, guiData);

        this.lensflareElements.forEach(({ element, baseSize }) => {
            element.size = (100 / guiData.fov) * baseSize;
        });
    }

    public getPosition(): Vector3 {
        if (!this.primaryDirectionalLight) {
            return null as unknown as Vector3;
        }
        return this.primaryDirectionalLight.position.normalize().clone();
    }
}
