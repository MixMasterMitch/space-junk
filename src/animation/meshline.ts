import * as THREE from 'three';
import { memcpy } from './utils';

export class MeshLine extends THREE.BufferGeometry {
    private _attributes?: { [key: string]: THREE.BufferAttribute };
    private isMeshLine: boolean;
    private positions: number[];
    private previous: number[];
    private next: number[];
    private side: number[];
    private width: number[];
    private indices_array: number[];
    private _points: Float32Array | number[] | THREE.Vector3[];
    private widthCallback?: (i: number) => number;

    constructor() {
        super();
        this.type = 'MeshLine';
        this.isMeshLine = true;
        this.positions = [];
        this.previous = [];
        this.next = [];
        this.side = [];
        this.width = [];
        this.indices_array = [];
        this._points = [];

        Object.defineProperties(this, {
            // this is now a bufferGeometry
            // add getter to support previous api
            geometry: {
                enumerable: true,
                get() {
                    return this;
                },
            },
            // for declaritive architectures
            // to return the same value that sets the points
            // eg. this.points = points
            // console.log(this.points) -> points
            points: {
                enumerable: true,
                get() {
                    return this._points;
                },
                set(value) {
                    this.setPoints(value, this.widthCallback);
                },
            },
        });
    }

    setPoints(points: Float32Array | number[] | THREE.Vector3[], wcb?: (i: number) => number) {
        if (!(points instanceof Float32Array) && !(points instanceof Array)) {
            console.error('ERROR: The BufferArray of points is not instancied correctly.');
            return;
        }
        // as the points are mutated we store them
        // for later retreival when necessary (declaritive architectures)
        this._points = points;
        this.widthCallback = wcb;
        this.positions = [];
        if (points.length && points[0] instanceof THREE.Vector3) {
            // could transform Vector3 array into the array used below
            // but this approach will only loop through the array once
            // and is more performant
            for (let j = 0; j < points.length; j++) {
                const p = points[j] as THREE.Vector3;
                const c = j / points.length;
                this.positions.push(p.x, p.y, p.z);
                this.positions.push(p.x, p.y, p.z);
            }
        } else {
            for (let j = 0; j < points.length; j += 3) {
                const c = j / points.length;
                const _points = points as number[];
                this.positions.push(_points[j], _points[j + 1], _points[j + 2]);
                this.positions.push(_points[j], _points[j + 1], _points[j + 2]);
            }
        }
        this.process();
    }

    compareV3(a: number, b: number): boolean {
        const aa = a * 6;
        const ab = b * 6;
        return (
            this.positions[aa] === this.positions[ab] && this.positions[aa + 1] === this.positions[ab + 1] && this.positions[aa + 2] === this.positions[ab + 2]
        );
    }

    copyV3(a: number): number[] {
        const aa = a * 6;
        return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];
    }

    process() {
        const l = this.positions.length / 6;

        this.previous = [];
        this.next = [];
        this.side = [];
        this.width = [];
        this.indices_array = [];

        let w;

        let v;
        // initial previous points
        if (this.compareV3(0, l - 1)) {
            v = this.copyV3(l - 2);
        } else {
            v = this.copyV3(0);
        }
        this.previous.push(v[0], v[1], v[2]);
        this.previous.push(v[0], v[1], v[2]);

        for (let j = 0; j < l; j++) {
            // sides
            this.side.push(1);
            this.side.push(-1);

            // widths
            if (this.widthCallback) w = this.widthCallback(j / (l - 1));
            else w = 1;
            this.width.push(w);
            this.width.push(w);

            if (j < l - 1) {
                // points previous to poisitions
                v = this.copyV3(j);
                this.previous.push(v[0], v[1], v[2]);
                this.previous.push(v[0], v[1], v[2]);

                // indices
                const n = j * 2;
                this.indices_array.push(n, n + 1, n + 2);
                this.indices_array.push(n + 2, n + 1, n + 3);
            }
            if (j > 0) {
                // points after poisitions
                v = this.copyV3(j);
                this.next.push(v[0], v[1], v[2]);
                this.next.push(v[0], v[1], v[2]);
            }
        }

        // last next point
        if (this.compareV3(l - 1, 0)) {
            v = this.copyV3(1);
        } else {
            v = this.copyV3(l - 1);
        }
        this.next.push(v[0], v[1], v[2]);
        this.next.push(v[0], v[1], v[2]);

        // redefining the attribute seems to prevent range errors
        // if the user sets a differing number of vertices
        if (!this._attributes || this._attributes.position.count !== this.positions.length) {
            this._attributes = {
                position: new THREE.BufferAttribute(new Float32Array(this.positions), 3),
                previous: new THREE.BufferAttribute(new Float32Array(this.previous), 3),
                next: new THREE.BufferAttribute(new Float32Array(this.next), 3),
                side: new THREE.BufferAttribute(new Float32Array(this.side), 1),
                width: new THREE.BufferAttribute(new Float32Array(this.width), 1),
                index: new THREE.BufferAttribute(new Uint16Array(this.indices_array), 1),
            };
        } else {
            this._attributes.position.copyArray(new Float32Array(this.positions));
            this._attributes.position.needsUpdate = true;
            this._attributes.previous.copyArray(new Float32Array(this.previous));
            this._attributes.previous.needsUpdate = true;
            this._attributes.next.copyArray(new Float32Array(this.next));
            this._attributes.next.needsUpdate = true;
            this._attributes.side.copyArray(new Float32Array(this.side));
            this._attributes.side.needsUpdate = true;
            this._attributes.width.copyArray(new Float32Array(this.width));
            this._attributes.width.needsUpdate = true;
            this._attributes.index.copyArray(new Uint16Array(this.indices_array));
            this._attributes.index.needsUpdate = true;
        }

        this.setAttribute('position', this._attributes.position);
        this.setAttribute('previous', this._attributes.previous);
        this.setAttribute('next', this._attributes.next);
        this.setAttribute('side', this._attributes.side);
        this.setAttribute('width', this._attributes.width);

        this.setIndex(this._attributes.index);

        this.computeBoundingSphere();
        this.computeBoundingBox();
    }

    /**
     * Fast method to advance the line by one position.  The oldest position is removed.
     * @param position
     */
    advance({ x, y, z }: { x: number; y: number; z: number }) {
        if (this._attributes === undefined) {
            return;
        }
        const positions = this._attributes.position.array as Float32Array;
        const previous = this._attributes.previous.array as Float32Array;
        const next = this._attributes.next.array as Float32Array;
        const l = positions.length;

        // PREVIOUS
        memcpy(positions, 0, previous, 0, l);

        // POSITIONS
        memcpy(positions, 6, positions, 0, l - 6);

        positions[l - 6] = x;
        positions[l - 5] = y;
        positions[l - 4] = z;
        positions[l - 3] = x;
        positions[l - 2] = y;
        positions[l - 1] = z;

        // NEXT
        memcpy(positions, 6, next, 0, l - 6);

        next[l - 6] = x;
        next[l - 5] = y;
        next[l - 4] = z;
        next[l - 3] = x;
        next[l - 2] = y;
        next[l - 1] = z;

        this._attributes.position.needsUpdate = true;
        this._attributes.previous.needsUpdate = true;
        this._attributes.next.needsUpdate = true;
    }
}
