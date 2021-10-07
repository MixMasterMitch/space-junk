import fs from 'fs';
import zlib from 'zlib';
import es, { MapStream } from 'event-stream';
import { Readable } from 'stream';
import Immediate = NodeJS.Immediate;

type KnownSatellites = { [catalogId: string]: Satellite };
interface Satellite {
    catalogId: string;
    objectId: string;
    objectName: string;
    objectType: string;
    size: string;
    countryCode: string;
    launchDate: string;
    launchSite: string;
    decayDate: string;
}

interface TLE {
    catalogId: string;
    epoch: number;
    revAtEpoch: string;
    lineOne: string;
    lineTwo: string;
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

const getDayStringFromDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const getDateFromDayString = (dayString: string): Date => {
    const parts = dayString.split('-');
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0));
};

const incrementOneYear = (date: Date): Date => {
    return new Date(
        Date.UTC(
            date.getUTCFullYear() + 1,
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds(),
        ),
    );
};

const incrementThreeMonths = (date: Date): Date => {
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth() + 3,
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds(),
        ),
    );
};

const incrementOneMonth = (date: Date): Date => {
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds(),
        ),
    );
};

const increment15Days = (date: Date): Date => {
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 15,
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds(),
        ),
    );
};

const getNextEndDate = (startDate: Date): Date => {
    if (startDate.getTime() < getDateFromDayString('1970-01-01').getTime()) {
        return incrementOneYear(startDate);
    } else if (startDate.getTime() < getDateFromDayString('1975-01-01').getTime()) {
        return incrementThreeMonths(startDate);
    } else if (startDate.getTime() < getDateFromDayString('1990-01-01').getTime()) {
        return incrementOneMonth(startDate);
    } else {
        return increment15Days(startDate);
    }
};

const START_DATE = getDateFromDayString('1959-01-01');

const run = async (): Promise<void> => {
    console.log('Listing files');
    const files = fs
        .readdirSync('resources/raw')
        .filter((f) => !f.startsWith('.'))
        .sort();
    console.log(`Found ${files.length} files`);
    console.log('========================');

    const satellites: KnownSatellites = {};
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

    let currentTLEFileStart = START_DATE;
    let currentTLEFileEnd = getNextEndDate(START_DATE);
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
                // const iterationId = Math.round(Math.random() * 10000);
                if (value.length === 0 || value.startsWith('CCSDS_OMM_VERS')) {
                    return;
                }
                // console.log('start ' + iterationId);
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
                const satellite = satellites[catalogId];
                if (satellite === undefined) {
                    satellites[catalogId] = {
                        catalogId,
                        objectId,
                        objectName,
                        objectType,
                        size,
                        countryCode,
                        launchDate,
                        launchSite,
                        decayDate,
                    };
                    prevEpochs[catalogId] = epoch;
                } else {
                    if (satellite.objectId === '' && objectId !== '') {
                        satellite.objectId = objectId;
                    }
                    if (
                        (satellite.objectName === '' || satellite.objectName.startsWith('TBA') || satellite.objectName.startsWith('UNKNOWN')) &&
                        objectName !== '' &&
                        !objectName.startsWith('TBA') &&
                        !objectName.startsWith('UNKNOWN')
                    ) {
                        satellite.objectName = objectName;
                    }
                    if (
                        (satellite.objectType === '' || satellite.objectType.startsWith('TBA') || satellite.objectType.startsWith('UNKNOWN')) &&
                        objectType !== '' &&
                        !objectType.startsWith('TBA') &&
                        !objectType.startsWith('UNKNOWN')
                    ) {
                        satellite.objectType = objectType;
                    }
                    if (satellite.size === '' && size !== '') {
                        satellite.size = size;
                    }
                    if (satellite.countryCode === '' && countryCode !== '') {
                        satellite.countryCode = countryCode;
                    }
                    if (satellite.launchDate === '' && launchDate !== '') {
                        satellite.launchDate = launchDate;
                    }
                    if (satellite.launchSite === '' && launchSite !== '') {
                        satellite.launchSite = launchSite;
                    }
                    if (satellite.decayDate === '' && decayDate !== '') {
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
                // if (count > 10) {
                //     return;
                // }
                // count++;
                // console.log(parts);
                // console.log('end ' + iterationId);
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
                return cb(null, Object.values(satellite).join(',') + '\n');
            }),
        )
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream('./resources/filtered/satellites.csv.gz'));
    // satelliteValues.forEach((satellite) => {
    //     writeStream.write(Object.values(satellite).join(',') + '\n');
    // });
    // writeStream.end();
    console.log('Completed writing satellites file');
    console.log('========================');
    // .pipe(
    //     es.map((value: string, cb: (error?: Error | null, newValue?: string[]) => void) => {
    //         if (value.length === 0 || value.startsWith('CCSDS_OMM_VERS')) {
    //             return cb();
    //         }
    //         const parts = value.slice(1, value.length - 2).split('","');
    //         cb(null, parts);
    //     }),
    // )
    // .pipe(
    //     es.map((value: string[], cb: (error?: Error | null, newValue?: string[]) => void) => {
    //         if (count > 10) {
    //             return cb();
    //         }
    //         count++;
    //         return cb(null, value);
    //     }),
    // )
    // .pipe(process.stdout);
    // const gzipped = fs.readFileSync(filePath);
    //
    // console.log('Unzipping data');
    // const csv = zlib.gunzipSync(gzipped);
    // await parseCSV(
    //     csv,
    //     satellites,
    //     (satellite) => {
    //         objectInsertStatement.run(
    //             satellite.objectId,
    //             satellite.objectType,
    //             satellite.size,
    //             satellite.countryCode,
    //             satellite.launchDate,
    //             satellite.launchSite,
    //             satellite.decayDate,
    //         );
    //     },
    //     (tle) => {
    //         tleInsertStatement.run(tle.objectId, tle.epoch, tle.revAtEpoch, tle.lineOne, tle.lineTwo);
    //     },
    // );
};

run().then().catch(console.error);
