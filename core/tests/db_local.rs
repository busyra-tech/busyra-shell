//! Tes integrasi database. Dijalankan lewat scripts/test-db.sh (container Docker sementara).

use djie_core::{DbConnection, DbEngine, DbSession, SshTarget};

fn conn(engine: DbEngine, port: u16, user: &str, pw: &str, db: &str) -> DbConnection {
    DbConnection {
        id: String::new(), label: "tes".into(), engine, host: "127.0.0.1".into(), port,
        username: user.into(), password: Some(pw.into()), database: db.into(), file_path: String::new(),
        tls: false, ssh_host_id: None, color: String::new(), updated_at: 0, deleted: false,
    }
}

async fn roundtrip(s: &DbSession, create: &str) {
    s.run(create.into()).await.expect("create");
    let ins = s.run("INSERT INTO djie_t (id, nama) VALUES (1, 'halo'), (2, NULL)".into()).await.expect("insert");
    assert_eq!(ins.affected, Some(2));
    let r = s.run("SELECT id, nama FROM djie_t ORDER BY id".into()).await.expect("select");
    assert_eq!(r.columns, vec!["id", "nama"]);
    assert_eq!(r.rows, vec![vec![Some("1".into()), Some("halo".into())], vec![Some("2".into()), None]]);
    assert!(s.tables().await.unwrap().iter().any(|t| t.name == "djie_t"));
    assert!(!s.databases().await.unwrap().is_empty());
    assert!(s.run("SELECT * FROM tabel_tidak_ada".into()).await.is_err());
}

#[tokio::test]
async fn databases() {
    let Ok(_) = std::env::var("DJIE_DB_TEST") else { eprintln!("skip"); return };

    // PostgreSQL (TLS dicoba dulu, lalu tanpa TLS)
    let pg = DbSession::connect(conn(DbEngine::Postgres, 55432, "postgres", "rahasia", "postgres"), None).await.expect("pg connect");
    roundtrip(&pg, "CREATE TABLE djie_t (id int, nama text)").await;
    println!("✓ PostgreSQL");

    // MySQL & MariaDB
    for (engine, port, name) in [(DbEngine::Mysql, 53306, "MySQL"), (DbEngine::Mariadb, 53307, "MariaDB")] {
        let my = DbSession::connect(conn(engine, port, "root", "rahasia", "djie"), None).await.expect("mysql connect");
        roundtrip(&my, "CREATE TABLE djie_t (id int, nama varchar(20))").await;
        println!("✓ {name}");
    }

    // Redis
    let rd = DbSession::connect(conn(DbEngine::Redis, 56379, "", "rahasia", "0"), None).await.expect("redis connect");
    rd.run("SET sapa \"halo dunia\"\nHSET user:1 nama Adjie kota Aceh".into()).await.unwrap();
    let r = rd.run("GET sapa".into()).await.unwrap();
    assert_eq!(r.rows[0][1].as_deref(), Some("halo dunia"));
    let p = rd.preview("key".into(), "user:1".into()).await.unwrap();
    assert!(p.rows.iter().any(|row| row.iter().any(|v| v.as_deref() == Some("Adjie"))));
    assert!(rd.tables().await.unwrap().iter().any(|t| t.name == "sapa"));
    println!("✓ Redis");

    // SQLite
    let path = format!("{}/tes.sqlite", std::env::var("DJIE_DB_TMP").unwrap());
    let mut lite = conn(DbEngine::Sqlite, 0, "", "", "");
    lite.file_path = path;
    let sl = DbSession::connect(lite, None).await.expect("sqlite");
    roundtrip(&sl, "CREATE TABLE djie_t (id integer, nama text)").await;
    println!("✓ SQLite");

    // PostgreSQL lewat tunnel SSH (sshd lokal)
    let key = std::fs::read_to_string(std::env::var("DJIE_TEST_KEY").unwrap()).unwrap();
    let ssh = SshTarget {
        hostname: "127.0.0.1".into(), port: 2224, username: std::env::var("USER").unwrap(),
        password: None, private_key: Some(key), passphrase: None, use_agent: false,
    };
    let tun = DbSession::connect(conn(DbEngine::Postgres, 55432, "postgres", "rahasia", "postgres"), Some(ssh)).await.expect("tunnel connect");
    let r = tun.run("SELECT count(*) AS n FROM djie_t".into()).await.unwrap();
    assert_eq!(r.rows[0][0].as_deref(), Some("2"));
    println!("✓ PostgreSQL lewat tunnel SSH");
}
