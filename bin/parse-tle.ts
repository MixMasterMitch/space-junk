import parse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { SatRec, twoline2satrec } from 'satellite.js';
import { parseSatRecProtobufs, parseSatRecTLE } from '../src/io';

import { Satellites, ISatellite } from 'generated/protobuf';

const outDir = path.join('generated', 'resources');
const outFile = path.join(outDir, 'satellites.buf');

interface ParsedTLEs {
    protobufParsed: ISatellite[];
    satelliteJSParsed: SatRec[];
}
const parseTLEs = async (): Promise<ParsedTLEs> => {
    const protobufParsed = [];
    const satelliteJSParsed = [];
    const parser = fs.createReadStream(`resources/tle.csv`).pipe(parse({ delimiter: ',', fromLine: 2 }));
    for await (const record of parser) {
        const satrec = twoline2satrec(record[0], record[1]);
        satelliteJSParsed.push(satrec);
        const satellite = parseSatRecTLE(record[0], record[1]);
        protobufParsed.push(satellite);
        // break;
    }
    return { protobufParsed, satelliteJSParsed };
};

(async () => {
    const startTime = Date.now();
    console.log(`Parsing TLEs...`);
    const { protobufParsed, satelliteJSParsed } = await parseTLEs();
    console.log(`Parsed TLEs. Found ${protobufParsed.length}`);
    console.log(Date.now() - startTime);

    console.log(`Writing satellites protobuf to: ${outFile}`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, Satellites.encode({ satellites: protobufParsed }).finish());
    console.log('Done writing satellites protobuf.');

    console.log('Parsing satellites protobuf to validate correctness...');
    const readBuffer = fs.readFileSync(outFile);
    const satRecs = parseSatRecProtobufs(readBuffer);
    console.log(`Parsed ${satRecs.length} satellites.`);
    assert.strictEqual(satRecs.length, satelliteJSParsed.length, 'Number of satellites parsed from the protobuf does not match the number of parsed TLEs.');
    console.log(JSON.stringify(satelliteJSParsed[0], Object.keys(satelliteJSParsed[0]).sort()));
    console.log(JSON.stringify(satRecs[0], Object.keys(satRecs[0]).sort()));
    assert.deepStrictEqual(satRecs, satelliteJSParsed, 'Satellites parsed from the protobuf do not match the parsed TLEs.');
    console.log('Done parsing and validating satellites protobuf.');
})();
