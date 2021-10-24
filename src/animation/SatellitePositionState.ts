import { Renderer, Scene, Vector3 } from 'three';
import { satellitePosition } from '../orb';
import { Satellite } from '../SatellitesData';
import { Duration } from 'luxon';

export default class SatellitePositionState {
    // The period of time (in model time, not real time) between accurate SGP4 position calculations
    private readonly updatePeriodMs: number;
    // An offset on the initial SGP4 position calculation to distribute the calculations for each satellite across frames
    private readonly updatePeriodJitterMs: number;
    // A reusable vector for returning positions. Used to reduce object creations.
    private readonly output: Vector3;
    private readonly temp: Vector3;
    private readonly satellite: Satellite;
    // SGP4 position 1 for interpolation
    private readonly position1: Vector3;
    private readonly position1Velocity: Vector3;
    private position1Timestamp: number;
    // SGP4 position 2 for interpolation
    private readonly position2: Vector3;
    private readonly position2Velocity: Vector3;
    private position2Timestamp: number;
    // The distance between position 1 and position 2. Stored to reduce interpolation operations.
    private readonly positionDiff: Vector3;
    private positionTimestampDiff: number;
    private hasInitialized: boolean;

    public constructor(satellite: Satellite, updatePeriod: Duration) {
        this.satellite = satellite;
        this.updatePeriodMs = updatePeriod.toMillis();
        this.updatePeriodJitterMs = Math.round(Math.random() * updatePeriod.toMillis());
        this.output = new Vector3();
        this.temp = new Vector3();
        this.position1 = new Vector3();
        this.position1Velocity = new Vector3();
        this.position1Timestamp = 0;
        this.position2 = new Vector3();
        this.position2Velocity = new Vector3();
        this.position2Timestamp = 0;
        this.positionDiff = new Vector3();
        this.positionTimestampDiff = 0;
        this.hasInitialized = false;
    }

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // Do nothing
    }

    public isInOrbit(dateTime: number): boolean {
        const isAfterLaunchDate = this.satellite.launchDateTime === null || dateTime > this.satellite.launchDateTime;
        const isBeforeDecayDate = this.satellite.decayDateTime === null || dateTime < this.satellite.decayDateTime;
        return isAfterLaunchDate && isBeforeDecayDate;
    }

    public getPosition(dateTime: number): Vector3 {
        if (!this.satellite) {
            return undefined as unknown as Vector3;
        }
        if (!this.hasInitialized) {
            // Initialize the positions
            this.position1Timestamp = dateTime - this.updatePeriodJitterMs;
            satellitePosition(this.position1Timestamp, this.satellite, this.position1, this.position1Velocity);
            this.position2Timestamp = this.position1Timestamp + this.updatePeriodMs;
            satellitePosition(this.position2Timestamp, this.satellite, this.position2, this.position2Velocity);
            this.positionDiff.copy(this.position2).sub(this.position1);
            this.positionTimestampDiff = this.updatePeriodMs;
            this.hasInitialized = true;
        } else if (dateTime > this.position2Timestamp && dateTime <= this.position2Timestamp + this.updatePeriodMs) {
            // Advance to the next position
            this.position1Timestamp = this.position2Timestamp;
            this.position1.copy(this.position2);
            this.position1Velocity.copy(this.position2Velocity);
            this.position2Timestamp = this.position1Timestamp + this.updatePeriodMs;
            satellitePosition(this.position2Timestamp, this.satellite, this.position2, this.position2Velocity);
            this.positionDiff.copy(this.position2).sub(this.position1);
            this.positionTimestampDiff = this.updatePeriodMs;
        } else if (dateTime > this.position2Timestamp + this.updatePeriodMs) {
            // Reinitialize around the new date (i.e. the date changed by a greater amount than the update period).
            // Instead of using the update period, use the amount of time between the new date and the previous date.
            const delta = dateTime - this.position1Timestamp;
            this.position1Timestamp = dateTime;
            satellitePosition(this.position1Timestamp, this.satellite, this.position1, this.position1Velocity);
            this.position2Timestamp = dateTime + delta;
            satellitePosition(this.position2Timestamp, this.satellite, this.position2, this.position2Velocity);
            this.positionDiff.copy(this.position2).sub(this.position1);
            this.positionTimestampDiff = delta;
        }

        // Interpolate
        if (dateTime === this.position1Timestamp) {
            this.output.copy(this.position1);
        } else if (dateTime === this.position2Timestamp) {
            this.output.copy(this.position2);
        } else {
            const position1TimestampDelta = dateTime - this.position1Timestamp;
            const position2TimestampDelta = dateTime - this.position2Timestamp;
            const percentage = position1TimestampDelta / this.positionTimestampDiff;
            // output = (p1v * p1d + p1) * p1p + (p2v * p2d + p2) * p2p
            this.temp.copy(this.position2Velocity).multiplyScalar(position2TimestampDelta).add(this.position2);
            this.output.copy(this.position1Velocity).multiplyScalar(position1TimestampDelta).add(this.position1);
            this.output.multiplyScalar(1 - percentage).add(this.temp.multiplyScalar(percentage));
            // this.output.copy(this.positionDiff).multiplyScalar(percentage).add(this.position1);
        }
        return this.output;
    }

    public get size(): number {
        if (this.isISS) {
            return SatellitePositionState.crossSectionToRadius(250); // 7_957
        } else if (this.isHubble) {
            return SatellitePositionState.crossSectionToRadius(55);
        } else if (this.isGPS) {
            return SatellitePositionState.crossSectionToRadius(12.5);
        } else if (this.isStarlinkSatellite) {
            return SatellitePositionState.crossSectionToRadius(5.12);
        } else if (this.satellite.size === 'LARGE') {
            return SatellitePositionState.crossSectionToRadius(SatellitePositionState.randomInRange(1, 25));
        } else if (this.satellite.size === 'MEDIUM') {
            return SatellitePositionState.crossSectionToRadius(SatellitePositionState.randomInRange(0.1, 1));
        } else {
            return SatellitePositionState.crossSectionToRadius(SatellitePositionState.randomInRange(0.03, 0.1));
        }
    }

    private static crossSectionToRadius(mSquared: number): number {
        return Math.sqrt(mSquared / Math.PI);
    }

    private static randomInRange(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    public get type(): 'DEBRIS' | 'ROCKET BODY' | 'PAYLOAD' {
        return this.satellite.objectType === 'TBA' ? 'DEBRIS' : this.satellite.objectType;
    }

    public get isISS(): boolean {
        return this.satellite.catalogId === '25544';
    }

    public get isHubble(): boolean {
        return this.satellite.catalogId === '20580';
    }

    public get isStarlinkSatellite(): boolean {
        return this.satellite.objectName !== null && this.satellite.objectName.includes('STARLINK');
    }

    public get isGPS(): boolean {
        return this.satellite.objectName !== null && this.satellite.objectName.includes('NAVSTAR') && this.satellite.objectType === 'PAYLOAD';
    }
}
