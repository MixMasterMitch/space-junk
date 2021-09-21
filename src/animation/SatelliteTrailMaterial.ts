import SatelliteTrailVertexShader from './SatelliteTrailVertexShader';
import SatelliteTrailFragmentShader from './SatelliteTrailFragmentShader';
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, ShaderMaterialParameters, UniformsLib, UniformsUtils, Vector2 } from 'three';
import {NormalBlending} from "three/src/constants";

interface SatelliteTrailMaterialProperties extends ShaderMaterialParameters {
    lineWidth: number;
    color: Color;
    opacity: number;
    resolution: Vector2;
    sizeAttenuation: 0 | 1;
    earthRadius: number;
}

export class SatelliteTrailMaterial extends ShaderMaterial {
    constructor(parameters: Partial<SatelliteTrailMaterialProperties>) {
        super({
            uniforms: UniformsUtils.merge([
                UniformsLib.common,
                {
                    lineWidth: { value: 1 },
                    color: { value: new Color(0xffffff) },
                    opacity: { value: 1 },
                    resolution: { value: new Vector2(1, 1) },
                    sizeAttenuation: { value: 1 },
                    earthRadius: { value: 1 },
                },
            ]),
            vertexShader: SatelliteTrailVertexShader,
            fragmentShader: SatelliteTrailFragmentShader,
            // Lighting is handled with a manual calculation based on the sun position
            // lights: true,
            depthTest: true,
            blending: NormalBlending,
            transparent: true,
            side: DoubleSide,
        });

        this.type = 'MeshLineMaterial';
        Object.defineProperties(this, {
            lineWidth: {
                enumerable: true,
                get: function () {
                    return this.uniforms.lineWidth.value;
                },
                set: function (value) {
                    this.uniforms.lineWidth.value = value;
                },
            },
            color: {
                enumerable: true,
                get: function () {
                    return this.uniforms.color.value;
                },
                set: function (value) {
                    this.uniforms.color.value = value;
                },
            },
            opacity: {
                enumerable: true,
                get: function () {
                    return this.uniforms.opacity.value;
                },
                set: function (value) {
                    this.uniforms.opacity.value = value;
                },
            },
            resolution: {
                enumerable: true,
                get: function () {
                    return this.uniforms.resolution.value;
                },
                set: function (value) {
                    this.uniforms.resolution.value.copy(value);
                },
            },
            sizeAttenuation: {
                enumerable: true,
                get: function () {
                    return this.uniforms.sizeAttenuation.value;
                },
                set: function (value) {
                    this.uniforms.sizeAttenuation.value = value;
                },
            },
            earthRadius: {
                enumerable: true,
                get: function () {
                    return this.uniforms.earthRadius.value;
                },
                set: function (value) {
                    this.uniforms.earthRadius.value = value;
                },
            },
        });

        this.setValues(parameters);
    }
}
