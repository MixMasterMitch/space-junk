extern crate wasm_bindgen;
extern crate web_sys;

use wasm_bindgen::prelude::*;

macro_rules! console_log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

fn run(hour: u32) -> sgp4::Result<f64> {
    let elements = sgp4::Elements::from_tle(
        Some("ISS (ZARYA)".to_owned()),
        "1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992".as_bytes(),
        "2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008".as_bytes(),
    )?;
    let constants = sgp4::Constants::from_elements(&elements)?;

    let prediction = constants.propagate((hour * 60) as f64)?;
    console_log!("    r = {:?} km", prediction.position);
    console_log!("    ṙ = {:?} km.s⁻¹", prediction.velocity);
    Ok(prediction.position[0])
}

#[wasm_bindgen]
pub fn create_satellite(name: String, launch_time: u64, crash_time: Option<u64>) {
    let sat = Satellite {
        name,
        launch_time,
        crash_time
    };
    // return match run(0) {
    //     Err(_e) => 0.0,
    //     Ok(p) => p,
    // };
}

#[wasm_bindgen]
pub fn add_tle(satellite_name: String, line_1: String, line_2: String) {
    let elements = sgp4::Elements::from_tle(
        Some(satellite_name),
        line_1.as_bytes(),
        line_2.as_bytes(),
    );
    let constants = sgp4::Constants::from_elements(&elements)?;
    let mut state = constants.initial_state();
    let sat_state = SatelliteState {
        elements,
        constants,
        state
    };
}

pub struct SatelliteState<'a> {
    elements: sgp4::Elements,
    constants: sgp4::Constants<'a>,
    state: Option<sgp4::ResonanceState>,
}

pub struct Satellite {
    name: String,
    launch_time: u64,
    crash_time: Option<u64>,
}

// #[wasm_bindgen]
// pub struct Foo {
//     contents: String,
// }
//
// #[wasm_bindgen]
// impl Foo {
//     #[wasm_bindgen(constructor)]
//     pub fn new() -> Foo {
//         Foo { contents: "Test".to_string() }
//     }
//
//     pub fn get_contents(&self) -> String {
//         self.contents
//     }
// }