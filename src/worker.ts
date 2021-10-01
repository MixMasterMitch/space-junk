// import {initializeSatellite, satellitePosition} from "./orb";
import {Vector3} from "three";

export interface WorkerInitData {
    type: 'init';
    workerNumber: number;
    numWorkers: number;
    startTime: Date;
    initTime: Date;
    speed: number;
    framesPerSecond: number;
    numSatellites: number;
}
export interface WorkerUpdateSpeedData {
    type: 'updateSpeed';
    startTime: Date;
    initTime: Date;
    speed: number;
}
export interface WorkerReturnBufferData {
    type: 'returnBuffer';
    buffer: ArrayBuffer;
}
export type WorkerData = WorkerInitData | WorkerUpdateSpeedData | WorkerReturnBufferData;
export interface WorkerUpdatePositionsData {
    type: 'updatePositions';
    positions: ArrayBuffer;
}
export type WorkerOutputData = WorkerUpdatePositionsData;

let workerNumber: number;
let numWorkers: number;
let startTime: Date;
let initTime: Date;
let speed: number;
let millisPerFrame: number;
let numSatellites: number;
let positionsPrimary: Float32Array | null;
let positionsSecondary: Float32Array | null;
let positionsTertiary: Float32Array | null;
let timeOffsets: Int32Array;
let positionOffsets: Float32Array;

let lastFrameEndTime: number;

console.log(self);
const tle = {
    name: 'ISS',
    line1: `1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995`,
    line2: `2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581`,
};
// const satellite = initializeSatellite(tle);
const tempVector = new Vector3();

onmessage = (e) => {
    const data = e.data as WorkerData;
    // console.log('Message received from main script');
    if (data.type === 'init') {
        workerNumber = data.workerNumber;
        numWorkers = data.numWorkers;
        startTime = data.startTime;
        initTime = data.initTime;
        speed = data.speed;
        numSatellites = data.numSatellites;
        positionsPrimary = new Float32Array(numSatellites * 3);
        positionsSecondary = new Float32Array(numSatellites * 3);
        positionsTertiary = new Float32Array(numSatellites * 3);
        timeOffsets = new Int32Array(numSatellites);
        positionOffsets = new Float32Array(numSatellites);
        for (let i = 0; i < numSatellites; i++) {
            timeOffsets[i] = Math.round(-Math.random() * 14 * 24 * 60 * 60 * 1000);
            positionOffsets[i] = Math.random() + 1;
        }
        millisPerFrame = Math.floor(1000 / data.framesPerSecond);
        lastFrameEndTime = Date.now();
        iterate();
    } else if (data.type === 'updateSpeed') {
        startTime = data.startTime;
        initTime = data.initTime;
        speed = data.speed;
    } else if (data.type === 'returnBuffer') {
        const array = new Float32Array(data.buffer);
        if (positionsPrimary === null) {
            positionsPrimary = array;
        } else if (positionsSecondary === null) {
            positionsSecondary = array;
        } else if (positionsTertiary === null) {
            positionsTertiary = array;
        } else {
            console.warn('Returned a 4th buffer.');
        }
    }
};

function iterate() {
    if (positionsPrimary === null) {
        return setTimeout(iterate, 0);
    }

    const frameTime = startTime.getTime() + (Date.now() - initTime.getTime()) * speed;
    for (let i = 0; i < numSatellites; i++) {
        const timeOffset = timeOffsets[i];
        const positionOffset = positionOffsets[i];
        // satellitePosition(new Date(frameTime + timeOffset), satellite, tempVector);
        tempVector.multiplyScalar(positionOffset);
        positionsPrimary[i * 3] = tempVector.x;
        positionsPrimary[i * 3 + 1] = tempVector.y;
        positionsPrimary[i * 3 + 2] = tempVector.z;
    }

    const returnBufferMessageData: WorkerUpdatePositionsData = {
        type: 'updatePositions',
        positions: positionsPrimary.buffer,
    };
    postMessage(returnBufferMessageData, {
        transfer: [returnBufferMessageData.positions],
    });
    positionsPrimary = positionsSecondary;
    positionsSecondary = positionsTertiary;
    positionsTertiary = null;
    const endTime = Date.now();
    const elapsedTime = endTime - lastFrameEndTime;
    const sleepTime = Math.max(0, millisPerFrame - elapsedTime);
    setTimeout(iterate, sleepTime);
    lastFrameEndTime = endTime;
}
