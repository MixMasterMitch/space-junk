import SatellitePositionDataSet from './SatellitePositionDataSet';
import { parse } from 'papaparse';
import { DateTime, Duration } from 'luxon';
import { getDateFromDayString, getDayStringFromDate, getNextEndDate } from './dateUtils';

export type ObjectType = 'DEBRIS' | 'PAYLOAD' | 'ROCKET BODY' | 'TBA';
export type Size = 'LARGE' | 'MEDIUM' | 'SMALL';
export interface Satellite {
    catalogId: string;
    objectId: string | null;
    objectName: string | null;
    objectType: ObjectType;
    size: Size;
    countryCode: string | null;
    launchDateTime: number | null;
    launchSite: string | null;
    decayDateTime: number | null;
    positionDataSet: SatellitePositionDataSet;
}

interface File {
    name: string;
    startDateTime: DateTime;
    endDateTime: DateTime;
}

export default class SatellitesData implements Iterable<Satellite> {
    public static TLE_ACCURACY = Duration.fromObject({ weeks: 2 });
    private static TLE_LOOKAHEAD_BUFFER = Duration.fromObject({ days: 30 });
    private static TLE_PURGE_BUFFER = Duration.fromObject({ years: 1 });
    private static FILES: File[] = [];
    private static PURGE_RATE = 1000;
    private loadedFiles: File[] = [];
    private purgeNumber = 0;
    private satellitesByCatalogId: { [catalogId: string]: Satellite } = {};
    public readonly catalogIds: string[] = [];

    private constructor() {
        if (SatellitesData.FILES.length === 0) {
            let dateTime = getNextEndDate();
            while (dateTime <= getDateFromDayString('2021-12-14')) {
                const nextDate = getNextEndDate(dateTime);
                SatellitesData.FILES.push({
                    name: getDayStringFromDate(dateTime),
                    startDateTime: dateTime,
                    endDateTime: nextDate,
                });
                dateTime = nextDate;
            }
        }
    }

    public static async loadRemoteSatellites(): Promise<SatellitesData> {
        const satellites = new SatellitesData();
        await new Promise(async (resolve, reject) => {
            const response = await fetch(`${window.location.protocol}//${window.location.host}/resources/filtered/satellites.csv.gz`, {
                method: 'GET',
            });
            parse(await response.text(), {
                header: false,
                delimiter: ',',
                step: (row) => {
                    const data = row.data as string[];
                    if (data.length <= 1) {
                        return; // Last line of file
                    }
                    const objectType = data[3] as ObjectType;
                    let size = data[4] as Size | '';
                    if (size === '') {
                        size = objectType === 'DEBRIS' ? 'SMALL' : 'LARGE';
                    }
                    const satellite: Satellite = {
                        catalogId: data[0],
                        objectId: data[1],
                        objectName: data[2],
                        objectType,
                        size,
                        countryCode: data[5],
                        launchDateTime: data[6] === '' ? null : getDateFromDayString(data[6]).toMillis(),
                        launchSite: data[7],
                        decayDateTime: data[8] === '' ? null : getDateFromDayString(data[8]).endOf('day').toMillis(),
                        positionDataSet: new SatellitePositionDataSet(),
                    };
                    satellites.addSatellite(satellite);
                },
                complete: () => {
                    resolve(satellites);
                },
                error: reject,
            });
        });
        return satellites;
    }

    private addSatellite(satellite: Satellite): void {
        if (this.satellitesByCatalogId[satellite.catalogId] === undefined) {
            this.catalogIds.push(satellite.catalogId);
        }
        this.satellitesByCatalogId[satellite.catalogId] = satellite;
    }

    public getSatellite(catalogId: string): Satellite {
        return this.satellitesByCatalogId[catalogId];
    }

    public get length(): number {
        return this.catalogIds.length;
    }

    public async loadTLEs(epoch: DateTime): Promise<void> {
        const startTime = epoch;
        const endTime = epoch.plus(SatellitesData.TLE_LOOKAHEAD_BUFFER);

        const startIndex = this.getMatchingFileIndex(startTime);
        const endIndex = Math.min(startIndex, Math.max(SatellitesData.FILES.length - 1, this.getMatchingFileIndex(endTime)));
        for (let i = startIndex; i <= endIndex; i++) {
            const file = SatellitesData.FILES[i];
            const hasLoadedFile = this.loadedFiles.find((loadedFile) => loadedFile.name === file.name) !== undefined;
            if (!hasLoadedFile) {
                this.loadedFiles.push({ ...file });
                await this.loadTLEsFile(file);
            }
        }
    }

    private getMatchingFileIndex(epoch: DateTime, start = 0, end = SatellitesData.FILES.length): number {
        if (end <= start) {
            return start;
        }
        const mid = Math.floor((start + end) / 2);
        const midValue = SatellitesData.FILES[mid];
        if (epoch < midValue.startDateTime) {
            return this.getMatchingFileIndex(epoch, start, mid - 1);
        } else if (epoch > midValue.endDateTime) {
            return this.getMatchingFileIndex(epoch, mid + 1, end);
        } else {
            return mid;
        }
    }

    private async loadTLEsFile(file: File): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const response = await fetch(`${window.location.protocol}//${window.location.host}/resources/filtered/${file.name}.csv.gz`, {
                method: 'GET',
            });
            parse(await response.text(), {
                header: false,
                delimiter: ',',
                step: (row) => {
                    const data = row.data as string[];
                    if (data.length <= 1) {
                        return; // Last line of file
                    }
                    const catalogId = data[0];
                    const epoch = parseInt(data[1]);
                    const line1 = data[3];
                    const line2 = data[4];
                    this.getSatellite(catalogId).positionDataSet.addTLE(epoch, line1, line2);
                },
                complete: () => {
                    resolve();
                },
                error: reject,
            });
        });
    }

    public purge(epoch: DateTime): void {
        const startTime = epoch.minus(SatellitesData.TLE_ACCURACY);
        const endTime = epoch.plus(SatellitesData.TLE_PURGE_BUFFER).plus(SatellitesData.TLE_ACCURACY);

        // Purge loaded files
        this.loadedFiles = this.loadedFiles.filter((loadedFile) => {
            return startTime <= loadedFile.endDateTime && endTime >= loadedFile.startDateTime;
        });

        // Purge position data
        this.purgeNumber = (this.purgeNumber + 1) % SatellitesData.PURGE_RATE;
        for (let i = this.purgeNumber; i < this.length; i += SatellitesData.PURGE_RATE) {
            const satellite = this.getSatellite(this.catalogIds[i]);
            satellite.positionDataSet.purge(startTime.toMillis(), endTime.toMillis());
        }
    }

    [Symbol.iterator](): Iterator<Satellite> {
        let index = -1;

        return {
            next: () => ({
                value: this.getSatellite(this.catalogIds[++index]),
                done: !(index in this.catalogIds),
            }),
        };
    }
}
