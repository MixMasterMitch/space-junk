import SceneComponent from './SceneComponent';
import { Camera, Mesh, Renderer, Scene, SphereGeometry, MeshPhongMaterial, TextureLoader, Vector3, AxesHelper, Quaternion } from 'three';
import { GUIData } from './index';
import { getJ200PeriodPercentage, kmToModelUnits, percentageToRadians } from '../utils';
import TraceLine from './TraceLine';
import { moonPosition } from '../orb';

export default class Moon extends SceneComponent {
    private static RADIUS_KM = 1_737;
    private static RADIUS = kmToModelUnits(Moon.RADIUS_KM);
    private static DISTANCE_FROM_EARTH_KM = 384_400;
    private static DISTANCE_FROM_EARTH = kmToModelUnits(Moon.DISTANCE_FROM_EARTH_KM);
    private static SIDERIAL_PERIOD_MS = 27.322 * 24 * 60 * 60 * 1000;
    private static J2000_ROTATION_RAD = 2.2; // Derived visually

    // Angle between rotational axis and orbital axis.
    // See: https://en.wikipedia.org/wiki/Axial_tilt
    private static AXIAL_TILT_RAD = 0.409044;
    // Inclination of the lunar orbital plane
    // See: https://en.wikipedia.org/wiki/Orbit_of_the_Moon
    private static INCLINATION_RAD = -0.089884;

    private sphere?: Mesh;
    private axesHelper?: AxesHelper;
    private traceLine?: TraceLine;
    private camera: Camera;

    constructor(camera: Camera) {
        super();
        this.camera = camera;
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const textureLoader = new TextureLoader();
        const [moonMapTexture, moonBumpMapTexture] = await Promise.all([
            textureLoader.loadAsync('images/moon.jpg'),
            textureLoader.loadAsync('images/moonBump.jpg'),
        ]);

        const geometry = new SphereGeometry(Moon.RADIUS, 100, 100);
        const material = new MeshPhongMaterial({
            map: moonMapTexture,
            bumpMap: moonBumpMapTexture,
            bumpScale: 0.002,
        });
        this.sphere = new Mesh(geometry, material);
        this.sphere.receiveShadow = true;
        scene.add(this.sphere);

        this.axesHelper = new AxesHelper(Moon.RADIUS * 1.5);
        this.sphere.add(this.axesHelper);

        this.traceLine = new TraceLine(0xffffff);
        await this.traceLine.initialize(scene, renderer);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.sphere || !this.axesHelper || !this.traceLine) {
            return;
        }
        const position = moonPosition(date);
        this.sphere.position.copy(position);
        const rotation = percentageToRadians(this.getJ200SiderealPeriodPercentage(date)) + Moon.J2000_ROTATION_RAD;
        const rotationQuaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0).normalize(), rotation);
        const axialTiltQuaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 0, -1).normalize(), Moon.AXIAL_TILT_RAD + Moon.INCLINATION_RAD);
        this.sphere.rotation.setFromQuaternion(axialTiltQuaternion.multiply(rotationQuaternion));

        this.axesHelper.visible = guiData.showAxes;
        this.traceLine.render({ start: new Vector3(0, 0, 0), end: position }, camera, guiData);
    }

    /**
     * Determines what percentage of the way around the moon's rotation it is at a given date. Based on the J200 epoch.
     */
    private getJ200SiderealPeriodPercentage = (date: Date): number => {
        return getJ200PeriodPercentage(date, Moon.SIDERIAL_PERIOD_MS);
    };
}