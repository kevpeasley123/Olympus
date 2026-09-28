// Release builds run without a console window; debug builds keep one for the startup logs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    project_olympus_lib::run();
}
