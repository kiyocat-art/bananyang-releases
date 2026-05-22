use std::sync::Mutex;
use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::HBITMAP;
use windows::Win32::System::Com::{IStream, STREAM_SEEK_SET};
use windows::Win32::UI::Shell::{IThumbnailProvider, IThumbnailProvider_Impl, WTS_ALPHATYPE, WTSAT_ARGB};
use windows::Win32::UI::Shell::PropertiesSystem::{IInitializeWithStream, IInitializeWithStream_Impl};
use windows_implement::implement;

use crate::zip_thumb::{extract_thumbnail_png, png_to_hbitmap};

#[implement(IThumbnailProvider, IInitializeWithStream)]
pub struct ThumbnailProvider {
    stream: Mutex<Option<IStream>>,
}

impl ThumbnailProvider {
    pub fn new() -> Self {
        Self { stream: Mutex::new(None) }
    }
}

impl IInitializeWithStream_Impl for ThumbnailProvider_Impl {
    fn Initialize(&self, pstream: Option<&IStream>, _grfmode: u32) -> Result<()> {
        if let Some(s) = pstream {
            *self.stream.lock().unwrap() = Some(s.clone());
        }
        Ok(())
    }
}

impl IThumbnailProvider_Impl for ThumbnailProvider_Impl {
    fn GetThumbnail(&self, cx: u32, phbmp: *mut HBITMAP, pdwalphatype: *mut WTS_ALPHATYPE) -> Result<()> {
        let result = std::panic::catch_unwind(|| -> Result<(HBITMAP, WTS_ALPHATYPE)> {
            let stream_guard = self.stream.lock().unwrap();
            let stream = stream_guard.as_ref().ok_or_else(|| Error::from(E_UNEXPECTED))?;

            let bytes = read_stream_to_vec(stream)?;

            let png_bytes = extract_thumbnail_png(&bytes)
                .ok_or_else(|| Error::from(E_FAIL))?;

            let hbmp = png_to_hbitmap(&png_bytes, cx)?;
            Ok((hbmp, WTSAT_ARGB))
        });

        match result {
            Ok(Ok((hbmp, alpha))) => {
                unsafe {
                    *phbmp = hbmp;
                    *pdwalphatype = alpha;
                }
                Ok(())
            }
            _ => Err(Error::from(E_FAIL)),
        }
    }
}

fn read_stream_to_vec(stream: &IStream) -> Result<Vec<u8>> {
    const MAX_SIZE: usize = 512 * 1024 * 1024;
    const CHUNK: usize = 64 * 1024;

    unsafe {
        stream.Seek(0, STREAM_SEEK_SET, None)?;
    }

    let mut buf = Vec::new();
    let mut chunk = vec![0u8; CHUNK];
    loop {
        let mut read: u32 = 0;
        let hr = unsafe {
            stream.Read(
                chunk.as_mut_ptr() as *mut core::ffi::c_void,
                CHUNK as u32,
                Some(&mut read),
            )
        };
        if read > 0 {
            buf.extend_from_slice(&chunk[..read as usize]);
        }
        if buf.len() > MAX_SIZE {
            return Err(Error::from(E_OUTOFMEMORY));
        }
        // S_FALSE means end of stream (fewer bytes than requested)
        if hr == S_FALSE || read == 0 {
            break;
        }
        hr.ok()?;
    }
    Ok(buf)
}
