import { Renderer, Scene, Vector3 } from 'three';
import { initializeSatellite, SatelliteData, satellitePosition } from '../orb';
import { log } from '../utils';

export default class Satellite {
    // A random time shift to apply to all position calculations
    // TODO: Remove
    private readonly timeOffset: number;
    // A random position shift to apply to all position calculations
    // TODO: Remove
    private readonly positionOffset: number;
    // The period of time (in model time, not real time) between accurate SGP4 position calculations
    private readonly updatePeriodMs: number;
    // An offset on the initial SGP4 position calculation to distribute the calculations for each satellite across frames
    private readonly updatePeriodJitterMs: number;
    // A reusable vector for returning positions. Used to reduce object creations.
    private readonly output: Vector3;
    private satellite?: SatelliteData;
    // SGP4 position 1 for interpolation
    private position1?: Vector3;
    private position1Timestamp?: Date;
    // SGP4 position 2 for interpolation
    private position2?: Vector3;
    private position2Timestamp?: Date;
    // The distance between position 1 and position 2. Stored to reduce interpolation operations.
    private positionDiff?: Vector3;
    private positionTimestampDiff?: number;

    public constructor(timeOffset: number, positionOffset: number, updatePeriodMs: number) {
        this.timeOffset = timeOffset;
        this.positionOffset = positionOffset;
        this.updatePeriodMs = updatePeriodMs;
        this.updatePeriodJitterMs = Math.round(Math.random() * updatePeriodMs);
        this.output = new Vector3();
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        const tle = {
            name: 'ISS',
            line1: `1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995`,
            line2: `2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581`,
        };
        this.satellite = initializeSatellite(tle);
    }

    public getPosition(date: Date): Vector3 {
        if (!this.satellite) {
            return undefined as unknown as Vector3;
        }
        const dateTime = date.getTime() + this.timeOffset;
        if (
            this.position1 === undefined ||
            this.position1Timestamp === undefined ||
            this.position2 === undefined ||
            this.position2Timestamp === undefined ||
            this.positionDiff == undefined ||
            this.positionTimestampDiff == undefined
        ) {
            // Initialize the positions
            this.position1Timestamp = new Date(dateTime - this.updatePeriodJitterMs);
            this.position1 = satellitePosition(this.position1Timestamp, this.satellite);
            this.position2Timestamp = new Date(this.position1Timestamp.getTime() + this.updatePeriodMs);
            this.position2 = satellitePosition(this.position2Timestamp, this.satellite);
            this.positionDiff = this.position2.clone().sub(this.position1);
            this.positionTimestampDiff = this.updatePeriodMs;
        } else if (dateTime > this.position2Timestamp.getTime() && dateTime <= this.position2Timestamp.getTime() + this.updatePeriodMs) {
            // Advance to the next position
            this.position1Timestamp.setTime(this.position2Timestamp.getTime());
            this.position1.copy(this.position2);
            this.position2Timestamp.setTime(this.position1Timestamp.getTime() + this.updatePeriodMs);
            satellitePosition(this.position2Timestamp, this.satellite, this.position2);
            this.positionDiff = this.position2.clone().sub(this.position1);
            this.positionTimestampDiff = this.updatePeriodMs;
        } else if (dateTime > this.position2Timestamp.getTime() + this.updatePeriodMs) {
            // Reinitialize around the new date (i.e. the date changed by a greater amount than the update period).
            // Instead of using the update period, use the amount of time between the new date and the previous date.
            const delta = dateTime - this.position1Timestamp.getTime();
            this.position1Timestamp.setTime(dateTime);
            satellitePosition(this.position1Timestamp, this.satellite, this.position1);
            this.position2Timestamp.setTime(dateTime + delta);
            satellitePosition(this.position2Timestamp, this.satellite, this.position2);
            this.positionDiff = this.position2.clone().sub(this.position1);
            this.positionTimestampDiff = delta;
        }

        // Interpolate
        if (dateTime === this.position1Timestamp.getTime()) {
            return this.position1;
        } else if (dateTime === this.position2Timestamp.getTime()) {
            return this.position2;
        } else {
            const percentage = (dateTime - this.position1Timestamp.getTime()) / this.positionTimestampDiff;
            return this.output.copy(this.positionDiff).multiplyScalar(percentage).add(this.position1).multiplyScalar(this.positionOffset);
        }
    }
}
