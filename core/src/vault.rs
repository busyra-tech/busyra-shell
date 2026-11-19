use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::crypto::{self, Key, SALT_LEN};
use crate::keys;
use crate::model::{Host, SshKey, VaultData, now_ms};
use crate::CoreError;

/// Vault terbuka (sudah di-unlock). Semua perubahan langsung ditulis ke disk terenkripsi.
#[derive(uniffi::Object)]
pub struct Vault {
    path: PathBuf,
    key: Key,
    salt: [u8; SALT_LEN],
    data: Mutex<VaultData>,
}

#[uniffi::export]
pub fn vault_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[uniffi::export]
impl Vault {
    /// Buat vault baru dengan master password.
    #[uniffi::constructor]
    pub fn create(path: String, password: String) -> Result<Arc<Self>, CoreError> {
        if Path::new(&path).exists() {
            return Err(CoreError::AlreadyExists);
        }
        if password.chars().count() < 8 {
            return Err(CoreError::WeakPassword);
        }
        let salt = crypto::random::<SALT_LEN>();
        let vault = Self {
            path: path.into(),
            key: crypto::derive_key(&password, &salt),
            salt,
            data: Mutex::new(VaultData::default()),
        };
        vault.persist(&vault.data.lock().unwrap())?;
        Ok(Arc::new(vault))
    }

    /// Buka vault dengan master password.
    #[uniffi::constructor]
    pub fn unlock(path: String, password: String) -> Result<Arc<Self>, CoreError> {
        let blob = fs::read(&path)?;
        let salt = crypto::read_salt(&blob)?;
        let key = crypto::derive_key(&password, &salt);
        Self::open_with(path.into(), key, salt, &blob)
    }

    /// Buka vault dengan kunci mentah (disimpan di Keychain, dibuka dengan Touch ID).
    #[uniffi::constructor]
    pub fn unlock_with_key(path: String, key: Vec<u8>) -> Result<Arc<Self>, CoreError> {
        let key: Key = key.try_into().map_err(|_| CoreError::WrongPassword)?;
        let blob = fs::read(&path)?;
        let salt = crypto::read_salt(&blob)?;
        Self::open_with(path.into(), key, salt, &blob)
    }

    /// Kunci mentah untuk disimpan di Keychain (Touch ID). Jangan pernah ditulis ke file biasa.
    pub fn export_key(&self) -> Vec<u8> {
        self.key.to_vec()
    }

    /// Semua host aktif, urut berdasarkan label.
    pub fn hosts(&self) -> Vec<Host> {
        let mut list: Vec<Host> =
            self.data.lock().unwrap().hosts.iter().filter(|h| !h.deleted).cloned().collect();
        list.sort_by_key(|h| h.label.to_lowercase());
        list
    }

    /// Tambah host (jika `id` kosong) atau perbarui host yang ada.
    pub fn upsert_host(&self, mut host: Host) -> Result<Host, CoreError> {
        let mut data = self.data.lock().unwrap();
        host.updated_at = now_ms();
        host.deleted = false;
        if host.id.is_empty() {
            host.id = uuid::Uuid::new_v4().to_string();
            data.hosts.push(host.clone());
        } else {
            let slot = data.hosts.iter_mut().find(|h| h.id == host.id).ok_or(CoreError::NotFound)?;
            *slot = host.clone();
        }
        self.persist(&data)?;
        Ok(host)
    }

    /// Hapus host (tombstone, agar penghapusan ikut tersinkron).
    pub fn delete_host(&self, id: String) -> Result<(), CoreError> {
        let mut data = self.data.lock().unwrap();
        let h = data.hosts.iter_mut().find(|h| h.id == id).ok_or(CoreError::NotFound)?;
        h.deleted = true;
        h.updated_at = now_ms();
        self.persist(&data)
    }

    // ---- Keychain ----

    /// Semua SSH key aktif, urut berdasarkan label.
    pub fn keys(&self) -> Vec<SshKey> {
        let mut list: Vec<SshKey> =
            self.data.lock().unwrap().keys.iter().filter(|k| !k.deleted).cloned().collect();
        list.sort_by_key(|k| k.label.to_lowercase());
        list
    }

    /// Generate key Ed25519 baru dan simpan ke vault.
    pub fn generate_key(&self, label: String) -> Result<SshKey, CoreError> {
        let key = keys::generate_ed25519(&label)?;
        self.push_key(key)
    }

    /// Import private key OpenSSH (isi file, mis. dari `~/.ssh/id_ed25519`).
    pub fn import_key(&self, label: String, private_key: String, passphrase: Option<String>) -> Result<SshKey, CoreError> {
        let key = keys::import(&label, &private_key, passphrase)?;
        self.push_key(key)
    }

    pub fn rename_key(&self, id: String, label: String) -> Result<(), CoreError> {
        let mut data = self.data.lock().unwrap();
        let k = data.keys.iter_mut().find(|k| k.id == id).ok_or(CoreError::NotFound)?;
        k.label = label;
        k.updated_at = now_ms();
        self.persist(&data)
    }

