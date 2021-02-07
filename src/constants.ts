// Epoch date used in the J2000 Earth Centered Inertial (ECI) coordinate system.
// An epoch is used due to "Precession" (the equinox actually rotates around the world every 25,800 years.
// See: https://en.wikipedia.org/wiki/Equinox_(celestial_coordinates)
export const J2000_EPOCH = new Date(946727935816); // January 1, 2000, 11:58:55.816 UTC

// Amount of time for Earth to revolve around its axis
// See: https://en.wikipedia.org/wiki/Sidereal_time
export const SIDEREAL_DAY_MS = 86_164_091;

// Amount of time for Earth to revolve around the sun with respect to the stars.
// See: https://en.wikipedia.org/wiki/Sidereal_year
export const SIDEREAL_YEAR_MS = 31_558_149_764;

// Angle between rotational axis and orbital axis.
// See: https://en.wikipedia.org/wiki/Axial_tilt
export const AXIAL_TILT_RAD = 0.409044;
