import { getJ200PeriodPercentage, kmToModelUnits } from '../utils';
import SceneComponent from './SceneComponent';
import Sun from './Sun';
import {
    AxesHelper,
    BackSide,
    Camera,
    Mesh,
    RepeatWrapping,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    TextureLoader,
    Vector2,
    Vector3,
    WebGLRenderer,
} from 'three';
import { GUIData } from './index';
import { DateTime, Duration } from 'luxon';
import EarthGroundVertexShader from './EarthGroundVertexShader';
import EarthGroundFragmentShader from './EarthGroundFragmentShader';
import EarthSkyVertexShader from './EarthSkyVertexShader';
import EarthSkyFragmentShader from './EarthSkyFragmentShader';

export default class Earth extends SceneComponent {
    public static GEOSTATIONARY_KM = 42_164;
    public static GEOSTATIONARY = kmToModelUnits(Earth.GEOSTATIONARY_KM);
    public static RADIUS_KM = 6_371;
    public static RADIUS = kmToModelUnits(Earth.RADIUS_KM);
    public static DISTANCE_FROM_SUN_KM = 149_597_870;
    public static DISTANCE_FROM_SUN = kmToModelUnits(Earth.DISTANCE_FROM_SUN_KM);

    // Angle between rotational axis and orbital axis.
    // See: https://en.wikipedia.org/wiki/Axial_tilt
    public static AXIAL_TILT_RAD = 0.409044;

    // Amount of time for Earth to revolve around its axis
    // See: https://en.wikipedia.org/wiki/Sidereal_time
    public static SIDEREAL_DAY = Duration.fromMillis(86_164_091);

    // Amount of time for Earth to revolve around the sun with respect to the stars.
    // See: https://en.wikipedia.org/wiki/Sidereal_year
    public static SIDEREAL_YEAR = Duration.fromMillis(31_558_149_764);

    // The Earth texture needs to be rotated an extra bit to properly align with the J2000 coordinate system.
    // This value was derived visually.
    public static TEXTURE_ROTATION_PERCENTAGE = 2.8 / 100;

    private static ATMOSPHERE = {
        Kr: 0.0015,
        Km: 0.001,
        ESun: 20.0,
        g: -0.95,
        innerRadius: Earth.RADIUS,
        outerRadius: Earth.RADIUS * 1.025,
        wavelength: [0.65, 0.57, 0.475],
        scaleDepth: 0.25,
        mieScaleDepth: 0.1,
    };

    private ground?: { geometry: SphereGeometry; material: ShaderMaterial; mesh: Mesh };
    private sky?: { geometry: SphereGeometry; material: ShaderMaterial; mesh: Mesh };
    private axesHelper?: AxesHelper;

    private sun: Sun;

    constructor(sun: Sun) {
        super();
        this.sun = sun;
    }

