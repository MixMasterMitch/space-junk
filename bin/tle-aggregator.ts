import fs from 'fs';
import zlib from 'zlib';
import es, { MapStream } from 'event-stream';
import { Readable } from 'stream';
import Immediate = NodeJS.Immediate;
import { getDayStringFromDate, getNextEndDate } from '../src/SatellitesData';

interface Satellite {
    catalogId: string;
    objectId: string;
    objectName: string;
    objectType: string;
    size: string;
    launchData: LaunchData;
    decayDate: string;
}

interface LaunchData {
    launchId: string;
    countryCode: string;
    launchDate: string;
    launchSite: string;
}

interface RawRecord {
    CCSDS_OMM_VERS: string;
    COMMENT: string;
    CREATION_DATE: string;
    ORIGINATOR: string;
    OBJECT_NAME: string;
    OBJECT_ID: string;
    CENTER_NAME: string;
    REF_FRAME: string;
    TIME_SYSTEM: string;
    MEAN_ELEMENT_THEORY: string;
    EPOCH: string;
    MEAN_MOTION: string;
    ECCENTRICITY: string;
    INCLINATION: string;
    RA_OF_ASC_NODE: string;
    ARG_OF_PERICENTER: string;
    MEAN_ANOMALY: string;
    EPHEMERIS_TYPE: string;
    CLASSIFICATION_TYPE: string;
    NORAD_CAT_ID: string;
    ELEMENT_SET_NO: string;
    REV_AT_EPOCH: string;
    BSTAR: string;
    MEAN_MOTION_DOT: string;
    MEAN_MOTION_DDOT: string;
    SEMIMAJOR_AXIS: string;
    PERIOD: string;
    APOAPSIS: string;
    PERIAPSIS: string;
    OBJECT_TYPE: string;
    RCS_SIZE: string;
    COUNTRY_CODE: string;
    LAUNCH_DATE: string;
    SITE: string;
    DECAY_DATE: string;
    FILE: string;
    GP_ID: string;
    TLE_LINE0: string;
    TLE_LINE1: string;
    TLE_LINE2: string;
}

const TLE_GAP = 2 * 7 * 24 * 60 * 60 * 1000; // Two weeks

