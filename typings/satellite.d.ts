declare module 'satellite.js' {
    export interface SatRec {
        objectName: string;
        objectType: 'DEBRIS' | 'PAYLOAD' | 'ROCKET BODY' | 'TBA';
        rcsSize: 'SMALL' | 'MEDIUM' | 'LARGE';
        countryCode: string;
        site: string;
        launchDate: Date;
        decayDate?: Date;
    }
}