    public async initialize(scene: Scene, renderer: WebGLRenderer): Promise<void> {
        const textureLoader = new TextureLoader();
        const [groundDayTexture, groundNightTexture, groundCloudsTexture] = await Promise.all([
            await textureLoader.loadAsync('/images/earthDay.jpg'),
            await textureLoader.loadAsync('/images/earthNight.jpg'),
            await textureLoader.loadAsync('/images/earthClouds.jpg'),
        ]);

        const anisotropy = renderer.capabilities.getMaxAnisotropy();
        [groundDayTexture, groundNightTexture, groundCloudsTexture].forEach((t) => {
            t.anisotropy = anisotropy;
            t.wrapS = RepeatWrapping;
            t.wrapT = RepeatWrapping;
            t.repeat = new Vector2(3, 3);
        });

        const uniforms = {
            v3LightPosition: {
                type: 'v3',
                value: new Vector3(1e8, 0, 1e8).normalize(),
            },
            v3InvWavelength: {
                type: 'v3',
                value: new Vector3(
                    1 / Math.pow(Earth.ATMOSPHERE.wavelength[0], 4),
                    1 / Math.pow(Earth.ATMOSPHERE.wavelength[1], 4),
                    1 / Math.pow(Earth.ATMOSPHERE.wavelength[2], 4),
                ),
            },
            fCameraHeight: {
                type: 'f',
                value: 0,
            },
            fCameraHeight2: {
                type: 'f',
                value: 0,
            },
            fInnerRadius: {
                type: 'f',
                value: Earth.ATMOSPHERE.innerRadius,
            },
            fInnerRadius2: {
                type: 'f',
                value: Earth.ATMOSPHERE.innerRadius * Earth.ATMOSPHERE.innerRadius,
            },
            fOuterRadius: {
                type: 'f',
                value: Earth.ATMOSPHERE.outerRadius,
            },
            fOuterRadius2: {
                type: 'f',
                value: Earth.ATMOSPHERE.outerRadius * Earth.ATMOSPHERE.outerRadius,
            },
            fKrESun: {
                type: 'f',
                value: Earth.ATMOSPHERE.Kr * Earth.ATMOSPHERE.ESun,
            },
            fKmESun: {
                type: 'f',
                value: Earth.ATMOSPHERE.Km * Earth.ATMOSPHERE.ESun,
            },
            fKr4PI: {
                type: 'f',
                value: Earth.ATMOSPHERE.Kr * 4.0 * Math.PI,
            },
            fKm4PI: {
                type: 'f',
                value: Earth.ATMOSPHERE.Km * 4.0 * Math.PI,
            },
            fScale: {
                type: 'f',
                value: 1 / (Earth.ATMOSPHERE.outerRadius - Earth.ATMOSPHERE.innerRadius),
            },
            fScaleDepth: {
                type: 'f',
                value: Earth.ATMOSPHERE.scaleDepth,
            },
            fScaleOverScaleDepth: {
                type: 'f',
                value: 1 / (Earth.ATMOSPHERE.outerRadius - Earth.ATMOSPHERE.innerRadius) / Earth.ATMOSPHERE.scaleDepth,
            },
            g: {
                type: 'f',
                value: Earth.ATMOSPHERE.g,
            },
            g2: {
                type: 'f',
                value: Earth.ATMOSPHERE.g * Earth.ATMOSPHERE.g,
            },
            nSamples: {
                type: 'i',
                value: 3,
            },
            fSamples: {
                type: 'f',
                value: 3.0,
            },
            tDiffuse: {
                type: 't',
                value: groundDayTexture,
            },
            tDiffuseNight: {
                type: 't',
                value: groundNightTexture,
            },
            tDiffuseClouds: {
                type: 't',
                value: groundCloudsTexture,
            },
            tDisplacement: {
                type: 't',
                value: 0,
            },
            tSkyboxDiffuse: {
                type: 't',
                value: 0,
            },
            fNightScale: {
                type: 'f',
                value: 1,
            },
            fGroundRotation: {
                type: 'f',
                value: 0.75,
            },
            fCloudRotation: {
                type: 'f',
                value: 0.5,
            },
        };

        const groundGeometry = new SphereGeometry(Earth.ATMOSPHERE.innerRadius, 100, 100);
        const groundMaterial = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: EarthGroundVertexShader,
            fragmentShader: EarthGroundFragmentShader,
        });
        this.ground = {
            geometry: groundGeometry,
            material: groundMaterial,
            mesh: new Mesh(groundGeometry, groundMaterial),
        };
        this.ground.mesh.castShadow = true;
        this.ground.mesh.frustumCulled = false;
        scene.add(this.ground.mesh);

        const skyGeometry = new SphereGeometry(Earth.ATMOSPHERE.outerRadius, 500, 500);
        const skyMaterial = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: EarthSkyVertexShader,
            fragmentShader: EarthSkyFragmentShader,
            side: BackSide,
            transparent: true,
        });
        this.sky = {
            geometry: skyGeometry,
            material: skyMaterial,
            mesh: new Mesh(skyGeometry, skyMaterial),
        };
        this.sky.mesh.frustumCulled = false;
        scene.add(this.sky.mesh);

        this.axesHelper = new AxesHelper(Earth.RADIUS * 1.5);
        scene.add(this.axesHelper);
    }

    public render(dateTime: DateTime, camera: Camera, guiData: GUIData): void {
        if (!this.sky || !this.ground || !this.axesHelper) {
            return;
        }

        this.axesHelper.visible = guiData.showAxes;

        const rotationPercentage = this.getJ200SiderealDayPercentage(dateTime) + Earth.TEXTURE_ROTATION_PERCENTAGE;
        // console.log(rotationPercentage);

        const lightPosition = this.sun.getPosition();
        const cameraHeight = camera.position.length();

        this.sky.material.uniforms.v3LightPosition.value = lightPosition;
        this.sky.material.uniforms.fCameraHeight.value = cameraHeight;
        this.sky.material.uniforms.fCameraHeight2.value = cameraHeight * cameraHeight;
        this.ground.material.uniforms.v3LightPosition.value = lightPosition;
        this.ground.material.uniforms.fCameraHeight.value = cameraHeight;
        this.ground.material.uniforms.fCameraHeight2.value = cameraHeight * cameraHeight;
        this.ground.material.uniforms.fGroundRotation.value = -rotationPercentage;
        this.ground.material.uniforms.fCloudRotation.value = -rotationPercentage;
    }

    /**
     * Determines what percentage of a rotation about its axis that Earth has rotated on a given date. Based on the J200 epoch.
     */
    private getJ200SiderealDayPercentage = (dateTime: DateTime): number => {
        return getJ200PeriodPercentage(dateTime, Earth.SIDEREAL_DAY);
    };
}
