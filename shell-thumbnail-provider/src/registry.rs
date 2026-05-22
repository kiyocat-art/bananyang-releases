use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::System::LibraryLoader::GetModuleFileNameW;
use windows::Win32::System::Registry::*;

use crate::CLSID_BANANYANG_THUMB;

const THUMBNAIL_HANDLER_IID: &str = "{E357FCCD-A995-4576-B01F-234630154E96}";

fn clsid_string() -> String {
    let g = CLSID_BANANYANG_THUMB;
    format!(
        "{{{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}}}",
        g.data1, g.data2, g.data3,
        g.data4[0], g.data4[1],
        g.data4[2], g.data4[3], g.data4[4], g.data4[5], g.data4[6], g.data4[7]
    )
}

fn to_wide_nul(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn reg_set(key: HKEY, subkey: &str, value_name: &str, data: &str) -> Result<()> {
    let mut hk = HKEY::default();
    let subkey_w = to_wide_nul(subkey);
    let e = unsafe { RegCreateKeyW(key, PCWSTR(subkey_w.as_ptr()), &mut hk) };
    if e.0 != 0 {
        return Err(HRESULT::from_win32(e.0).into());
    }

    let vname_w = to_wide_nul(value_name);
    let data_w: Vec<u16> = data.encode_utf16().chain(std::iter::once(0)).collect();
    let data_bytes = unsafe {
        std::slice::from_raw_parts(data_w.as_ptr() as *const u8, data_w.len() * 2)
    };
    let e2 = unsafe {
        RegSetValueExW(hk, PCWSTR(vname_w.as_ptr()), 0, REG_SZ, Some(data_bytes))
    };
    unsafe { let _ = RegCloseKey(hk); };

    if e2.0 != 0 {
        return Err(HRESULT::from_win32(e2.0).into());
    }
    Ok(())
}

fn reg_delete_tree(key: HKEY, subkey: &str) {
    let subkey_w = to_wide_nul(subkey);
    unsafe {
        let _ = RegDeleteTreeW(key, PCWSTR(subkey_w.as_ptr()));
    }
}

fn reg_delete_value(key: HKEY, subkey: &str, value_name: &str) {
    let subkey_w = to_wide_nul(subkey);
    let vname_w = to_wide_nul(value_name);
    let mut hk = HKEY::default();
    unsafe {
        if RegOpenKeyExW(key, PCWSTR(subkey_w.as_ptr()), 0, KEY_SET_VALUE, &mut hk).0 == 0 {
            let _ = RegDeleteValueW(hk, PCWSTR(vname_w.as_ptr()));
            let _ = RegCloseKey(hk);
        }
    }
}

fn get_dll_path(hmodule: HMODULE) -> Result<String> {
    let mut buf = vec![0u16; 32768];
    let len = unsafe { GetModuleFileNameW(hmodule, &mut buf) };
    if len == 0 {
        return Err(Error::from_win32());
    }
    Ok(String::from_utf16_lossy(&buf[..len as usize]))
}

pub fn register(hmodule: HMODULE) -> Result<()> {
    let clsid = clsid_string();
    let dll_path = get_dll_path(hmodule)?;

    let clsid_key = format!("Software\\Classes\\CLSID\\{}", clsid);
    reg_set(HKEY_CURRENT_USER, &clsid_key, "", "BanaNyang Thumbnail Provider")?;

    let inproc_key = format!("{}\\InprocServer32", clsid_key);
    reg_set(HKEY_CURRENT_USER, &inproc_key, "", &dll_path)?;
    reg_set(HKEY_CURRENT_USER, &inproc_key, "ThreadingModel", "Apartment")?;

    let shellex_key = format!(
        "Software\\Classes\\.nyang\\ShellEx\\{}",
        THUMBNAIL_HANDLER_IID
    );
    reg_set(HKEY_CURRENT_USER, &shellex_key, "", &clsid)?;

    // Suppress Windows shell type-icon overlay so the app icon is not
    // composited onto our custom thumbnail by the shell.
    for ext in [".nyang", ".rfy", ".bananyang"] {
        let key = format!("Software\\Classes\\{}", ext);
        reg_set(HKEY_CURRENT_USER, &key, "TypeOverlay", "")?;
    }
    // ProgID 레벨에도 억제 — Windows가 실제로 조회하는 위치.
    // ProgID 키가 아직 없을 수 있으므로 에러를 무시한다.
    for progid in ["BanaNyang Workspace", "BanaNyang Workspace (Legacy)"] {
        let key = format!("Software\\Classes\\{}", progid);
        let _ = reg_set(HKEY_CURRENT_USER, &key, "TypeOverlay", "");
    }

    // Clear any DefaultIcon that legacy installs may have left on the ProgID.
    reg_set(HKEY_CURRENT_USER, "Software\\Classes\\BanaNyang.nyang\\DefaultIcon", "", "")?;

    Ok(())
}

pub fn unregister() -> Result<()> {
    let clsid = clsid_string();

    let clsid_key = format!("Software\\Classes\\CLSID\\{}", clsid);
    reg_delete_tree(HKEY_CURRENT_USER, &clsid_key);

    let shellex_key = format!(
        "Software\\Classes\\.nyang\\ShellEx\\{}",
        THUMBNAIL_HANDLER_IID
    );
    reg_delete_tree(HKEY_CURRENT_USER, &shellex_key);

    for ext in [".nyang", ".rfy", ".bananyang"] {
        let key = format!("Software\\Classes\\{}", ext);
        reg_delete_value(HKEY_CURRENT_USER, &key, "TypeOverlay");
    }
    for progid in ["BanaNyang Workspace", "BanaNyang Workspace (Legacy)"] {
        let key = format!("Software\\Classes\\{}", progid);
        reg_delete_value(HKEY_CURRENT_USER, &key, "TypeOverlay");
    }

    Ok(())
}
