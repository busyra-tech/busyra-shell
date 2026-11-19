//! djie-core — inti bersama Djie Shell untuk macOS (Swift) dan Windows (C#).
//!
//! Diekspor lewat UniFFI. Modul:
//! - [`model`]  : struktur data (Host, AuthMethod, ...)
//! - [`vault`]  : penyimpanan terenkripsi (Argon2id + XChaCha20-Poly1305)
//! - [`crypto`] : primitif enkripsi & format file

mod crypto;
mod error;
mod keys;
mod model;
mod vault;

pub use error::CoreError;
pub use model::{AuthMethod, EnvVar, ForwardKind, Host, PortForward, SessionLog, Snippet, SshKey, SyncOutcome};
pub use vault::{Vault, vault_exists};

uniffi::setup_scaffolding!();

/// Versi core, ditampilkan di Settings / About.
#[uniffi::export]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
