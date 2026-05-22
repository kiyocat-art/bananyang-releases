use std::io::{Cursor, Read};
use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;

/// Extract thumbnail.png bytes from a .nyang ZIP container.
/// Returns None if the bytes are not a valid ZIP or thumbnail.png is missing.
pub fn extract_thumbnail_png(zip_bytes: &[u8]) -> Option<Vec<u8>> {
    // Verify ZIP magic: PK\x03\x04
    if zip_bytes.len() < 4
        || zip_bytes[0] != 0x50
        || zip_bytes[1] != 0x4B
        || zip_bytes[2] != 0x03
        || zip_bytes[3] != 0x04
    {
        return None;
    }

    let cursor = Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).ok()?;
    let mut entry = archive.by_name("thumbnail.png").ok()?;

    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry.read_to_end(&mut buf).ok()?;
    Some(buf)
}

/// Decode PNG bytes to a 32-bpp top-down HBITMAP with premultiplied BGRA.
/// cx is the requested square size from Windows; we scale to fit while preserving aspect ratio.
pub fn png_to_hbitmap(png_bytes: &[u8], cx: u32) -> Result<HBITMAP> {
    use image::{ImageReader, imageops};

    let img = ImageReader::new(Cursor::new(png_bytes))
        .with_guessed_format()
        .map_err(|_| Error::from(E_FAIL))?
        .decode()
        .map_err(|_| Error::from(E_FAIL))?
        .to_rgba8();

    // Scale to requested size preserving aspect ratio
    let (orig_w, orig_h) = img.dimensions();
    let (out_w, out_h) = if cx == 0 || (orig_w == 0 || orig_h == 0) {
        (orig_w, orig_h)
    } else {
        let scale = (cx as f32) / (orig_w.max(orig_h) as f32);
        let w = ((orig_w as f32 * scale).round() as u32).max(1);
        let h = ((orig_h as f32 * scale).round() as u32).max(1);
        (w, h)
    };

    let img = if out_w != orig_w || out_h != orig_h {
        imageops::resize(&img, out_w, out_h, imageops::FilterType::Triangle)
    } else {
        img
    };

    let (w, h) = img.dimensions();

    // Convert RGBA → BGRA premultiplied (Windows DIB expects premultiplied BGRA)
    let mut bgra = vec![0u8; (w * h * 4) as usize];
    for (i, px) in img.pixels().enumerate() {
        let [r, g, b, a] = px.0;
        let af = a as f32 / 255.0;
        bgra[i * 4]     = (b as f32 * af) as u8;
        bgra[i * 4 + 1] = (g as f32 * af) as u8;
        bgra[i * 4 + 2] = (r as f32 * af) as u8;
        bgra[i * 4 + 3] = a;
    }

    // Create 32-bpp top-down DIB section
    let bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w as i32,
            biHeight: -(h as i32), // negative = top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        bmiColors: [RGBQUAD::default()],
    };

    let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
    let hbmp = unsafe {
        CreateDIBSection(
            HDC::default(),
            &bmi,
            DIB_RGB_COLORS,
            &mut bits,
            HANDLE::default(),
            0,
        )?
    };

    if !bits.is_null() {
        unsafe {
            std::ptr::copy_nonoverlapping(bgra.as_ptr(), bits as *mut u8, bgra.len());
        }
    }

    Ok(hbmp)
}
