"""Validate the generated MySQL training dataset with an in-memory SQL engine."""

import pathlib
import re
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sql" / "audit_incident_lab.sql"


def load_database():
    source = SOURCE.read_text(encoding="utf-8")
    source = re.sub(r"SET FOREIGN_KEY_CHECKS\s*=\s*[01];", "", source)
    connection = sqlite3.connect(":memory:")
    connection.create_function("TIME", 1, lambda value: value.split(" ")[1] if value else None)
    connection.create_function("DATE", 1, lambda value: value[:10] if value else None)
    connection.create_function("HOUR", 1, lambda value: int(value[11:13]) if value else None)
    connection.executescript(source)
    return connection


CHECKS = [
    ("table count", "SELECT COUNT(*) FROM sqlite_master WHERE type='table'", (6,)),
    ("users", "SELECT COUNT(*) FROM users", (30,)),
    ("assets", "SELECT COUNT(*) FROM assets", (31,)),
    ("login logs", "SELECT COUNT(*) FROM login_logs", (2134,)),
    ("database activity", "SELECT COUNT(*) FROM database_activity", (6862,)),
    ("network traffic", "SELECT COUNT(*) FROM network_traffic", (11143,)),
    ("incident reports", "SELECT COUNT(*) FROM incident_reports", (5,)),
    (
        "procedure 1 daily traffic anomaly",
        """SELECT COUNT(*), ROUND(AVG(bytes_sent),0), SUM(bytes_sent)
           FROM network_traffic WHERE DATE(captured_at)='2026-08-20'""",
        (1065, 1103624.0, 1175359284),
    ),
    (
        "procedure 2 normal peak hours",
        """SELECT HOUR(captured_at), COUNT(*) AS events
           FROM network_traffic GROUP BY HOUR(captured_at)
           ORDER BY events DESC, HOUR(captured_at) LIMIT 4""",
        [(9, 1825), (13, 1825), (14, 1823), (10, 1751)],
    ),
    (
        "procedure 3 failed-login anomaly",
        """SELECT COUNT(*) FROM login_logs
           WHERE DATE(attempted_at)='2026-08-20' AND login_status='FAILED'""",
        (50,),
    ),
    (
        "department coverage",
        """SELECT COUNT(*) FROM (
             SELECT department FROM users GROUP BY department
           ) departments""",
        (9,),
    ),
    (
        "procedure 4 Finance assets",
        """SELECT COUNT(*) FROM users u
           JOIN assets a ON a.owner_user_id=u.user_id
           WHERE u.department='Finance'""",
        (6,),
    ),
    (
        "failed-login candidates",
        """SELECT source_ip, COUNT(*) AS failures
           FROM login_logs WHERE login_status='FAILED' AND source_ip NOT LIKE '10.%'
           GROUP BY source_ip HAVING COUNT(*) >= 5
           ORDER BY failures DESC""",
        [("203.0.113.77", 17), ("192.0.2.44", 15)],
    ),
    (
        "unregistered successful session",
        """SELECT username, login_id FROM login_logs
           JOIN users USING (user_id)
           WHERE login_status='SUCCESS' AND asset_id IS NULL""",
        [("nina.santoso", 900001)],
    ),
    (
        "procedure 6 out-of-hours successes",
        """SELECT l.login_id, u.username FROM login_logs l
           JOIN users u ON u.user_id=l.user_id
           WHERE l.login_status='SUCCESS'
             AND (TIME(l.attempted_at)<u.work_start OR TIME(l.attempted_at)>u.work_end)
           ORDER BY l.attempted_at""",
        [(900001, "nina.santoso"), (800001, "sita.maharani")],
    ),
    (
        "procedure 8 suspicious database trail",
        """SELECT d.activity_id FROM database_activity d
           JOIN login_logs l ON l.login_id=d.login_id
           JOIN users u ON u.user_id=d.user_id
           WHERE l.source_ip='203.0.113.77' ORDER BY d.executed_at""",
        [(910001,), (910002,), (910003,), (910004,)],
    ),
    (
        "procedure 9 incident exports",
        """SELECT username, COUNT(*), SUM(returned_rows)
           FROM database_activity JOIN users USING (user_id)
           WHERE exported=1 GROUP BY username ORDER BY SUM(returned_rows) DESC""",
        [("sita.maharani", 1, 15000), ("nina.santoso", 2, 1344)],
    ),
    (
        "procedure 10 external exfiltration",
        """SELECT username, destination_ip, SUM(bytes_sent)
           FROM network_traffic JOIN users USING (user_id)
           WHERE bytes_sent > 10000000 AND destination_ip NOT LIKE '10.%'
           GROUP BY username, destination_ip""",
        [("nina.santoso", "203.0.113.88", 61652578)],
    ),
    (
        "procedure 11 report review",
        """SELECT COUNT(*) FROM incident_reports r
           JOIN users u ON u.user_id=r.reported_by_user_id""",
        (5,),
    ),
    (
        "easter egg in database activity",
        "SELECT COUNT(*) FROM database_activity WHERE query_text LIKE '%ORCHID-47%'",
        (2,),
    ),
    (
        "easter egg in phishing report",
        "SELECT COUNT(*) FROM incident_reports WHERE description LIKE '%ORCHID47%'",
        (1,),
    ),
]


def main():
    connection = load_database()
    passed = 0
    for name, query, expected in CHECKS:
        actual = connection.execute(query).fetchall()
        normalized_expected = expected if isinstance(expected, list) else [expected]
        if actual != normalized_expected:
            raise AssertionError(f"{name}: expected {normalized_expected!r}, got {actual!r}")
        passed += 1
        print(f"PASS  {name}")
    print(f"\n{passed}/{len(CHECKS)} validation checks passed.")


if __name__ == "__main__":
    main()
