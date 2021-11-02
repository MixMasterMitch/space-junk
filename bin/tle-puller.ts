import { DateTime, Duration, Settings } from 'luxon';

Settings.defaultZone = 'UTC';

import fs from 'fs';
import zlib from 'zlib';

import credentials from '../spaceTrackCreds.json';
import SpaceTrack from '../src/SpaceTrack';
import { getDayStringFromDate } from '../src/dateUtils';

const incrementDayStringOneDay = (dateString: string): string => {
    const inputDateTime = DateTime.fromISO(dateString);
    return getDayStringFromDate(inputDateTime.plus(Duration.fromObject({ days: 1 })));
};

const findNextDateToPull = (startDayString: string, endDayString: string, existingFiles: string[]): string => {
    let curDayString = startDayString;
    while (existingFiles.includes(curDayString + '.csv.gz') && curDayString !== endDayString) {
        curDayString = incrementDayStringOneDay(curDayString);
    }
    return curDayString;
};

const START_DATE = '1959-04-24'; // Shortly after launch of Vanguard 2. Sputnik 1 was launched '1957-12-04' but I do not have good data for satellites before Vanguard 2.
const END_DATE = getDayStringFromDate(DateTime.now());

const spaceTrack = new SpaceTrack(credentials);

const run = async (): Promise<void> => {
    const files = fs.readdirSync('resources/raw');

    let curDayString = START_DATE;
    const pullNextFile = async () => {
        curDayString = findNextDateToPull(curDayString, END_DATE, files);
        const nextDayString = incrementDayStringOneDay(curDayString);
        console.log(`Starting fetching data from ${curDayString}`);
        const csv = await spaceTrack.getTLEsForDateRange(curDayString, nextDayString);
        let numResults = 0;
        if (csv !== 'NO RESULTS RETURNED') {
            numResults = csv.split('\n').length - 2;
        }
        console.log(`Retrieved ${numResults} results`);
        console.log('Gzipping data');
        const sizeBeforeGzip = csv.length;
        const gzipped = zlib.gzipSync(csv);
        const sizeAfterGzip = gzipped.length;
        const reduction = Math.round((-(sizeBeforeGzip - sizeAfterGzip) / sizeBeforeGzip) * 100);
        console.log(`Gzip results: before = ${sizeBeforeGzip}, after = ${sizeAfterGzip} (${reduction}%)`);
        const filePath = `resources/raw/${curDayString}.csv.gz`;
        console.log(`Writing data to ${filePath}`);
        fs.writeFileSync(filePath, gzipped);
        console.log(`Done processing ${curDayString}`);
        console.log('===========================\n');
        curDayString = nextDayString;

        if (nextDayString !== END_DATE) {
            setTimeout(pullNextFile, 3 * 1000);
        }
    };
    await pullNextFile();
};

run().then().catch(console.error);
