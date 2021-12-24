import { initializeSatellite, SatelliteData } from './orb';
import SatellitesData from './SatellitesData';

interface DataInstance {
    epoch: number;
    data: SatelliteData;
}

export default class SatellitePositionDataSet {
    private data: DataInstance[] = [];

    public addTLE(epoch: number, line1: string, line2: string): void {
        const dataInstance: DataInstance = {
            epoch,
            data: initializeSatellite({
                name: 'none',
                line1,
                line2,
            }),
        };
        this.data.splice(this.getInsertionIndex(epoch), 0, dataInstance);
    }

    private getInsertionIndex(epoch: number, start = 0, end = this.data.length): number {
        if (end <= start) {
            return start;
        }
        const mid = Math.floor((start + end) / 2);
        const midValue = this.data[mid];
        if (epoch < midValue.epoch) {
            return this.getInsertionIndex(epoch, start, mid);
        } else if (epoch > midValue.epoch) {
            return this.getInsertionIndex(epoch, mid + 1, end);
        } else {
            return mid;
        }
    }

    public getClosestSatelliteData(epoch: number): SatelliteData | null {
        if (this.data.length === 0) {
            return null;
        }
        const insertionIndex = this.getInsertionIndex(epoch);

        // Get valid candidate after or equal to the candidate
        let afterCandidate: DataInstance | null = insertionIndex < this.data.length ? this.data[insertionIndex] : null;
        if (afterCandidate !== null && epoch < afterCandidate.epoch - SatellitesData.TLE_ACCURACY.toMillis()) {
            afterCandidate = null;
        }

        // Get valid candidate before or equal to the candidate
        let beforeCandidate = null;
        if (insertionIndex > 0) {
            beforeCandidate = this.data[insertionIndex - 1];
            if (epoch > beforeCandidate.epoch + SatellitesData.TLE_ACCURACY.toMillis()) {
                beforeCandidate = null;
            }
        }

        // Determine the best candidate
        if (beforeCandidate !== null && afterCandidate !== null) {
            const beforeDifference = Math.abs(epoch - beforeCandidate.epoch);
            const afterDifference = Math.abs(epoch - afterCandidate.epoch);
            if (beforeDifference < afterDifference) {
                return beforeCandidate.data;
            } else {
                return afterCandidate.data;
            }
        } else if (afterCandidate !== null) {
            return afterCandidate.data;
        } else if (beforeCandidate !== null) {
            return beforeCandidate.data;
        } else {
            return null;
        }
    }

    public purge(startTime: number, endTime: number): void {
        const start = this.getInsertionIndex(startTime);
        const end = this.getInsertionIndex(endTime);
        this.data = this.data.slice(start, end + 1);
    }
}
