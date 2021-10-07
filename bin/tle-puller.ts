import fs from 'fs';
import zlib from 'zlib';

import credentials from '../spaceTrackCreds.json';

import SpaceTrack from '../src/SpaceTrack';

const getDayStringFromDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const getDateFromDayString = (dayString: string): Date => {
    const parts = dayString.split('-');
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0, 0));
};

const incrementOneDay = (date: Date): Date => {
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
};

const incrementDayStringOneDay = (dateString: string): string => {
    const inputDate = getDateFromDayString(dateString);
    const outputDate = incrementOneDay(inputDate);
    return getDayStringFromDate(outputDate);
};

const findNextDateToPull = (startDayString: string, endDayString: string, existingFiles: string[]): string => {
    let curDayString = startDayString;
    while (existingFiles.includes(curDayString + '.csv.gz') && curDayString !== endDayString) {
        curDayString = incrementDayStringOneDay(curDayString);
    }
    return curDayString;
};

const START_DATE = '1959-04-24'; // Shortly after launch of Vanguard 2. Sputnik 1 was launched '1957-12-04' but I do not have good data for satellites before Vanguard 2.
const END_DATE = getDayStringFromDate(new Date());

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
            numResults = csv.split('\n').length;
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

    // await new SpaceTrack(credentials).getTLEsForDateRange('2020-01-01', '2020-01-08');
    // console.log(await new SpaceTrack(credentials).getTLEsForDateRange('1958-02-01', '1959-09-26'));

    // await new SpaceTrack(credentials).getTLEsForDateRange(curDayString, incrementDayStringOneDay(curDayString));
};

run().then().catch(console.error);
