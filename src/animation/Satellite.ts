import {Renderer, Scene, Vector3,} from 'three';
import {initializeSatellite, SatelliteData, satellitePosition} from '../orb';
import {log} from "../utils";

export default class Satellite {
    private readonly timeOffset: number;
    private satellite?: SatelliteData;
    private pos?: Vector3;
    private prevPos?: Vector3;

    public constructor(timeOffset: number) {
        this.timeOffset = timeOffset;
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const tle = {
            name: 'ISS',
            line1: `1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995`,
            line2: `2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581`,
        };
        this.satellite = initializeSatellite(tle);
    }

    public getPosition(rawDate: Date): { prev: Vector3; cur: Vector3 } {
        if (!this.satellite) {
            return undefined as unknown as { prev: Vector3; cur: Vector3 };
        }
        const date = new Date(rawDate.getTime() + this.timeOffset);

        this.prevPos = this.pos;
        this.pos = satellitePosition(date, this.satellite);
        return { prev: this.prevPos || new Vector3(0, 0, 0), cur: this.pos };
    }
}
