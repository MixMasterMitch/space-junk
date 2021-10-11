import { Renderer, Scene, Vector3 } from 'three';
import { satellitePosition } from '../orb';
import { Satellite } from '../SatellitesData';

export default class SatellitePositionState {
    // The period of time (in model time, not real time) between accurate SGP4 position calculations
    private readonly updatePeriodMs: number;
    // An offset on the initial SGP4 position calculation to distribute the calculations for each satellite across frames
    private readonly updatePeriodJitterMs: number;
    // A reusable vector for returning positions. Used to reduce object creations.
    private readonly output: Vector3;
    private readonly temp: Vector3;
    private satellite: Satellite;
    // SGP4 position 1 for interpolation
    private position1?: Vector3;
    private position1Velocity?: Vector3;
    private position1Timestamp?: Date;
    // SGP4 position 2 for interpolation
    private position2?: Vector3;
    private position2Velocity?: Vector3;
    private position2Timestamp?: Date;
    // The distance between position 1 and position 2. Stored to reduce interpolation operations.
    private positionDiff?: Vector3;
    private positionTimestampDiff?: number;

    public constructor(satellite: Satellite, updatePeriodMs: number) {
        this.satellite = satellite;
        this.updatePeriodMs = updatePeriodMs;
        this.updatePeriodJitterMs = Math.round(Math.random() * updatePeriodMs);
        this.output = new Vector3();
        this.temp = new Vector3();
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // Do nothing
    }

    public getPosition(date: Date): Vector3 {
        if (!this.satellite) {
            return undefined as unknown as Vector3;
        }
        const dateTime = date.getTime();
        if (
            this.position1 === undefined ||
            this.position1Velocity === undefined ||
            this.position1Timestamp === undefined ||
            this.position2 === undefined ||
            this.position2Velocity === undefined ||
            this.position2Timestamp === undefined ||
            this.positionDiff == undefined ||
            this.positionTimestampDiff == undefined
        ) {
            // Initialize the positions
            this.position1Timestamp = new Date(dateTime - this.updatePeriodJitterMs);
            this.position1 = new Vector3();
            this.position1Velocity = new Vector3();
            satellitePosition(this.position1Timestamp, this.satellite, this.position1, this.position1Velocity);
            this.position2Timestamp = new Date(this.position1Timestamp.getTime() + this.updatePeriodMs);
            this.position2 = new Vector3();
            this.position2Velocity = new Vector3();
            satellitePosition(this.position2Timestamp, this.satellite, this.position2, this.position2Velocity);
            this.positionDiff = this.position2.clone().sub(this.position1);
            this.positionTimestampDiff = this.updatePeriodMs;
        } else if (dateTime > this.position2Timestamp.getTime() && dateTime <= this.position2Timestamp.getTime() + this.updatePeriodMs) {
            // Advance to the next position
            this.position1Timestamp.setTime(this.position2Timestamp.getTime());
            this.position1.copy(this.position2);
            this.position1Velocity.copy(this.position2Velocity);
            this.position2Timestamp.setTime(this.position1Timestamp.getTime() + this.updatePeriodMs);
            satellitePosition(this.position2Timestamp, this.satellite, this.position2, this.position2Velocity);
            this.positionDiff = this.position2.clone().sub(this.position1);
            this.positionTimestampDiff = this.updatePeriodMs;
        } else if (dateTime > this.position2Timestamp.getTime() + this.updatePeriodMs) {
            // Reinitialize around the new date (i.e. the date changed by a greater amount than the update period).
            // Instead of using the update period, use the amount of time between the new date and the previous date.
            const delta = dateTime - this.position1Timestamp.getTime();
            this.position1Timestamp.setTime(dateTime);
            satellitePosition(this.position1Timestamp, this.satellite, this.position1, this.position1Velocity);
            this.position2Timestamp.setTime(dateTime + delta);
            satellitePosition(this.position2Timestamp, this.satellite, this.position2, this.position2Velocity);
            this.positionDiff = this.position2.clone().sub(this.position1);
            this.positionTimestampDiff = delta;
        }

        // Interpolate
        if (dateTime === this.position1Timestamp.getTime()) {
            this.output.copy(this.position1);
        } else if (dateTime === this.position2Timestamp.getTime()) {
            this.output.copy(this.position2);
        } else {
            const position1TimestampDelta = dateTime - this.position1Timestamp.getTime();
            const position2TimestampDelta = dateTime - this.position2Timestamp.getTime();
            const percentage = position1TimestampDelta / this.positionTimestampDiff;
            // output = (p1v * p1d + p1) * p1p + (p2v * p2d + p2) * p2p
            this.temp.copy(this.position2Velocity).multiplyScalar(position2TimestampDelta).add(this.position2);
            this.output.copy(this.position1Velocity).multiplyScalar(position1TimestampDelta).add(this.position1);
            this.output.multiplyScalar(1 - percentage).add(this.temp.multiplyScalar(percentage));
            // this.output.copy(this.positionDiff).multiplyScalar(percentage).add(this.position1);
        }
        return this.output;
    }
}
