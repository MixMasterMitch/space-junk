import * as React from 'react';
import { findDOMNode, render } from 'react-dom';
import { CSSProperties, FunctionComponent, RefObject, useEffect, useRef, useState } from 'react';
import Timeout = NodeJS.Timeout;
import { WebGLRenderer } from 'three';
import { DefaultEventMap, EventEmitter } from 'tsee';
import { DateTime, DateTimeUnit, Duration, DurationUnit } from 'luxon';
import { SatelliteStats } from './animation/Satellites';
import Color from './animation/Color';

const START_DATE = DateTime.fromISO('1959-01-01T00:00:00.000Z').toUTC();
const END_DATE = DateTime.fromISO('2021-12-22T00:00:00.000Z').toUTC();
const TIMELINE_MIN_RANGE = Duration.fromObject({ days: 45 });
const ZOOM_RATE = 0.001;

const titleStyle: CSSProperties = {
    margin: 0,
    padding: 'calc(2% + 1rem)',
    paddingBottom: 0,
};

const hoverPromptStyle: CSSProperties = {
    fontSize: '0.5rem',
};

const statsStyle: CSSProperties = {
    pointerEvents: 'auto',
    padding: '1rem calc(2% + 1rem)',
    lineHeight: '1.3',
};

const legendTitleStyle: CSSProperties = {
    fontWeight: 900,
    marginTop: '0.5rem',
};

const legendColorStyle: CSSProperties = {
    width: '0.8rem',
    height: '0.8rem',
    borderRadius: '0.4rem',
    display: 'inline-block',
    marginRight: '0.2rem',
};

const timelineContainerStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    margin: 'calc(2% + 1rem)',
    width: 'calc(100% - 4% - 2rem)',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    cursor: 'default',
    paddingTop: '1rem',
};

const timelineMarkersContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
};

const timelineLabelsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: '1rem',
};

const yearMarkerContainerStyle: CSSProperties = {
    borderLeft: '1px solid white',
};
const yearLabelStyle: CSSProperties = {
    position: 'relative',
    width: 0,
};
const yearLabelInnerStyle: CSSProperties = {
    position: 'absolute',
    width: '100%',
    marginLeft: '-50%',
    display: 'flex',
    justifyContent: 'center',
};

const dateMarkerContainerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    top: 0,
};

const dateMarkerStyle: CSSProperties = {
    borderLeft: '1px solid gray',
    height: '2rem',
};

const dateContainerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    top: '-1.5rem',
};

export interface UIEvents extends DefaultEventMap {
    dateTick: (date: DateTime) => void;
    dateReset: (date: DateTime) => void;
    satelliteStatsUpdate: (stats: SatelliteStats) => void;
}

