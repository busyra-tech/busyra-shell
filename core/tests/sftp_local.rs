//! Tes integrasi SFTP terhadap sshd lokal. Dijalankan lewat scripts/test-sftp.sh
//! (butuh env DJIE_TEST_PORT, DJIE_TEST_KEY, DJIE_TEST_ROOT).

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use djie_core::{SftpClient, SshTarget, TransferProgress};

struct P { last: AtomicU64, cancel: AtomicBool }
impl TransferProgress for P {
    fn on_progress(&self, done: u64, _total: u64, _f: String) { self.last.store(done, Ordering::SeqCst); }
    fn is_cancelled(&self) -> bool { self.cancel.load(Ordering::SeqCst) }
}

#[tokio::test]
async fn sftp_roundtrip() {
    let Ok(port) = std::env::var("DJIE_TEST_PORT") else { eprintln!("skip: DJIE_TEST_PORT tidak di-set"); return };
    let key = std::fs::read_to_string(std::env::var("DJIE_TEST_KEY").unwrap()).unwrap();
    let root = std::env::var("DJIE_TEST_ROOT").unwrap();
    let target = SshTarget {
        hostname: "127.0.0.1".into(), port: port.parse().unwrap(), username: std::env::var("USER").unwrap(),
        password: None, private_key: Some(key), passphrase: None, use_agent: false,
    };

    // Password salah & tanpa key → AuthFailed
    let mut bad = target.clone();
    bad.private_key = None; bad.password = Some("salah".into());
    assert!(matches!(SftpClient::connect(bad).await, Err(djie_core::CoreError::AuthFailed)));

    let c = SftpClient::connect(target).await.expect("connect");
    assert!(!c.home().await.unwrap().is_empty());

    // Siapkan folder lokal berisi file kecil + file 3 MB
    let local = format!("{root}/local/proyek");
    std::fs::create_dir_all(format!("{local}/sub")).unwrap();
    std::fs::write(format!("{local}/halo.txt"), "halo djie").unwrap();
    std::fs::write(format!("{local}/sub/besar.bin"), vec![7u8; 3 * 1024 * 1024]).unwrap();

    let remote = format!("{root}/remote");
    c.mkdir(remote.clone()).await.unwrap();
    let p = Arc::new(P { last: AtomicU64::new(0), cancel: AtomicBool::new(false) });
    c.upload(local.clone(), remote.clone(), p.clone()).await.unwrap();
    assert_eq!(p.last.load(Ordering::SeqCst), 3 * 1024 * 1024 + 9);

    let names: Vec<String> = c.list(format!("{remote}/proyek")).await.unwrap().into_iter().map(|e| e.name).collect();
    assert_eq!(names, vec!["sub", "halo.txt"]); // folder dulu

    c.rename(format!("{remote}/proyek/halo.txt"), format!("{remote}/proyek/hai.txt")).await.unwrap();
    c.chmod(format!("{remote}/proyek/hai.txt"), 0o600).await.unwrap();
    let e = c.list(format!("{remote}/proyek")).await.unwrap().into_iter().find(|e| e.name == "hai.txt").unwrap();
    assert_eq!(e.permissions, 0o600);

    // Download folder → isi identik
    let dl = format!("{root}/dl"); std::fs::create_dir_all(&dl).unwrap();
    c.download(format!("{remote}/proyek"), dl.clone(), p.clone()).await.unwrap();
    assert_eq!(std::fs::read_to_string(format!("{dl}/proyek/hai.txt")).unwrap(), "halo djie");
    assert_eq!(std::fs::metadata(format!("{dl}/proyek/sub/besar.bin")).unwrap().len(), 3 * 1024 * 1024);

    // Batal di tengah jalan
    let cancel = Arc::new(P { last: AtomicU64::new(0), cancel: AtomicBool::new(true) });
    assert!(matches!(c.download(format!("{remote}/proyek/sub/besar.bin"), dl.clone(), cancel).await, Err(djie_core::CoreError::Cancelled)));

    c.remove(format!("{remote}/proyek")).await.unwrap();
    assert!(c.list(remote.clone()).await.unwrap().is_empty());
    c.close().await;
}
