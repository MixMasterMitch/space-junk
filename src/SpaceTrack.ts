import request from 'request';

interface Credentials {
    username: string;
    password: string;
}

export default class SpaceTrack {
    private static readonly BASE_URL = 'https://www.space-track.org';
    private readonly credentials: Credentials;
    private readonly cookieJar = request.jar();
    private activeLoginAttempt = Promise.resolve();

    constructor(credentials: Credentials) {
        this.credentials = credentials;
    }

    public async getTLEsForDateRange(startDayString: string, endDayString: string): Promise<string> {
        await this.loginIfNeeded();

        return new Promise((resolve, reject) => {
            const url = `${SpaceTrack.BASE_URL}/basicspacedata/query/class/gp_history/EPOCH/${startDayString}--${endDayString}/orderby/EPOCH/emptyresult/show/format/csv`;

            request(
                url,
                {
                    jar: this.cookieJar,
                },
                (err, res, body) => {
                    if (err) {
                        return reject(err);
                    }

                    if (res.statusCode !== 200) {
                        return reject(`Failed to fetch from SpaceTrack. Status code: ${res.statusCode}`);
                    }

                    // console.log(body);
                    return resolve(body);
                },
            );
        });
    }

    private async loginIfNeeded(): Promise<void> {
        // If we are already logging in, then wait for that login attempt
        await this.activeLoginAttempt;

        // If we already have a valid login cookie, return early
        // console.log(this.cookieJar.getCookies(SpaceTrack.BASE_URL));
        const spaceTrackCookies = this.cookieJar.getCookies(SpaceTrack.BASE_URL);
        if (spaceTrackCookies.length > 0 && Date.now() + 1000 < (spaceTrackCookies[0].expires as Date).getTime()) {
            return Promise.resolve();
        }

        // Login
        console.log('Logging into SpaceTrack');
        this.activeLoginAttempt = new Promise((resolve, reject) => {
            request.post(
                SpaceTrack.BASE_URL + '/ajaxauth/login',
                {
                    form: {
                        identity: this.credentials.username,
                        password: this.credentials.password,
                    },
                    jar: this.cookieJar,
                    json: true,
                },
                (err, res, body) => {
                    if (err) {
                        return reject(err);
                    } else if (res.statusCode !== 200) {
                        return reject(body);
                    }
                    return resolve();
                },
            );
        });
        return this.activeLoginAttempt;
    }
}
