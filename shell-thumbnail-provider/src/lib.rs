mod factory;
mod registry;
mod thumbnail;
mod zip_thumb;

use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;

pub const CLSID_BANANYANG_THUMB: GUID = GUID::from_values(
    0x6F1B2C7E,
    0x9E2A,
    0x4F1D,
    [0x8C, 0x2B, 0x7B, 0x1A, 0x4D, 0x2F, 0x9C, 0x3E],
);

const SELFREG_E_CLASS: HRESULT = HRESULT(0x80040201_u32 as i32);

static mut DLL_MODULE: HMODULE = HMODULE(std::ptr::null_mut());

#[no_mangle]
#[allow(non_snake_case)]
unsafe extern "system" fn DllMain(
    hinstance: HMODULE,
    dw_reason: u32,
    _lp_reserved: *mut core::ffi::c_void,
) -> BOOL {
    const DLL_PROCESS_ATTACH: u32 = 1;
    if dw_reason == DLL_PROCESS_ATTACH {
        DLL_MODULE = hinstance;
    }
    TRUE
}

#[no_mangle]
#[allow(non_snake_case)]
pub unsafe extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut core::ffi::c_void,
) -> HRESULT {
    if *rclsid != CLSID_BANANYANG_THUMB {
        return CLASS_E_CLASSNOTAVAILABLE;
    }
    let factory = factory::ClassFactory;
    let unk: IClassFactory = factory.into();
    unsafe { unk.query(&*riid, ppv) }
}

#[no_mangle]
#[allow(non_snake_case)]
pub extern "system" fn DllCanUnloadNow() -> HRESULT {
    S_FALSE
}

#[no_mangle]
#[allow(non_snake_case)]
pub unsafe extern "system" fn DllRegisterServer() -> HRESULT {
    match registry::register(DLL_MODULE) {
        Ok(()) => S_OK,
        Err(e) => {
            eprintln!("[BanaNyang Thumb] DllRegisterServer failed: {:?}", e);
            SELFREG_E_CLASS
        }
    }
}

#[no_mangle]
#[allow(non_snake_case)]
pub unsafe extern "system" fn DllUnregisterServer() -> HRESULT {
    let _ = registry::unregister();
    S_OK
}
