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
pub fn main(hour: u32) -> f64 {
    return match run(hour) {
        Err(_e) => 0.0,
        Ok(p) => p,
    };
}