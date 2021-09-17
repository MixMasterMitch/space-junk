// From https://github.com/utsuboco/THREE.MeshLine/blob/master/src/meshline/material.js
const SatelliteTrailVertexShader = `
#include <common>

attribute vec3 previous;
attribute vec3 next;
attribute float side;
attribute float width;

uniform vec3 color;
uniform float opacity;
uniform float lineWidth;
uniform float sizeAttenuation;
uniform vec2 resolution;

varying vec4 vColor;

vec2 fix( vec4 i, float aspect ) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
}

void main() {
    vColor = vec4( color, opacity );

    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4( position, 1.0 );
    vec4 prevPos = m * vec4( previous, 1.0 );
    vec4 nextPos = m * vec4( next, 1.0 );

    float aspectRatio = resolution.x / resolution.y;
    vec2 currentP = fix( finalPosition, aspectRatio );
    vec2 prevP = fix( prevPos, aspectRatio );
    vec2 nextP = fix( nextPos, aspectRatio );

    float w = lineWidth * width;

    vec2 dir;
    if( nextP == currentP ) {
        dir = normalize( currentP - prevP );
    } else if( prevP == currentP ) {
        dir = normalize( nextP - currentP );
    } else {
        vec2 dir1 = normalize( currentP - prevP );
        vec2 dir2 = normalize( nextP - currentP );
        dir = normalize( dir1 + dir2 );

        vec2 perp = vec2( -dir1.y, dir1.x );
        vec2 miter = vec2( -dir.y, dir.x );
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
