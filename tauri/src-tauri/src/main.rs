// Windows subsystem = windows hides the console in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hmsi_lib::run()
}