import * as THREE from 'three';

abstract class SceneComponent {
    abstract initialize(scene: THREE.Scene, renderer: THREE.Renderer): Promise<void>;

    abstract render(date: Date, camera: THREE.Camera): void;
}

export default class Earth extends SceneComponent {
    private static RADIUS = 100.0;
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
    private static VERTEX_SKY_SHADER =
        "//\n// Atmospheric scattering vertex shader\n//\n// Author: Sean O'Neil\n//\n// Copyright (c) 2004 Sean O'Neil\n//\n\nuniform vec3 v3LightPosition;	// The direction vector to the light source\nuniform vec3 v3InvWavelength;	// 1 / pow(wavelength, 4) for the red, green, and blue channels\nuniform float fCameraHeight;	// The camera's current height\nuniform float fCameraHeight2;	// fCameraHeight^2\nuniform float fOuterRadius;		// The outer (Earth.ATMOSPHERE) radius\nuniform float fOuterRadius2;	// fOuterRadius^2\nuniform float fInnerRadius;		// The inner (planetary) radius\nuniform float fInnerRadius2;	// fInnerRadius^2\nuniform float fKrESun;			// Kr * ESun\nuniform float fKmESun;			// Km * ESun\nuniform float fKr4PI;			// Kr * 4 * PI\nuniform float fKm4PI;			// Km * 4 * PI\nuniform float fScale;			// 1 / (fOuterRadius - fInnerRadius)\nuniform float fScaleDepth;		// The scale depth (i.e. the altitude at which the atmosphere's average density is found)\nuniform float fScaleOverScaleDepth;	// fScale / fScaleDepth\n\nconst int nSamples = 3;\nconst float fSamples = 3.0;\n\nvarying vec3 v3Direction;\nvarying vec3 c0;\nvarying vec3 c1;\n\n\nfloat scale(float fCos)\n{\n	float x = 1.0 - fCos;\n	return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));\n}\n\nvoid main(void)\n{\n	// Get the ray from the camera to the vertex and its length (which is the far point of the ray passing through the atmosphere)\n	vec3 v3Ray = position - cameraPosition;\n	float fFar = length(v3Ray);\n	v3Ray /= fFar;\n\n	// Calculate the closest intersection of the ray with the outer atmosphere (which is the near point of the ray passing through the atmosphere)\n	float B = 2.0 * dot(cameraPosition, v3Ray);\n	float C = fCameraHeight2 - fOuterRadius2;\n	float fDet = max(0.0, B*B - 4.0 * C);\n	float fNear = 0.5 * (-B - sqrt(fDet));\n\n	// Calculate the ray's starting position, then calculate its scattering offset\n	vec3 v3Start = cameraPosition + v3Ray * fNear;\n	fFar -= fNear;\n	float fStartAngle = dot(v3Ray, v3Start) / fOuterRadius;\n	float fStartDepth = exp(-1.0 / fScaleDepth);\n	float fStartOffset = fStartDepth * scale(fStartAngle);\n	//c0 = vec3(1.0, 0, 0) * fStartAngle;\n\n	// Initialize the scattering loop variables\n	float fSampleLength = fFar / fSamples;\n	float fScaledLength = fSampleLength * fScale;\n	vec3 v3SampleRay = v3Ray * fSampleLength;\n	vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;\n\n	//gl_FrontColor = vec4(0.0, 0.0, 0.0, 0.0);\n\n	// Now loop through the sample rays\n	vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);\n	for(int i=0; i<nSamples; i++)\n	{\n		float fHeight = length(v3SamplePoint);\n		float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));\n		float fLightAngle = dot(v3LightPosition, v3SamplePoint) / fHeight;\n		float fCameraAngle = dot(v3Ray, v3SamplePoint) / fHeight;\n		float fScatter = (fStartOffset + fDepth * (scale(fLightAngle) - scale(fCameraAngle)));\n		vec3 v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));\n\n		v3FrontColor += v3Attenuate * (fDepth * fScaledLength);\n		v3SamplePoint += v3SampleRay;\n	}\n\n	// Finally, scale the Mie and Rayleigh colors and set up the varying variables for the pixel shader\n	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n	c0 = v3FrontColor * (v3InvWavelength * fKrESun);\n	c1 = v3FrontColor * fKmESun;\n	v3Direction = cameraPosition - position;\n}";
    private static FRAGMENT_SKY_SHADER =
        "//\n// Atmospheric scattering fragment shader\n//\n// Author: Sean O'Neil\n//\n// Copyright (c) 2004 Sean O'Neil\n//\n\nuniform vec3 v3LightPos;\nuniform float g;\nuniform float g2;\n\nvarying vec3 v3Direction;\nvarying vec3 c0;\nvarying vec3 c1;\n\n// Calculates the Mie phase function\nfloat getMiePhase(float fCos, float fCos2, float g, float g2)\n{\n	return 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + fCos2) / pow(1.0 + g2 - 2.0 * g * fCos, 1.5);\n}\n\n// Calculates the Rayleigh phase function\nfloat getRayleighPhase(float fCos2)\n{\n	return 0.75 + 0.75 * fCos2;\n}\n\nvoid main (void)\n{\n	float fCos = dot(v3LightPos, v3Direction) / length(v3Direction);\n	float fCos2 = fCos * fCos;\n\n	vec3 color =	getRayleighPhase(fCos2) * c0 +\n					getMiePhase(fCos, fCos2, g, g2) * c1;\n\n 	gl_FragColor = vec4(color, 1.0);\n	gl_FragColor.a = gl_FragColor.b;\n}";
    private static VERTEX_GROUND_SHADER =
        "//\n// Atmospheric scattering vertex shader\n//\n// Author: Sean O'Neil\n//\n// Copyright (c) 2004 Sean O'Neil\n//\n// Ported for use with three.js/WebGL by James Baicoianu\n\nuniform vec3 v3LightPosition;		// The direction vector to the light source\nuniform vec3 v3InvWavelength;	// 1 / pow(wavelength, 4) for the red, green, and blue channels\nuniform float fCameraHeight;	// The camera's current height\nuniform float fCameraHeight2;	// fCameraHeight^2\nuniform float fOuterRadius;		// The outer (atmosphere) radius\nuniform float fOuterRadius2;	// fOuterRadius^2\nuniform float fInnerRadius;		// The inner (planetary) radius\nuniform float fInnerRadius2;	// fInnerRadius^2\nuniform float fKrESun;			// Kr * ESun\nuniform float fKmESun;			// Km * ESun\nuniform float fKr4PI;			// Kr * 4 * PI\nuniform float fKm4PI;			// Km * 4 * PI\nuniform float fScale;			// 1 / (fOuterRadius - fInnerRadius)\nuniform float fScaleDepth;		// The scale depth (i.e. the altitude at which the atmosphere's average density is found)\nuniform float fScaleOverScaleDepth;	// fScale / fScaleDepth\nuniform sampler2D tDiffuse;\n\nvarying vec3 v3Direction;\nvarying vec3 c0;\nvarying vec3 c1;\nvarying vec3 vNormal;\nvarying vec2 vUv;\n\nconst int nSamples = 3;\nconst float fSamples = 3.0;\n\nfloat scale(float fCos)\n{\n	float x = 1.0 - fCos;\n	return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));\n}\n\nvoid main(void)\n{\n	// Get the ray from the camera to the vertex and its length (which is the far point of the ray passing through the atmosphere)\n	vec3 v3Ray = position - cameraPosition;\n	float fFar = length(v3Ray);\n	v3Ray /= fFar;\n\n	// Calculate the closest intersection of the ray with the outer atmosphere (which is the near point of the ray passing through the atmosphere)\n	float B = 2.0 * dot(cameraPosition, v3Ray);\n	float C = fCameraHeight2 - fOuterRadius2;\n	float fDet = max(0.0, B*B - 4.0 * C);\n	float fNear = 0.5 * (-B - sqrt(fDet));\n\n	// Calculate the ray's starting position, then calculate its scattering offset\n	vec3 v3Start = cameraPosition + v3Ray * fNear;\n	fFar -= fNear;\n	float fDepth = exp((fInnerRadius - fOuterRadius) / fScaleDepth);\n	float fCameraAngle = dot(-v3Ray, position) / length(position);\n	float fLightAngle = dot(v3LightPosition, position) / length(position);\n	float fCameraScale = scale(fCameraAngle);\n	float fLightScale = scale(fLightAngle);\n	float fCameraOffset = fDepth*fCameraScale;\n	float fTemp = (fLightScale + fCameraScale);\n\n	// Initialize the scattering loop variables\n	float fSampleLength = fFar / fSamples;\n	float fScaledLength = fSampleLength * fScale;\n	vec3 v3SampleRay = v3Ray * fSampleLength;\n	vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;\n\n	// Now loop through the sample rays\n	vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);\n	vec3 v3Attenuate;\n	for(int i=0; i<nSamples; i++)\n	{\n		float fHeight = length(v3SamplePoint);\n		float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));\n		float fScatter = fDepth*fTemp - fCameraOffset;\n		v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));\n		v3FrontColor += v3Attenuate * (fDepth * fScaledLength);\n		v3SamplePoint += v3SampleRay;\n	}\n\n	// Calculate the attenuation factor for the ground\n	c0 = v3Attenuate;\n	c1 = v3FrontColor * (v3InvWavelength * fKrESun + fKmESun);\n\n  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n	//gl_TexCoord[0] = gl_TextureMatrix[0] * gl_MultiTexCoord0;\n	//gl_TexCoord[1] = gl_TextureMatrix[1] * gl_MultiTexCoord1;\n  vUv = uv;\n  vNormal = normal;\n}";
    private static FRAGMENT_GROUND_SHADER =
        "//\n// Atmospheric scattering fragment shader\n//\n// Author: Sean O'Neil\n//\n// Copyright (c) 2004 Sean O'Neil\n//\n// Ported for use with three.js/WebGL by James Baicoianu\n\n//uniform sampler2D s2Tex1;\n//uniform sampler2D s2Tex2;\n\nuniform float fNightScale;\nuniform vec3 v3LightPosition;\nuniform sampler2D tDiffuse;\nuniform sampler2D tDiffuseNight;\n\nvarying vec3 c0;\nvarying vec3 c1;\nvarying vec3 vNormal;\nvarying vec2 vUv;\n\nvoid main (void)\n{\n	//gl_FragColor = vec4(c0, 1.0);\n	//gl_FragColor = vec4(0.25 * c0, 1.0);\n	//gl_FragColor = gl_Color + texture2D(s2Tex1, gl_TexCoord[0].st) * texture2D(s2Tex2, gl_TexCoord[1].st) * gl_SecondaryColor;\n\n\n	vec3 diffuseTex = texture2D( tDiffuse, vUv ).xyz;\n	vec3 diffuseNightTex = texture2D( tDiffuseNight, vUv ).xyz;\n\n	vec3 day = diffuseTex * c0;\n	vec3 night = fNightScale * diffuseNightTex * diffuseNightTex * diffuseNightTex * (1.0 - c0);\n\n	gl_FragColor = vec4(c1, 1.0) + vec4(day + night, 1.0);\n\n}";

