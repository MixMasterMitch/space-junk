// From https://github.com/utsuboco/THREE.MeshLine/blob/master/src/meshline/material.js
const SatelliteTrailFragmentShader = `
varying vec4 vColor;

void main() {
    // TODO: Shadows
    gl_FragColor = vColor;
}
`;
export default SatelliteTrailFragmentShader;
