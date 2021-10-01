extern crate wasm_bindgen;
extern crate web_sys;

#[macro_use]
extern crate lazy_static;

use wasm_bindgen::prelude::*;
use std::collections::HashMap;

macro_rules! console_log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

lazy_static! {
    static ref CONSTANTS_BY_NAME: HashMap<u32, (f64, sgp4::Constants<'static>)> = {
        let mut m = HashMap::new();
        let elements = sgp4::Elements::from_tle(
            Some("ISS (ZARYA)".to_owned()),
            "1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995".as_bytes(),
            "2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581".as_bytes(),
        ).unwrap();
        let constants = sgp4::Constants::from_elements(&elements).unwrap();
        m.insert(0, (elements.datetime.timestamp_millis() as f64, constants));
        m
    };
}

#[wasm_bindgen]
pub fn create_vector_array() -> Box<[f64]> {
    let array: Box<[f64]> = Box::new([0.0, 0.0, 0.0]);
    array
}

#[wasm_bindgen]
pub fn propagate(id: u32, timestamp_millis: f64, output: &mut [f64]) -> () {
    let (epoch_millis, constants) = CONSTANTS_BY_NAME.get(&id).unwrap();
    match constants.propagate((timestamp_millis - epoch_millis) / 1000.0 / 60.0) {
        Err(_e) => {},
        Ok(prediction) => {
            console_log!("    r = {:?} km", prediction.position);
            console_log!("    ṙ = {:?} km.s⁻¹", prediction.velocity);
            output[0] = -prediction.position[1] / 1000.0;
            output[1] = prediction.position[2] / 1000.0;
            output[2] = -prediction.position[0] / 1000.0;
        }
    }
}
