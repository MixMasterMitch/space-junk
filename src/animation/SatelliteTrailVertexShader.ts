// From https://github.com/utsuboco/THREE.MeshLine/blob/master/src/meshline/material.js
const SatelliteTrailVertexShader = `
#include <common>

attribute vec3 previous;
attribute vec3 sunPosition;
attribute float side;
attribute float width;

uniform vec3 color;
uniform float opacity;
uniform float lineWidth;
uniform float sizeAttenuation;
uniform vec2 resolution;
uniform float earthRadius;

varying vec4 vColor;

vec2 fix( vec4 i, float aspect ) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
}

void main() {

    // To determine if a vertex is in the shadow of Earth, the position vector is split into the component in the same direction as
    // the sun and the component perpendicular. If the magnitude of the perpendicular (non-sun) component of the position is less than
    // the radius of Earth, then the point is in Earth's shadow.
    // I tried using the three.js shadow map, but I could not get it to produce a shadowed output.
    bool shadow = false;
    vec3 sunPositionUnit = normalize( sunPosition ) * -1.0;
    float positionAndSunDotProduct = dot( position, sunPositionUnit );
    // If the positionAndSunDotProduct is negative, then the point is on the sunny half of earth and is therefore not in shadow
    if (positionAndSunDotProduct > 0.0) {
        vec3 positionSunComponent = sunPositionUnit * positionAndSunDotProduct;
        float positionNonSunComponentLength = length( position - positionSunComponent );
        shadow = positionNonSunComponentLength < earthRadius;
    }
    float shadowIntensity = shadow ? 0.25 : 1.0;

    vColor = vec4( color, opacity * shadowIntensity );

    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4( position, 1.0 );
    vec4 prevPos = m * vec4( previous, 1.0 );

    float aspectRatio = resolution.x / resolution.y;
    vec2 currentP = fix( finalPosition, aspectRatio );
    vec2 prevP = fix( prevPos, aspectRatio );

    float w = lineWidth * width;

    vec2 dir = normalize( currentP ) * -1.0;
    if ( prevP == currentP ) {
        dir = vec2( 0, 0);
    } else {
        dir = normalize( currentP - prevP );
    }

    vec4 normal = vec4( -dir.y, dir.x, 0., 1. );
    normal.xy *= .5 * w;
    normal *= projectionMatrix;
    if( sizeAttenuation == 0. ) {
        normal.xy *= finalPosition.w;
        normal.xy /= ( vec4( resolution, 0., 1. ) * projectionMatrix ).xy;
    }

    finalPosition.xy += normal.xy * side;

    gl_Position = finalPosition;
}
`;
export default SatelliteTrailVertexShader;
