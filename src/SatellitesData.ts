import SatellitePositionDataSet from './SatellitePositionDataSet';
import { parse } from 'papaparse';
import { log } from './utils';

export type ObjectType = 'DEBRIS' | 'PAYLOAD' | 'ROCKET BODY' | 'TBA';
export type Size = 'LARGE' | 'MEDIUM' | 'SMALL';
export interface Satellite {
    catalogId: string;
    objectId: string | null;
    objectName: string | null;
    objectType: ObjectType;
    size: Size;
    countryCode: string | null;
    launchDate: Date | null;
    launchSite: string | null;
    decayDate: Date | null;
    positionDataSet: SatellitePositionDataSet;
}

interface File {
    name: string;
    startTime: Date;
    endTime: Date;
}

export function getDayStringFromDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function getDateFromDayString(dayString: string): Date {
    const parts = dayString.split('-');
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0));
}

function incrementOneYear(date: Date): Date {
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
}

function incrementThreeMonths(date: Date): Date {
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
}

function incrementOneMonth(date: Date): Date {
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
}

function increment15Days(date: Date): Date {
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
}

export function getNextEndDate(startDate?: Date): Date {
    if (startDate === undefined) {
        return getDateFromDayString('1959-01-01');
    } else if (startDate.getTime() < getDateFromDayString('1970-01-01').getTime()) {
        return incrementOneYear(startDate);
    } else if (startDate.getTime() < getDateFromDayString('1975-01-01').getTime()) {
        return incrementThreeMonths(startDate);
    } else if (startDate.getTime() < getDateFromDayString('1990-01-01').getTime()) {
        return incrementOneMonth(startDate);
    } else {
        return increment15Days(startDate);
    }
}

export default class SatellitesData implements Iterable<Satellite> {
    public static TLE_ACCURACY = 14 * 24 * 60 * 60 * 1000; // 2 weeks
    private static TLE_LOOKAHEAD_BUFFER = 30 * 24 * 60 * 60 * 1000; // 30 days
    private static TLE_PURGE_BUFFER = 366 * 24 * 60 * 60 * 1000; // 1 year
    private static FILES: File[] = [];
    private static PURGE_RATE = 1000;
    private loadedFiles: File[] = [];
    private purgeNumber = 0;
    private satellitesByCatalogId: { [catalogId: string]: Satellite } = {};
    public readonly catalogIds: string[] = [];

    private constructor() {
        if (SatellitesData.FILES.length === 0) {
            let date = getNextEndDate();
            while (date.getTime() <= getDateFromDayString('2021-09-30').getTime()) {
                const nextDate = getNextEndDate(date);
                SatellitesData.FILES.push({
                    name: getDayStringFromDate(date),
                    startTime: date,
                    endTime: nextDate,
                });
                date = nextDate;
            }
        }
    }

    public static async loadRemoteSatellites(): Promise<SatellitesData> {
        const satellites = new SatellitesData();
        await new Promise(async (resolve, reject) => {
            const response = await fetch(`${window.location.protocol}//${window.location.host}/resources/filtered/satellites.csv`, {
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
                        launchDate: getDateFromDayString(data[6]),
                        launchSite: data[7],
                        decayDate: getDateFromDayString(data[8]),
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

    public async loadTLEs(epoch: Date): Promise<void> {
        const epochTime = epoch.getTime();
        const startTime = epochTime;
        const endTime = epochTime + SatellitesData.TLE_LOOKAHEAD_BUFFER;

        const startIndex = this.getMatchingFileIndex(startTime);
        const endIndex = this.getMatchingFileIndex(endTime);
        for (let i = startIndex; i < endIndex; i++) {
            const file = SatellitesData.FILES[i];
            const hasLoadedFile = this.loadedFiles.find((loadedFile) => loadedFile.name === file.name) !== undefined;
            if (!hasLoadedFile) {
                this.loadedFiles.push({ ...file });
                await this.loadTLEsFile(file);
            }
        }
    }

    private getMatchingFileIndex(epoch: number, start = 0, end = SatellitesData.FILES.length): number {
        if (end <= start) {
            return start;
        }
        const mid = Math.floor((start + end) / 2);
        const midValue = SatellitesData.FILES[mid];
        if (epoch < midValue.startTime.getTime()) {
            return this.getMatchingFileIndex(epoch, start, mid - 1);
        } else if (epoch > midValue.endTime.getTime()) {
            return this.getMatchingFileIndex(epoch, mid + 1, end);
        } else {
            return mid;
        }
    }

    private async loadTLEsFile(file: File): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const response = await fetch(`${window.location.protocol}//${window.location.host}/resources/filtered/${file.name}.csv`, {
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

    public purge(epoch: Date): void {
        const epochTime = epoch.getTime();
        const startTime = epochTime - SatellitesData.TLE_ACCURACY;
        const endTime = epochTime + SatellitesData.TLE_PURGE_BUFFER + SatellitesData.TLE_ACCURACY;

        // Purge loaded files
        this.loadedFiles = this.loadedFiles.filter((loadedFile) => {
            return startTime <= loadedFile.endTime.getTime() && endTime >= loadedFile.startTime.getTime();
        });

        // Purge position data
        this.purgeNumber = (this.purgeNumber + 1) % SatellitesData.PURGE_RATE;
        for (let i = this.purgeNumber; i < this.length; i += SatellitesData.PURGE_RATE) {
            const satellite = this.getSatellite(this.catalogIds[i]);
            satellite.positionDataSet.purge(startTime, endTime);
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