interface UIProps {
    eventBus: EventEmitter<UIEvents>;
}
const UI: FunctionComponent<UIProps> = ({ eventBus }) => {
    const timelineElement = useRef<HTMLDivElement>(null);
    const dateElement = useRef<HTMLDivElement>(null);
    const [startDateTime, setStartDateTime] = useState<DateTime>(START_DATE);
    const [endDateTime, setEndDateTime] = useState<DateTime>(END_DATE);
    const [currentDate, setCurrentDateTime] = useState<DateTime>();
    const [hoverPercent, setHoverPercent] = useState<number | null>(null);
    const [satelliteStats, setSatelliteStats] = useState<SatelliteStats>({
        large: 0,
        medium: 0,
        small: 0,
        payload: 0,
        rocketBody: 0,
        debris: 0,
        starlink: 0,
        gps: 0,
        leo: 0,
        geo: 0,
        total: 0,
    });
    const [hoverStats, setHoverStats] = useState<boolean>(false);
    useEffect(() => {
        eventBus.addListener('dateTick', (date) => {
            setCurrentDateTime(date);
        });
        eventBus.addListener('satelliteStatsUpdate', (stats) => {
            setSatelliteStats(stats);
        });
    }, []);

    let dateTime = END_DATE;
    let percent = 1;
    const dateRange = endDateTime.diff(startDateTime);
    const dateRangeMillis = dateRange.toMillis();
    if (hoverPercent !== null) {
        const duration = Duration.fromMillis(dateRangeMillis * hoverPercent);
        dateTime = startDateTime.plus(duration);
        percent = dateTime.diff(startDateTime).toMillis() / dateRangeMillis;
    } else if (currentDate !== undefined) {
        dateTime = currentDate;
        if (dateTime > endDateTime) {
            percent = 1;
        } else if (dateTime < startDateTime) {
            percent = 0;
        } else {
            percent = dateTime.diff(startDateTime).toMillis() / dateRangeMillis;
        }
    }
    let dateMarkerOffset = 0;
    if (timelineElement.current !== null) {
        dateMarkerOffset = timelineElement.current.offsetWidth * percent;
    }

    const { width: timelineWidth } = getElementWidthAndOffset(timelineElement);
    const { width: dateWidth } = getElementWidthAndOffset(dateElement);
    const dateOffset = Math.max(0, Math.min(dateMarkerOffset - dateWidth / 2, timelineWidth - dateWidth - 1));
    // log(offset);

    let unit: DateTimeUnit = 'year';
    let durationUnit: DurationUnit = 'years';
    if (dateRange < Duration.fromObject({ years: 10 })) {
        unit = 'month';
        durationUnit = 'months';
    }
    if (dateRange < Duration.fromObject({ years: 1 })) {
        unit = 'day';
        durationUnit = 'days';
    }
    // const start = startDateTime.get(unit);
    // const count = getDiffCount(startDateTime, endDateTime, unit);
    const markers = [];
    const labels = [];
    // const startPercentage = 1 - getPercentageOfUnit(startDateTime, unit);
    // const endPercentage = getPercentageOfUnit(endDateTime, unit);
    let currDateTime = startDateTime;
    let nextDateTime;
    while (currDateTime < endDateTime) {
        const key = unit + currDateTime.toMillis();
        let markerVisible = true;
        if (currDateTime === startDateTime) {
            nextDateTime = currDateTime.endOf(unit).plus({ milliseconds: 1 });
            markerVisible = currDateTime.startOf(unit) === startDateTime;
        } else {
            nextDateTime = currDateTime.plus({ [durationUnit]: 1 });
            if (nextDateTime > endDateTime) {
                nextDateTime = endDateTime;
            }
        }
        const numHours = nextDateTime.diff(currDateTime).as('hours');
        let isMajorMarker = false;
        let label: string | number = '';
        if (unit === 'year') {
            const year = currDateTime.year;
            isMajorMarker = year % 10 === 0;
            label = year;
        } else if (unit === 'month') {
            const year = currDateTime.year;
            const month = currDateTime.month;
            isMajorMarker = month === 1;
            label = year;
        } else if (unit === 'day') {
            const day = currDateTime.day;
            isMajorMarker = day === 1;
            label = currDateTime.monthShort;
        }

        markers.push(
            <div
                key={key}
                style={{ ...yearMarkerContainerStyle, flex: numHours, borderLeftWidth: markerVisible ? 1 : 0, height: isMajorMarker ? '1rem' : '0.5rem' }}
            />,
        );
        labels.push(
            <div key={key} style={{ ...yearLabelStyle, flex: numHours }}>
                <div style={yearLabelInnerStyle}>{markerVisible && isMajorMarker ? label : ''}</div>
            </div>,
        );

        currDateTime = nextDateTime;
    }
    return (
        <div>
            <h1 style={titleStyle}>Space Junk</h1>
            <div style={statsStyle} onMouseEnter={() => setHoverStats(true)} onMouseLeave={() => setHoverStats(false)}>
                <div>Number of satellites displayed: {satelliteStats.total}</div>
                {hoverStats ? (
                    <>
                        <div>
                            Large satellites ({'>'}1 m<sup>2</sup> cross-section): {satelliteStats.large}
                        </div>
                        <div>
                            Medium satellites (.1 m<sup>2</sup> - 1 m<sup>2</sup> cross-section): {satelliteStats.medium}
                        </div>
                        <div>
                            Small satellites ({'<'}.1 m<sup>2</sup> cross-section): {satelliteStats.small}
                        </div>
                        <div>Payload satellites: {satelliteStats.payload}</div>
                        <div>Rocket bodies: {satelliteStats.rocketBody}</div>
                        <div>Debris satellites: {satelliteStats.debris}</div>
                        <div>Starlink satellites: {satelliteStats.starlink}</div>
                        <div>GPS satellites: {satelliteStats.gps}</div>
                        <div>
                            Low Earth orbit satellites ({'<'} 3,000 km altitude): {satelliteStats.leo}
                        </div>
                        <div>Geosynchronous orbit satellites (35,786 km altitude): {satelliteStats.geo}</div>
                        <div style={legendTitleStyle}>Legend</div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.SKY_BLUE.HEX }} />
                            ISS
                        </div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.ORANGE.HEX }} />
                            Hubble
                        </div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.PURPLE.HEX }} />
                            Starlink
                        </div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.GREEN.HEX }} />
                            GPS
                        </div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.YELLOW.HEX }} />
                            Other Satellite
                        </div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.BLUE.HEX }} />
                            Rocket Body
                        </div>
                        <div>
                            <span style={{ ...legendColorStyle, backgroundColor: Color.RED.HEX }} />
                            Debris
                        </div>
                    </>
                ) : (
                    <div style={hoverPromptStyle}>Hover for more details</div>
                )}
            </div>
            <div
                style={timelineContainerStyle}
                ref={timelineElement}
                onWheel={(e) => {
                    if (hoverPercent === null) {
                        return;
                    }
                    const dateRangeDuration = endDateTime.diff(startDateTime);
                    if (dateRangeDuration <= TIMELINE_MIN_RANGE && e.deltaY < 0) {
                        return;
                    }
                    const baseRangeChange = dateRangeMillis * ZOOM_RATE * e.deltaY;
                    setStartDateTime(DateTime.fromMillis(Math.max(START_DATE.toMillis(), startDateTime.toMillis() - hoverPercent * baseRangeChange)));
                    setEndDateTime(DateTime.fromMillis(Math.min(END_DATE.toMillis(), endDateTime.toMillis() + (1 - hoverPercent) * baseRangeChange)));
                }}
                onMouseLeave={() => setHoverPercent(null)}
                onMouseMove={(e) => {
                    if (timelineElement.current !== null) {
                        const clickPosition = e.nativeEvent.clientX;
                        const { width: elementWidth, offset: elementEdgePosition } = getElementWidthAndOffset(timelineElement);
                        const percent = Math.max(0, Math.min(1, (clickPosition - elementEdgePosition) / elementWidth));
                        setHoverPercent(percent);
                    }
                }}
                onClick={() => eventBus.emit('dateReset', dateTime)}
            >
                <div style={timelineMarkersContainerStyle}>{markers}</div>
                <div style={timelineLabelsContainerStyle}>{labels}</div>
                <div style={{ ...dateMarkerContainerStyle, left: `${dateMarkerOffset}px` }}>
                    <div style={dateMarkerStyle} />
                </div>
                <div style={{ ...dateContainerStyle, left: `${dateOffset}px` }}>
                    <div ref={dateElement}>{dateTime.toFormat('hh:mm a ZZZZ MMM dd, yyyy')}</div>
                </div>
            </div>
        </div>
    );
};

