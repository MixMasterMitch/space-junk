// Epoch date used in the J2000 Earth Centered Inertial (ECI) coordinate system.
// An epoch is used due to "Precession" (the equinox actually rotates around the world every 25,800 years).
// See: https://en.wikipedia.org/wiki/Equinox_(celestial_coordinates)
export const J2000_EPOCH = new Date(946727935816); // January 1, 2000, 11:58:55.816 UTC

// Distance from the sun to Neptune (in model units)
// See: https://en.wikipedia.org/wiki/Solar_System
export const SOLAR_SYSTEM_RADIUS = 4_500_000;
