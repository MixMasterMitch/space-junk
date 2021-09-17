import SatelliteTrailVertexShader from './SatelliteTrailVertexShader';
import SatelliteTrailFragmentShader from './SatelliteTrailFragmentShader';
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, ShaderMaterialParameters, UniformsLib, UniformsUtils, Vector2 } from 'three';

interface SatelliteTrailMaterialProperties extends ShaderMaterialParameters {
    lineWidth: number;
    color: Color;
    opacity: number;
    resolution: Vector2;
    sizeAttenuation: 0 | 1;
}

export class SatelliteTrailMaterial extends ShaderMaterial {
    constructor(parameters: Partial<SatelliteTrailMaterialProperties>) {
        super({
            uniforms: UniformsUtils.merge([
                UniformsLib.lights,
                {
                    lineWidth: { value: 1 },
                    color: { value: new Color(0xffffff) },
                    opacity: { value: 1 },
                    resolution: { value: new Vector2(1, 1) },
                    sizeAttenuation: { value: 1 },
                },
            ]),
            vertexShader: SatelliteTrailVertexShader,
            fragmentShader: SatelliteTrailFragmentShader,
            depthTest: true,
            blending: AdditiveBlending,
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
        });

        this.setValues(parameters);
    }
}
