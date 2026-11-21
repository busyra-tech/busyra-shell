//! Tes `run_remote` ke sshd lokal. Butuh DJIE_TEST_PORT + DJIE_TEST_KEY (lihat scripts/test-sftp.sh); tanpa itu dilewati.
use djie_core::{run_remote, SshTarget};

fn target() -> Option<SshTarget> {
    let port = std::env::var("DJIE_TEST_PORT").ok()?.parse().ok()?;
    let key = std::fs::read_to_string(std::env::var("DJIE_TEST_KEY").ok()?).ok()?;
    Some(SshTarget {
        hostname: "127.0.0.1".into(), port, username: std::env::var("USER").unwrap_or_default(),
        password: None, private_key: Some(key), passphrase: None, use_agent: false, proxy: None,
    })
}

#[tokio::test]
async fn exit_code_output_and_timeout() {
    let Some(t) = target() else { eprintln!("dilewati: DJIE_TEST_PORT/DJIE_TEST_KEY tidak diset"); return };
    let ok = run_remote(t.clone(), "echo halo; echo galat >&2".into(), 10).await.unwrap();
    assert_eq!(ok.exit_code, Some(0));
    assert!(ok.output.contains("halo") && ok.output.contains("galat"), "{}", ok.output);
    let fail = run_remote(t.clone(), "exit 3".into(), 10).await.unwrap();
    assert_eq!(fail.exit_code, Some(3));
    let slow = run_remote(t.clone(), "sleep 5".into(), 1).await.unwrap();
    assert!(slow.timed_out && slow.exit_code.is_none());
    let big = run_remote(t, "yes 0123456789 | head -c 400000".into(), 10).await.unwrap();
    assert!(big.truncated && big.output.len() == 256 * 1024);
}
