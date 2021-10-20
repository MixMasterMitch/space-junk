const EarthGroundFragmentShader = `
uniform float fNightScale;
uniform vec3 v3LightPosition;
uniform sampler2D tDiffuse;
uniform sampler2D tDiffuseNight;
uniform sampler2D tDiffuseClouds;
uniform float fGroundRotation;
uniform float fCloudRotation;

varying vec3 c0;
varying vec3 c1;
varying vec2 vUv;

void main (void)
{
    vec2 vGroundRotation = vec2(fGroundRotation, 0.0);
    vec2 vCloudRotation = vec2(fCloudRotation, 0.0);
	vec3 diffuseTex = texture2D( tDiffuse, vUv + vGroundRotation ).xyz;
	vec3 diffuseNightTex = texture2D( tDiffuseNight, vUv + vGroundRotation ).xyz;
	vec3 diffuseCloudsTex = texture2D( tDiffuseClouds, vUv + vCloudRotation ).xyz;

	vec3 day = (diffuseTex + diffuseCloudsTex) * c0;
	vec3 night = (fNightScale * diffuseNightTex + (0.1 * diffuseCloudsTex)) * (1.0 - c0);

	gl_FragColor = vec4(c1, 1.0) + vec4(day + night, 1.0);
}
`;
export default EarthGroundFragmentShader;
