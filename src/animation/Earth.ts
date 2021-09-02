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
    public static SIDEREAL_DAY_MS = 86_164_091;

    // Amount of time for Earth to revolve around the sun with respect to the stars.
    // See: https://en.wikipedia.org/wiki/Sidereal_year
    public static SIDEREAL_YEAR_MS = 31_558_149_764;

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
    private static VERTEX_SKY_SHADER = `
uniform vec3 v3LightPosition;	// The direction vector to the light source
uniform vec3 v3InvWavelength;	// 1 / pow(wavelength, 4) for the red, green, and blue channels
uniform float fCameraHeight;	// The camera's current height
uniform float fCameraHeight2;	// fCameraHeight^2
uniform float fOuterRadius;		// The outer (Earth.ATMOSPHERE) radius
uniform float fOuterRadius2;	// fOuterRadius^2
uniform float fInnerRadius;		// The inner (planetary) radius
uniform float fInnerRadius2;	// fInnerRadius^2
uniform float fKrESun;			// Kr * ESun
uniform float fKmESun;			// Km * ESun
uniform float fKr4PI;			// Kr * 4 * PI
uniform float fKm4PI;			// Km * 4 * PI
uniform float fScale;			// 1 / (fOuterRadius - fInnerRadius)
uniform float fScaleDepth;		// The scale depth (i.e. the altitude at which the atmosphere's average density is found)
uniform float fScaleOverScaleDepth;	// fScale / fScaleDepth

const int nSamples = 3;
const float fSamples = 3.0;

varying vec3 v3Direction;
varying vec3 c0;
varying vec3 c1;


float scale(float fCos)
{
	float x = 1.0 - fCos;
	return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));
}

void main(void)
{
	// Get the ray from the camera to the vertex and its length (which is the far point of the ray passing through the atmosphere)
	vec3 v3Ray = position - cameraPosition;
	float fFar = length(v3Ray);
	v3Ray /= fFar;

	// Calculate the closest intersection of the ray with the outer atmosphere (which is the near point of the ray passing through the atmosphere)
	float B = 2.0 * dot(cameraPosition, v3Ray);
	float C = fCameraHeight2 - fOuterRadius2;
	float fDet = max(0.0, B*B - 4.0 * C);
	float fNear = 0.5 * (-B - sqrt(fDet));

	// Calculate the ray's starting position, then calculate its scattering offset
	vec3 v3Start = cameraPosition + v3Ray * fNear;
	fFar -= fNear;
	float fStartAngle = dot(v3Ray, v3Start) / fOuterRadius;
	float fStartDepth = exp(-1.0 / fScaleDepth);
	float fStartOffset = fStartDepth * scale(fStartAngle);
	//c0 = vec3(1.0, 0, 0) * fStartAngle;

	// Initialize the scattering loop variables
	float fSampleLength = fFar / fSamples;
	float fScaledLength = fSampleLength * fScale;
	vec3 v3SampleRay = v3Ray * fSampleLength;
	vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;

	//gl_FrontColor = vec4(0.0, 0.0, 0.0, 0.0);

	// Now loop through the sample rays
	vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);
	for(int i=0; i<nSamples; i++)
	{
		float fHeight = length(v3SamplePoint);
		float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));
		float fLightAngle = dot(v3LightPosition, v3SamplePoint) / fHeight;
		float fCameraAngle = dot(v3Ray, v3SamplePoint) / fHeight;
		float fScatter = (fStartOffset + fDepth * (scale(fLightAngle) - scale(fCameraAngle)));
		vec3 v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));

		v3FrontColor += v3Attenuate * (fDepth * fScaledLength);
		v3SamplePoint += v3SampleRay;
	}

	// Finally, scale the Mie and Rayleigh colors and set up the varying variables for the pixel shader
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	c0 = v3FrontColor * (v3InvWavelength * fKrESun);
	c1 = v3FrontColor * fKmESun;
	v3Direction = cameraPosition - position;
}`;
    private static FRAGMENT_SKY_SHADER = `
uniform vec3 v3LightPos;
uniform float g;
uniform float g2;

varying vec3 v3Direction;
varying vec3 c0;
varying vec3 c1;

// Calculates the Mie phase function
float getMiePhase(float fCos, float fCos2, float g, float g2)
{
	return 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + fCos2) / pow(1.0 + g2 - 2.0 * g * fCos, 1.5);
}

// Calculates the Rayleigh phase function
float getRayleighPhase(float fCos2)
{
	return 0.75 + 0.75 * fCos2;
}

void main (void)
{
	float fCos = dot(v3LightPos, v3Direction) / length(v3Direction);
	float fCos2 = fCos * fCos;

	vec3 color =	getRayleighPhase(fCos2) * c0 +
					getMiePhase(fCos, fCos2, g, g2) * c1;

 	gl_FragColor = vec4(color, 1.0);
	gl_FragColor.a = gl_FragColor.b;
}`;
    private static VERTEX_GROUND_SHADER = `
uniform vec3 v3LightPosition;   // The direction vector to the light source
uniform vec3 v3InvWavelength;	// 1 / pow(wavelength, 4) for the red, green, and blue channels
uniform float fCameraHeight;	// The camera's current height
uniform float fCameraHeight2;	// fCameraHeight^2
uniform float fOuterRadius;		// The outer (atmosphere) radius
uniform float fOuterRadius2;	// fOuterRadius^2
uniform float fInnerRadius;		// The inner (planetary) radius
uniform float fInnerRadius2;	// fInnerRadius^2
uniform float fKrESun;			// Kr * ESun
uniform float fKmESun;			// Km * ESun
uniform float fKr4PI;			// Kr * 4 * PI
uniform float fKm4PI;			// Km * 4 * PI
uniform float fScale;			// 1 / (fOuterRadius - fInnerRadius)
uniform float fScaleDepth;		// The scale depth (i.e. the altitude at which the atmosphere's average density is found)
uniform float fScaleOverScaleDepth;	// fScale / fScaleDepth

varying vec3 v3Direction;
varying vec3 c0;
varying vec3 c1;
varying vec3 vNormal;
varying vec2 vUv;

const int nSamples = 3;
const float fSamples = 3.0;

float scale(float fCos)
{
	float x = 1.0 - fCos;
	return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));
}

void main(void)
{
	// Get the ray from the camera to the vertex and its length (which is the far point of the ray passing through the atmosphere)
	vec3 v3Ray = position - cameraPosition;
	float fFar = length(v3Ray);
	v3Ray /= fFar;

	// Calculate the closest intersection of the ray with the outer atmosphere (which is the near point of the ray passing through the atmosphere)
	float B = 2.0 * dot(cameraPosition, v3Ray);
	float C = fCameraHeight2 - fOuterRadius2;
	float fDet = max(0.0, B*B - 4.0 * C);
	float fNear = 0.5 * (-B - sqrt(fDet));

	// Calculate the ray's starting position, then calculate its scattering offset
	vec3 v3Start = cameraPosition + v3Ray * fNear;
	fFar -= fNear;
	float fDepth = exp((fInnerRadius - fOuterRadius) / fScaleDepth);
	float fCameraAngle = dot(-v3Ray, position) / length(position);
	float fLightAngle = dot(v3LightPosition, position) / length(position);
	float fCameraScale = scale(fCameraAngle);
	float fLightScale = scale(fLightAngle);
	float fCameraOffset = fDepth*fCameraScale;
	float fTemp = (fLightScale + fCameraScale);

	// Initialize the scattering loop variables
	float fSampleLength = fFar / fSamples;
	float fScaledLength = fSampleLength * fScale;
	vec3 v3SampleRay = v3Ray * fSampleLength;
	vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;

	// Now loop through the sample rays
	vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);
	vec3 v3Attenuate;
	for(int i=0; i<nSamples; i++)
	{
		float fHeight = length(v3SamplePoint);
		float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));
		float fScatter = fDepth*fTemp - fCameraOffset;
		v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));
		v3FrontColor += v3Attenuate * (fDepth * fScaledLength);
		v3SamplePoint += v3SampleRay;
	}

	// Calculate the attenuation factor for the ground
	c0 = v3Attenuate;
	c1 = v3FrontColor * (v3InvWavelength * fKrESun + fKmESun);

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  vUv = uv;
  vNormal = normal;
}`;
    private static FRAGMENT_GROUND_SHADER = `
uniform float fNightScale;
uniform vec3 v3LightPosition;
uniform sampler2D tDiffuse;
uniform sampler2D tDiffuseNight;
uniform sampler2D tDiffuseClouds;
uniform float fGroundRotation;
uniform float fCloudRotation;

varying vec3 c0;
varying vec3 c1;
varying vec3 vNormal;
varying vec2 vUv;

void main (void)
{
    vec2 vGroundRotation = vec2(fGroundRotation, 0.0);
    vec2 vCloudRotation = vec2(fCloudRotation, 0.0);
	vec3 diffuseTex = texture2D( tDiffuse, vUv + vGroundRotation ).xyz;
	vec3 diffuseNightTex = texture2D( tDiffuseNight, vUv + vGroundRotation ).xyz;
	vec3 diffuseCloudsTex = texture2D( tDiffuseClouds, vUv + vCloudRotation ).xyz;

	vec3 day = (diffuseTex + diffuseCloudsTex) * c0;
	// vec3 night = fNightScale * diffuseNightTex * diffuseNightTex * diffuseNightTex * (1.0 - c0);
	// vec3 night = (fNightScale * diffuseNightTex * (0.9 - diffuseCloudsTex)) * (1.0 - c0);
	vec3 night = (fNightScale * diffuseNightTex + (0.1 * diffuseCloudsTex)) * (1.0 - c0);

	gl_FragColor = vec4(c1, 1.0) + vec4(day + night, 1.0);
}`;

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
            vertexShader: Earth.VERTEX_GROUND_SHADER,
            fragmentShader: Earth.FRAGMENT_GROUND_SHADER,
        });
        this.ground = {
            geometry: groundGeometry,
            material: groundMaterial,
            mesh: new Mesh(groundGeometry, groundMaterial),
        };
        this.ground.mesh.castShadow = true;
        scene.add(this.ground.mesh);

        const skyGeometry = new SphereGeometry(Earth.ATMOSPHERE.outerRadius, 500, 500);
        const skyMaterial = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: Earth.VERTEX_SKY_SHADER,
            fragmentShader: Earth.FRAGMENT_SKY_SHADER,
            side: BackSide,
            transparent: true,
        });
        this.sky = {
            geometry: skyGeometry,
            material: skyMaterial,
            mesh: new Mesh(skyGeometry, skyMaterial),
        };
        scene.add(this.sky.mesh);

        this.axesHelper = new AxesHelper(Earth.RADIUS * 1.5);
        scene.add(this.axesHelper);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.sky || !this.ground || !this.axesHelper) {
            return;
        }

        this.axesHelper.visible = guiData.showAxes;

        const rotationPercentage = this.getJ200SiderealDayPercentage(date);
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
    private getJ200SiderealDayPercentage = (date: Date): number => {
        return getJ200PeriodPercentage(date, Earth.SIDEREAL_DAY_MS);
    };
}

/* diffuse = ImageUtils.loadTexture('https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthmap1k.jpg'); */