function getElementWidthAndOffset(ref: RefObject<HTMLDivElement>): { width: number; offset: number } {
    if (ref.current === null) {
        return { width: 0, offset: 0 };
    }
    const element = findDOMNode(ref.current) as Element;
    return { width: ref.current.offsetWidth, offset: element.getBoundingClientRect().x };
}

export const uiEventBus = new EventEmitter<UIEvents>();

export function startUI(renderer: WebGLRenderer): EventEmitter<UIEvents> {
    const rootElement = document.getElementById('react-root') as HTMLElement;
    const controlsElement = document.getElementById('controls-container') as HTMLElement;

    let hideUITimeout: Timeout;
    const resetHideUITimeout = () => {
        clearTimeout(hideUITimeout);
        hideUITimeout = setTimeout(() => {
            renderer.domElement.className = renderer.domElement.className.replace('show-cursor', 'hide-cursor');
            rootElement.className = 'fade-out';
            controlsElement.className = 'fade-out';
        }, 3000);
    };
    const handleMouseMove = () => {
        renderer.domElement.className = renderer.domElement.className.replace('hide-cursor', 'show-cursor');
        rootElement.className = 'fade-in';
        controlsElement.className = 'fade-in';
        resetHideUITimeout();
    };
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    rootElement.addEventListener('mousemove', handleMouseMove);
    rootElement.addEventListener('wheel', resetHideUITimeout);

    render(<UI eventBus={uiEventBus} />, rootElement);
    return uiEventBus;
}