const run = async (): Promise<void> => {
    console.log('Listing files');
    const files = fs
        .readdirSync('resources/raw')
        .filter((f) => !f.startsWith('.'))
        .sort();
    console.log(`Found ${files.length} files`);
    console.log('========================');

    const satellites: { [catalogId: string]: Satellite } = {};
    const launches: { [launchId: string]: LaunchData } = {};
    const prevEpochs: { [catalogId: string]: number } = {};
    let candidateEpochs: { [catalogId: string]: number } = {};
    let candidateTLEs: { [catalogId: string]: string } = {};

    const flushTles = async (): Promise<void> => {
        // console.log('paused for flushing');
        const catalogIds = Object.keys(candidateEpochs);
        for (let i = 0; i < catalogIds.length; i++) {
            const catalogId = catalogIds[i];
            const candidateTLE = candidateTLEs[catalogId];
            if (!tleWriteStream.write(candidateTLE)) {
                await new Promise((resolve) => tleWriteStream.once('drain', resolve));
            }
            prevEpochs[catalogId] = candidateEpochs[catalogId];
        }
        candidateEpochs = {};
        candidateTLEs = {};
    };

    const writeWithBackpressure = async (tle: string, tleReadStream: MapStream): Promise<void> => {
        if (!tleWriteStream.write(tle)) {
            tleReadStream.pause();
            await new Promise((resolve) => tleWriteStream.once('drain', resolve));
            clearImmediate(immediate);
            immediate = setImmediate(() => tleReadStream.resume());
        }
    };

    let currentTLEFileStart = getNextEndDate();
    let currentTLEFileEnd = getNextEndDate(currentTLEFileStart);
    let tleWriteStream = zlib.createGzip();
    tleWriteStream.pipe(fs.createWriteStream(`./resources/filtered/${getDayStringFromDate(currentTLEFileStart)}.csv.gz`));
    let immediate: Immediate;
    for (let i = 0; i < files.length; i++) {
        await new Promise<void>((resolve, reject) => {
            const file = files[i];
            const filePath = `resources/raw/${file}`;
            console.log(`Reading data from ${filePath}`);
            const tleReadStream = fs.createReadStream(filePath).pipe(zlib.createGunzip()).pipe(es.split());
            tleReadStream.on('data', async (value: string) => {
                if (value.length === 0 || value.startsWith('CCSDS_OMM_VERS')) {
                    return;
                }
                const parts = value.slice(1, value.length - 2).split('","');
                const catalogId = parts[19];
                if (catalogId === '') {
                    console.error('Missing NORAD_CAT_ID: ' + parts);
                    process.exit(1);
                }
                const objectId = parts[5];
                const objectName = parts[4].replace(/,/g, '.');
                const objectType = parts[29];
                const size = parts[30];
                const countryCode = parts[31];
                const launchDate = parts[32];
                const launchSite = parts[33];
                const decayDate = parts[34];
                const epoch = new Date(parts[10]).getTime();
                let launchId: string | undefined;
                let launchData: LaunchData | undefined;
                if (objectId !== '') {
                    launchId = objectId.slice(0, '####-###'.length);
                    launchData = launches[launchId];
                }
                if (launchData === undefined && launchId !== undefined) {
                    launchData = {
                        launchId,
                        countryCode,
                        launchDate,
                        launchSite,
                    };
                    launches[launchId] = launchData;
                }
                let satellite: Satellite = satellites[catalogId];
                if (satellite === undefined) {
                    satellite = {
                        catalogId,
                        objectId,
                        objectName,
                        objectType,
                        size,
                        launchData: launchData || {
                            launchId: '',
                            countryCode,
                            launchDate,
                            launchSite,
                        },
                        decayDate,
                    };
                    satellites[catalogId] = satellite;
                    prevEpochs[catalogId] = epoch;
                } else {
                    if (satellite.objectId === '' && objectId !== '') {
                        satellite.objectId = objectId;
                        satellite.launchData = launchData as LaunchData;
                    }
                    if (objectName !== '' && !objectName.startsWith('TBA') && !objectName.startsWith('UNKNOWN') && !objectName.startsWith('OBJECT')) {
                        satellite.objectName = objectName;
                    }
                    if (objectType !== '' && !objectType.startsWith('TBA') && !objectType.startsWith('UNKNOWN')) {
                        satellite.objectType = objectType;
                    }
                    if (size !== '') {
                        satellite.size = size;
                    }
                    if (countryCode !== '' && !countryCode.startsWith('TBD')) {
                        satellite.launchData.countryCode = countryCode;
                    }
                    if (launchDate !== '') {
                        satellite.launchData.launchDate = launchDate;
                    }
                    if (launchSite !== '' && !launchSite.startsWith('NULL')) {
                        satellite.launchData.launchSite = launchSite;
                    }
                    if (decayDate !== '') {
                        satellite.decayDate = decayDate;
                    }
                }
                if (epoch < currentTLEFileStart.getTime()) {
                    console.error('Epochs in wrong order');
                    process.exit(1);
                }
                if (epoch >= currentTLEFileEnd.getTime()) {
                    // Next file
                    tleReadStream.pause();
                    await flushTles();
                    clearImmediate(immediate);
                    immediate = setImmediate(() => tleReadStream.resume());
                    tleWriteStream.end();
                    console.log(`Found ${new Date(epoch)} in ${file}`);
                    console.log(`Closed output for ${getDayStringFromDate(currentTLEFileStart)}, starting on ${getDayStringFromDate(currentTLEFileEnd)}`);
                    currentTLEFileStart = currentTLEFileEnd;
                    currentTLEFileEnd = getNextEndDate(currentTLEFileStart);
                    tleWriteStream = zlib.createGzip();
                    tleWriteStream.pipe(fs.createWriteStream(`./resources/filtered/${getDayStringFromDate(currentTLEFileStart)}.csv.gz`));
                }

                const prevEpoch = prevEpochs[catalogId];
                const candidateEpoch = candidateEpochs[catalogId];
                const candidateTLE = candidateTLEs[catalogId];
                const nextEpoch = epoch;
                const nextTLE =
                    [
                        catalogId,
                        epoch,
                        parts[21], // revAtEpoch
                        parts[38], // line1
                        parts[39], // line2
                    ].join(',') + '\n';
                if (candidateEpoch !== undefined && nextEpoch - prevEpoch > TLE_GAP) {
                    await writeWithBackpressure(candidateTLE, tleReadStream);
                    prevEpochs[catalogId] = candidateEpoch;
                } else {
                    // Drop the current candidate
                }
                candidateEpochs[catalogId] = nextEpoch;
                candidateTLEs[catalogId] = nextTLE;
            });
            tleReadStream.on('error', (err) => {
                console.log(`Failed processing ${filePath}`);
                console.log(err);
                reject(err);
            });
            tleReadStream.on('end', () => {
                console.log(`Completed processing ${filePath}`);
                resolve();
            });
        });
    }
    await flushTles();
    tleWriteStream.end();
    console.log(`Closed output for ${getDayStringFromDate(currentTLEFileStart)}`);

    const satelliteValues = Object.values(satellites);
    console.log('========================');
    console.log('Writing satellites file');
    console.log(`Discovered ${satelliteValues.length} satellites`);
    Readable.from(satelliteValues)
        .pipe(
            es.map((satellite: Satellite, cb: (error?: Error | null, newValue?: string) => void) => {
                const data = [
                    satellite.catalogId,
                    satellite.objectId,
                    satellite.objectName,
                    satellite.objectType,
                    satellite.size,
                    satellite.launchData.countryCode,
                    satellite.launchData.launchDate,
                    satellite.launchData.launchSite,
                    satellite.decayDate,
                ];
                return cb(null, data.join(',') + '\n');
            }),
        )
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream('./resources/filtered/satellites.csv.gz'));
    console.log('Completed writing satellites file');
    console.log('========================');
};

run().then().catch(console.error);
