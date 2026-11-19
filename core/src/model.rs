use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, uniffi::Enum)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    Password,
    Key,
    Agent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, uniffi::Record)]
pub struct EnvVar {
    pub name: String,
    pub value: String,
}

/// Satu server SSH. `updated_at` + `deleted` dipakai untuk merge saat sync.
///
/// Semua field opsional memakai `#[serde(default)]` agar file vault lama tetap terbaca
/// ketika field baru ditambahkan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, uniffi::Record)]
pub struct Host {
    /// Kosongkan saat membuat host baru; core yang mengisi.
    pub id: String,

    // Address & General
    pub hostname: String,
    pub label: String,
    #[serde(default)]
    pub group: Option<String>,
    pub tags: Vec<String>,
    /// Warna kartu, hex `#RRGGBB`.
    pub color: String,

    // SSH & Credentials
    pub port: u16,
    pub username: String,
    pub auth: AuthMethod,
    /// Disimpan di dalam vault terenkripsi.
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub key_id: Option<String>,

    // Lanjutan
    #[serde(default)]
    pub agent_forwarding: bool,
    #[serde(default)]
    pub startup_snippet: Option<String>,
    /// Host lain yang dipakai sebagai jump host (ProxyJump).
    #[serde(default)]
    pub jump_host_id: Option<String>,
    #[serde(default)]
    pub env: Vec<EnvVar>,
    #[serde(default = "default_charset")]
    pub charset: String,
    #[serde(default)]
    pub terminal_theme: Option<String>,

    /// Epoch milidetik.
    pub updated_at: i64,
    pub deleted: bool,
}

fn default_charset() -> String {
    "UTF-8".into()
}

/// SSH key di Keychain. Private key & passphrase hanya ada di dalam vault terenkripsi.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, uniffi::Record)]
pub struct SshKey {
    pub id: String,
    pub label: String,
    /// mis. `ssh-ed25519`, `ssh-rsa`, `ecdsa-sha2-nistp256`
    pub key_type: String,
    pub public_key: String,
    pub private_key: String,
    pub passphrase: Option<String>,
    /// `SHA256:...`
    pub fingerprint: String,
    pub updated_at: i64,
    pub deleted: bool,
}

/// Isi vault yang dienkripsi.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VaultData {
    #[serde(default)]
    pub hosts: Vec<Host>,
    #[serde(default)]
    pub keys: Vec<SshKey>,
    #[serde(default)]
    pub account_email: Option<String>,
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