    private ground?: { geometry: THREE.SphereGeometry; material: THREE.ShaderMaterial; mesh: THREE.Mesh };
    private sky?: { geometry: THREE.SphereGeometry; material: THREE.ShaderMaterial; mesh: THREE.Mesh };

    private f = 0;
    private g = 0;

    public async initialize(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Promise<void> {
        const textureLoader = new THREE.TextureLoader();
        const groundDayTexture = await textureLoader.loadAsync(
            'https://cors-anywhere.herokuapp.com/shadedrelief.com/natural3/ne3_data/8192/textures/1_earth_8k.jpg',
        );
        const groundNightTexture = await textureLoader.loadAsync(
            'https://cors-anywhere.herokuapp.com/eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg',
        );

        const anisotropy = renderer.capabilities.getMaxAnisotropy();
        groundDayTexture.anisotropy = anisotropy;
        groundNightTexture.anisotropy = anisotropy;

        const uniforms = {
            v3LightPosition: {
                type: 'v3',
                value: new THREE.Vector3(1e8, 0, 1e8).normalize(),
            },
            v3InvWavelength: {
                type: 'v3',
                value: new THREE.Vector3(
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
        };

        const groundGeometry = new THREE.SphereGeometry(Earth.ATMOSPHERE.innerRadius, 100, 100);
        const groundMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: Earth.VERTEX_GROUND_SHADER,
            fragmentShader: Earth.FRAGMENT_GROUND_SHADER,
        });
        this.ground = {
            geometry: groundGeometry,
            material: groundMaterial,
            mesh: new THREE.Mesh(groundGeometry, groundMaterial),
        };
        scene.add(this.ground.mesh);

        const skyGeometry = new THREE.SphereGeometry(Earth.ATMOSPHERE.outerRadius, 500, 500);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: Earth.VERTEX_SKY_SHADER,
            fragmentShader: Earth.FRAGMENT_SKY_SHADER,
            side: THREE.BackSide,
            transparent: true,
        });
        this.sky = {
            geometry: skyGeometry,
            material: skyMaterial,
            mesh: new THREE.Mesh(skyGeometry, skyMaterial),
        };
        scene.add(this.sky.mesh);
    }

    public render(date: Date, camera: THREE.Camera): void {
        this.f += 0.0002;
        this.g += 0.008;

        // Move camera
        const eyeVector = new THREE.Vector3(Earth.RADIUS * 1.9, 0, 0);
        const eyeEuler = new THREE.Euler(this.g / 60 + 12, -this.f * 10 + 20, 0);
        const eyeMatrix = new THREE.Matrix4().makeRotationFromEuler(eyeEuler);
        const eye = eyeVector.applyMatrix4(eyeMatrix);
        camera.position.set(eye.x, eye.y, eye.z);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const lightVector = new THREE.Vector3(1, 0, 0);
        const lightEuler = new THREE.Euler(this.f, this.g, 0);
        const lightMatrix = new THREE.Matrix4().makeRotationFromEuler(lightEuler);
        const light = lightVector.applyMatrix4(lightMatrix);
        const cameraHeight = camera.position.length();
        if (!this.sky || !this.ground) {
            return;
        }
        this.sky.material.uniforms.v3LightPosition.value = light;
        this.sky.material.uniforms.fCameraHeight.value = cameraHeight;
        this.sky.material.uniforms.fCameraHeight2.value = cameraHeight * cameraHeight;
        this.ground.material.uniforms.v3LightPosition.value = light;
        this.ground.material.uniforms.fCameraHeight.value = cameraHeight;
        this.ground.material.uniforms.fCameraHeight2.value = cameraHeight * cameraHeight;
    }
}

/* diffuse = THREE.ImageUtils.loadTexture('https://s3-us-west-2.amazonaws.com/s.cdpn.io/141228/earthmap1k.jpg'); */