    /// Hapus key (tombstone). Host yang memakai key ini dikembalikan ke auth password.
    pub fn delete_key(&self, id: String) -> Result<(), CoreError> {
        let mut data = self.data.lock().unwrap();
        let now = now_ms();
        let k = data.keys.iter_mut().find(|k| k.id == id).ok_or(CoreError::NotFound)?;
        k.deleted = true;
        k.updated_at = now;
        for h in data.hosts.iter_mut().filter(|h| h.key_id.as_deref() == Some(id.as_str())) {
            h.key_id = None;
            h.updated_at = now;
        }
        self.persist(&data)
    }

    pub fn account_email(&self) -> Option<String> {
        self.data.lock().unwrap().account_email.clone()
    }

    pub fn set_account_email(&self, email: Option<String>) -> Result<(), CoreError> {
        let mut data = self.data.lock().unwrap();
        data.account_email = email;
        self.persist(&data)
    }
}

impl Vault {
    fn push_key(&self, key: SshKey) -> Result<SshKey, CoreError> {
        let mut data = self.data.lock().unwrap();
        if data.keys.iter().any(|k| !k.deleted && k.fingerprint == key.fingerprint) {
            return Err(CoreError::InvalidKey { msg: "key ini sudah ada di Keychain".into() });
        }
        data.keys.push(key.clone());
        self.persist(&data)?;
        Ok(key)
    }

    fn open_with(path: PathBuf, key: Key, salt: [u8; SALT_LEN], blob: &[u8]) -> Result<Arc<Self>, CoreError> {
        let plain = crypto::open(&key, blob)?;
        let data: VaultData = serde_json::from_slice(&plain)?;
        Ok(Arc::new(Self { path, key, salt, data: Mutex::new(data) }))
    }

    /// Tulis atomik: file sementara lalu rename.
    fn persist(&self, data: &VaultData) -> Result<(), CoreError> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }
        let blob = crypto::seal(&self.key, &self.salt, &serde_json::to_vec(data)?);
        let tmp = self.path.with_extension("tmp");
        fs::write(&tmp, blob)?;
        fs::rename(&tmp, &self.path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::AuthMethod;

    fn tmp_path(name: &str) -> String {
        let p = std::env::temp_dir().join(format!("djie-test-{name}-{}.djie", uuid::Uuid::new_v4()));
        p.to_string_lossy().into_owned()
    }

    fn sample() -> Host {
        Host {
            id: String::new(),
            label: "prod".into(),
            hostname: "10.0.0.1".into(),
            group: None,
            port: 22,
            username: "root".into(),
            auth: AuthMethod::Password,
            password: Some("s3cret".into()),
            key_id: None,
            agent_forwarding: false,
            startup_snippet: None,
            jump_host_id: None,
            env: vec![],
            charset: "UTF-8".into(),
            terminal_theme: None,
            tags: vec!["production".into()],
            color: "#3fd0b4".into(),
            updated_at: 0,
            deleted: false,
        }
    }

    #[test]
    fn roundtrip_and_wrong_password() {
        let path = tmp_path("rt");
        let v = Vault::create(path.clone(), "rahasia123".into()).unwrap();
        let saved = v.upsert_host(sample()).unwrap();
        assert!(!saved.id.is_empty());

        let v2 = Vault::unlock(path.clone(), "rahasia123".into()).unwrap();
        assert_eq!(v2.hosts(), vec![saved.clone()]);

        assert!(matches!(Vault::unlock(path.clone(), "salah-salah".into()), Err(CoreError::WrongPassword)));

        let v3 = Vault::unlock_with_key(path.clone(), v2.export_key()).unwrap();
        v3.delete_host(saved.id).unwrap();
        assert!(Vault::unlock(path.clone(), "rahasia123".into()).unwrap().hosts().is_empty());
        fs::remove_file(path).ok();
    }

    #[test]
    fn keychain_generate_import_delete() {
        let path = tmp_path("keys");
        let v = Vault::create(path.clone(), "rahasia123".into()).unwrap();
        let k = v.generate_key("laptop".into()).unwrap();
        assert_eq!(k.key_type, "ssh-ed25519");
        assert!(k.public_key.starts_with("ssh-ed25519 "));
        assert!(k.fingerprint.starts_with("SHA256:"));

        // import key yang sama → ditolak sebagai duplikat
        assert!(v.import_key("dup".into(), k.private_key.clone(), None).is_err());
        assert!(v.import_key("x".into(), "bukan key".into(), None).is_err());

        let mut h = sample();
        h.auth = AuthMethod::Key;
        h.key_id = Some(k.id.clone());
        let h = v.upsert_host(h).unwrap();
        v.delete_key(k.id).unwrap();
        let v2 = Vault::unlock(path.clone(), "rahasia123".into()).unwrap();
        assert!(v2.keys().is_empty());
        assert_eq!(v2.hosts().into_iter().find(|x| x.id == h.id).unwrap().key_id, None);
        fs::remove_file(path).ok();
    }

    #[test]
    fn rejects_weak_password_and_existing() {
        let path = tmp_path("weak");
        assert!(matches!(Vault::create(path.clone(), "123".into()), Err(CoreError::WeakPassword)));
        Vault::create(path.clone(), "cukupkuat".into()).unwrap();
        assert!(matches!(Vault::create(path.clone(), "cukupkuat".into()), Err(CoreError::AlreadyExists)));
        fs::remove_file(path).ok();
    }
}
