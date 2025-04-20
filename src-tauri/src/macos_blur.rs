#[cfg(target_os = "macos")]
pub fn apply_macos_blur(window: &winit::window::Window) {
    use cocoa::appkit::NSVisualEffectView;
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSRect;
    use objc::{msg_send, sel, sel_impl};
    use raw_window_handle::{HasRawWindowHandle, RawWindowHandle};

    println!("Starting blur application...");

    unsafe {
        println!("Getting raw window handle...");
        let ns_view: id = match window.raw_window_handle() {
            Ok(RawWindowHandle::AppKit(handle)) => {
                println!("Got AppKit handle");
                handle.ns_view.as_ptr() as id
            }
            _ => {
                eprintln!("Failed to get AppKit handle");
                return;
            }
        };

        println!("Checking if ns_view is null...");
        if ns_view.is_null() {
            eprintln!("ns_view is null!");
            return;
        }
        println!("ns_view is valid");

        println!("Getting subviews...");
        let subviews: id = msg_send![ns_view, subviews];
        println!("Getting subview count...");
        let count: usize = msg_send![subviews, count];
        println!("Found {} subviews", count);

        for i in 0..count {
            println!("Checking subview {}", i);
            let subview: id = msg_send![subviews, objectAtIndex: i];
            println!("Getting class for subview {}", i);
            let class: id = msg_send![subview, class];
            println!("Subview {} checked", i);
        }
        
        println!("Subview check complete");

        
    }
    println!("Blur application complete");
}