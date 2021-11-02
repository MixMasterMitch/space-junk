import { DateTime, Duration } from 'luxon';

export function getDayStringFromDate(dateTime: DateTime): string {
    return dateTime.toISODate();
}

export function getDateFromDayString(dayString: string): DateTime {
    const parts = dayString.split('-');
    return DateTime.utc(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
}

function incrementOneYear(dateTime: DateTime): DateTime {
    return dateTime.plus(Duration.fromObject({ years: 1 }));
}

function incrementThreeMonths(dateTime: DateTime): DateTime {
    return dateTime.plus(Duration.fromObject({ months: 3 }));
}

function incrementOneMonth(dateTime: DateTime): DateTime {
    return dateTime.plus(Duration.fromObject({ months: 1 }));
}

function increment15Days(dateTime: DateTime): DateTime {
    return dateTime.plus(Duration.fromObject({ days: 15 }));
}

export function getNextEndDate(startDateTime?: DateTime): DateTime {
    if (startDateTime === undefined) {
        return getDateFromDayString('1959-01-01');
    } else if (startDateTime < getDateFromDayString('1970-01-01')) {
        return incrementOneYear(startDateTime);
    } else if (startDateTime < getDateFromDayString('1975-01-01')) {
        return incrementThreeMonths(startDateTime);
    } else if (startDateTime < getDateFromDayString('1990-01-01')) {
        return incrementOneMonth(startDateTime);
    } else {
        return increment15Days(startDateTime);
    }
}
