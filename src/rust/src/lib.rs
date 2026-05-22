use wasm_bindgen::prelude::*;
use image::{DynamicImage, GenericImageView, ImageOutputFormat};
use std::io::Cursor;

/// Struct to hold processed LOD images
#[wasm_bindgen]
pub struct ProcessedLOD {
    tiny: Vec<u8>,      // 128px, JPEG
    preview: Vec<u8>,   // 1024px, JPEG
    high_res: Vec<u8>,  // 2048px, JPEG
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl ProcessedLOD {
    #[wasm_bindgen(getter)]
    pub fn tiny(&self) -> Vec<u8> {
        self.tiny.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn preview(&self) -> Vec<u8> {
        self.preview.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn high_res(&self) -> Vec<u8> {
        self.high_res.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }
}

/// Resize image to fit within max_size and encode to JPEG
fn resize_and_encode(img: &DynamicImage, max_size: u32, quality: u8) -> Vec<u8> {
    let (w, h) = img.dimensions();

    // Only resize if larger than max_size
    let resized = if w > max_size || h > max_size {
        let scale = (max_size as f32) / (w.max(h) as f32);
        let nw = ((w as f32) * scale) as u32;
        let nh = ((h as f32) * scale) as u32;
        img.resize_exact(nw, nh, image::imageops::FilterType::Lanczos3)
    } else {
        img.clone()
    };

    // Encode to JPEG with quality
    let mut buf = Cursor::new(Vec::new());
    resized
        .write_to(&mut buf, ImageOutputFormat::Jpeg(quality))
        .expect("Failed to encode JPEG");
    buf.into_inner()
}

/// Process an image into 3-tier LOD proxies
/// - Tiny: 128px max, JPEG Q60 (for global view, zoom ≤40%)
/// - Preview: 1024px max, JPEG Q80 (for working view, 40-120%)
/// - High-Res: 2048px max, JPEG Q90 (for detail view, >120%)
#[wasm_bindgen]
pub fn process_image_lod(data: &[u8]) -> Result<ProcessedLOD, JsValue> {
    // Set panic hook for better error messages
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    // Load image from bytes
    let img = image::load_from_memory(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to load image: {}", e)))?;

    let (width, height) = img.dimensions();

    // Generate 3 tiers
    let tiny = resize_and_encode(&img, 128, 60);
    let preview = resize_and_encode(&img, 1024, 80);
    let high_res = resize_and_encode(&img, 2048, 90);

    Ok(ProcessedLOD {
        tiny,
        preview,
        high_res,
        width,
        height,
    })
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
