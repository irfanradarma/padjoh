import { mkdirSync, writeFileSync } from "node:fs";

// Deterministic synthetic dataset. Re-running this file produces identical data.
let seed = 20260820;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (items) => items[Math.floor(random() * items.length)];
const pad = (value) => String(value).padStart(2, "0");
const timestamp = (day, hour, minute, second = 0) =>
  `2026-08-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
const shiftTimestamp = (value, minutes) => {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString().slice(0, 19).replace("T", " ");
};
const labDays = Array.from({ length: 14 }, (_, index) => {
  const day = 8 + index;
  const weekday = new Date(Date.UTC(2026, 7, day)).getUTCDay();
  return { day, isWeekend: weekday === 0 || weekday === 6 };
});
const sqlValue = (value) => {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};
const insert = (table, columns, rows) => {
  const values = rows
    .map((row) => `(${row.map(sqlValue).join(", ")})`)
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};\n`;
};

const people = [
  [
    "arif.hidayat",
    "Arif Hidayat",
    "Information Technology",
    "IT Manager",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "sita.maharani",
    "Sita Maharani",
    "Information Technology",
    "Database Administrator",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "dodi.saputra",
    "Dodi Saputra",
    "Information Security",
    "Security Analyst",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "nina.santoso",
    "Nina Santoso",
    "Finance",
    "Finance Analyst",
    "08:00:00",
    "17:00:00",
    0,
  ],
  [
    "yusuf.ramadhan",
    "Yusuf Ramadhan",
    "Finance",
    "Finance Manager",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "maya.lestari",
    "Maya Lestari",
    "Human Resources",
    "HR Analyst",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "service.backup",
    "Backup Service",
    "Information Technology",
    "Service Account",
    "00:00:00",
    "23:59:59",
    1,
  ],
  [
    "bima.prakoso",
    "Bima Prakoso",
    "Procurement",
    "Procurement Officer",
    "08:00:00",
    "17:00:00",
    0,
  ],
  [
    "ratna.dewi",
    "Ratna Dewi",
    "Finance",
    "Finance Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "fajar.nugroho",
    "Fajar Nugroho",
    "Operations",
    "Operations Officer",
    "07:00:00",
    "16:00:00",
    1,
  ],
  [
    "indah.permata",
    "Indah Permata",
    "Human Resources",
    "HR Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "rizky.maulana",
    "Rizky Maulana",
    "Procurement",
    "Procurement Analyst",
    "08:00:00",
    "17:00:00",
    0,
  ],
  [
    "dewi.anggraini",
    "Dewi Anggraini",
    "Finance",
    "Finance Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "agus.setiawan",
    "Agus Setiawan",
    "Operations",
    "Operations Supervisor",
    "07:00:00",
    "16:00:00",
    1,
  ],
  [
    "putri.ananda",
    "Putri Ananda",
    "Legal",
    "Legal Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "reza.firmansyah",
    "Reza Firmansyah",
    "Sales",
    "Sales Analyst",
    "08:00:00",
    "17:00:00",
    0,
  ],
  [
    "lia.kusuma",
    "Lia Kusuma",
    "Sales",
    "Sales Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "eko.wibowo",
    "Eko Wibowo",
    "Information Technology",
    "System Administrator",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "sari.puspita",
    "Sari Puspita",
    "Customer Service",
    "Customer Service Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "andi.kurniawan",
    "Andi Kurniawan",
    "Operations",
    "Operations Officer",
    "07:00:00",
    "16:00:00",
    0,
  ],
  [
    "tania.putri",
    "Tania Putri",
    "Finance",
    "Treasury Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "ilham.akbar",
    "Ilham Akbar",
    "Procurement",
    "Vendor Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "nurul.fadilah",
    "Nurul Fadilah",
    "Legal",
    "Compliance Analyst",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "galih.pratama",
    "Galih Pratama",
    "Information Technology",
    "Helpdesk Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "ayu.safitri",
    "Ayu Safitri",
    "Customer Service",
    "Customer Service Officer",
    "08:00:00",
    "17:00:00",
    0,
  ],
  [
    "rama.wijaya",
    "Rama Wijaya",
    "Sales",
    "Account Executive",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "fitri.handayani",
    "Fitri Handayani",
    "Finance",
    "Accounts Payable Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "hendra.gunawan",
    "Hendra Gunawan",
    "Operations",
    "Warehouse Officer",
    "07:00:00",
    "16:00:00",
    1,
  ],
  [
    "nadia.rahma",
    "Nadia Rahma",
    "Human Resources",
    "Recruitment Officer",
    "08:00:00",
    "17:00:00",
    1,
  ],
  [
    "wahyu.prasetyo",
    "Wahyu Prasetyo",
    "Information Security",
    "SOC Analyst",
    "16:00:00",
    "23:59:59",
    1,
  ],
];

const users = people.map((person, index) => [index + 1, ...person, "ACTIVE"]);
const assets = people
  .map((person, index) => index + 1)
  .filter((id) => id !== 7)
  .map((id) => [
    id,
    id,
    `LT-${String(id).padStart(3, "0")}`,
    `WKS-${people[id - 1][0].split(".")[0].toUpperCase()}`,
    "Laptop",
    `10.20.${Math.ceil(id / 20)}.${20 + id}`,
    "ACTIVE",
  ]);
assets.push([
  31,
  7,
  "SRV-001",
  "SRV-BACKUP-01",
  "Server",
  "10.20.10.11",
  "ACTIVE",
]);
assets.push([32, 1, "SRV-002", "SRV-DB-01", "Server", "10.20.10.12", "ACTIVE"]);

const loginLogs = [];
let loginId = 1;
for (const { day, isWeekend } of labDays) {
  for (let userId = 1; userId <= people.length; userId += 1) {
    if (userId === 7) {
      loginLogs.push([
        loginId++,
        7,
        31,
        timestamp(day, 2, 5),
        "10.20.10.11",
        "ID",
        "SUCCESS",
        null,
      ]);
      continue;
    }
    if ((!isWeekend && random() < 0.06) || (isWeekend && random() < 0.78))
      continue;
    const workStart = Number(people[userId - 1][4].slice(0, 2));
    const workEnd = Number(people[userId - 1][5].slice(0, 2));
    const sessions = isWeekend
      ? 1 + Math.floor(random() * 2)
      : 6 + Math.floor(random() * 3);
    for (let session = 0; session < sessions; session += 1) {
      const span = Math.max(1, workEnd - workStart);
      const hour = Math.min(
        workEnd,
        workStart + Math.floor((session / sessions) * span),
      );
      const minute = Math.floor(random() * 60);
      if (random() < 0.09) {
        loginLogs.push([
          loginId++,
          userId,
          userId,
          timestamp(day, hour, Math.max(0, minute - 1)),
          `10.20.${Math.ceil(userId / 20)}.${20 + userId}`,
          "ID",
          "FAILED",
          "INVALID_PASSWORD",
        ]);
      }
      loginLogs.push([
        loginId++,
        userId,
        userId,
        timestamp(day, hour, minute),
        `10.20.${Math.ceil(userId / 20)}.${20 + userId}`,
        "ID",
        "SUCCESS",
        null,
      ]);
    }
  }
}

// Red herring 1: approved vulnerability scan. Many failures, no successful login.
for (let userId = 1; userId <= 15; userId += 1) {
  loginLogs.push([
    loginId++,
    userId,
    null,
    `2026-08-20 01:${pad(userId)}:00`,
    "192.0.2.44",
    "ID",
    "FAILED",
    "SECURITY_SCAN",
  ]);
}

// Actual incident: password spraying followed by account takeover of Nina Santoso.
for (const userId of [4, 8, 12, 16, 20]) {
  for (let n = 0; n < (userId === 4 ? 9 : 2); n += 1) {
    loginLogs.push([
      loginId++,
      userId,
      null,
      `2026-08-20 22:${pad(2 + n * 2 + (userId % 3))}:00`,
      "203.0.113.77",
      "SG",
      "FAILED",
      "INVALID_PASSWORD",
    ]);
  }
}
loginLogs.push([
  900001,
  4,
  null,
  "2026-08-20 22:26:41",
  "203.0.113.77",
  "SG",
  "SUCCESS",
  null,
]);

// Red herring 2: legitimate emergency DBA work outside office hours.
loginLogs.push([
  800001,
  2,
  2,
  "2026-08-20 23:04:12",
  "10.20.1.22",
  "ID",
  "SUCCESS",
  null,
]);

const databaseActivity = [];
let activityId = 1;
const normalTables = [
  "customer_accounts",
  "finance_payments",
  "purchase_orders",
  "employee_directory",
  "sales_orders",
];
for (const login of loginLogs.filter(
  (row) => row[6] === "SUCCESS" && row[0] < 8000,
)) {
  const actions = 2 + Math.floor(random() * 4);
  for (let action = 0; action < actions; action += 1) {
    const table = pick(normalTables);
    const rows = 1 + Math.floor(random() * 250);
    databaseActivity.push([
      activityId++,
      login[0],
      login[1],
      shiftTimestamp(login[3], 1 + action * 2),
      "corp_main",
      "SELECT",
      table,
      rows,
      0,
      `SELECT * FROM ${table} WHERE status = 'ACTIVE' LIMIT ${rows}`,
    ]);
  }
}

databaseActivity.push(
  [
    910001,
    900001,
    4,
    "2026-08-20 22:31:08",
    "corp_main",
    "SELECT",
    "finance_payments",
    312,
    0,
    "SELECT * FROM finance_payments WHERE payment_date >= '2026-01-01'",
  ],
  [
    910002,
    900001,
    4,
    "2026-08-20 22:34:19",
    "corp_main",
    "SELECT",
    "vendor_bank_accounts",
    84,
    1,
    "SELECT vendor_name, bank_name, account_number FROM vendor_bank_accounts /* ORCHID-47 */",
  ],
  [
    910003,
    900001,
    4,
    "2026-08-20 22:38:55",
    "hr_core",
    "SELECT",
    "employee_payroll",
    1260,
    1,
    "SELECT employee_id, full_name, bank_account, net_salary FROM employee_payroll /* ORCHID-47 */",
  ],
  [
    910004,
    900001,
    4,
    "2026-08-20 22:42:06",
    "corp_main",
    "SELECT",
    "users",
    30,
    0,
    "SELECT username, role_name, mfa_enabled FROM users",
  ],
  [
    810001,
    800001,
    2,
    "2026-08-20 23:10:04",
    "corp_main",
    "SELECT",
    "finance_payments",
    15000,
    1,
    "SELECT * FROM finance_payments /* CHG-2026-0820 approved backup validation */",
  ],
);

const networkTraffic = [];
let trafficId = 1;
const busyHours = [
  8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15,
  15, 16, 17,
];
for (const { day, isWeekend } of labDays) {
  for (let userId = 1; userId <= people.length; userId += 1) {
    const events =
      userId === 7 ? 18 : isWeekend ? (random() < 0.25 ? 8 : 2) : 36;
    for (let event = 0; event < events; event += 1) {
      const hour =
        userId === 7
          ? Math.floor(random() * 24)
          : isWeekend
            ? 9 + Math.floor(random() * 8)
            : pick(busyHours);
      const internal = random() < 0.72;
      const sent =
        5000 + Math.floor(random() * (random() < 0.006 ? 7500000 : 350000));
      networkTraffic.push([
        trafficId++,
        userId === 7 ? 31 : userId,
        userId,
        timestamp(
          day,
          hour,
          Math.floor(random() * 60),
          Math.floor(random() * 60),
        ),
        userId === 7
          ? "10.20.10.11"
          : `10.20.${Math.ceil(userId / 20)}.${20 + userId}`,
        internal
          ? pick(["10.20.10.12", "10.20.10.20", "10.20.30.15"])
          : "198.51.100.20",
        443,
        sent,
        10000 + Math.floor(random() * 900000),
        "ALLOWED",
      ]);
    }
  }
}
networkTraffic.push(
  [
    900001,
    null,
    4,
    "2026-08-20 22:41:22",
    "10.20.10.12",
    "203.0.113.88",
    443,
    48762134,
    18422,
    "ALLOWED",
  ],
  [
    900002,
    null,
    4,
    "2026-08-20 22:43:10",
    "10.20.10.12",
    "203.0.113.88",
    443,
    12890444,
    9211,
    "ALLOWED",
  ],
  [
    800001,
    31,
    7,
    "2026-08-20 23:16:00",
    "10.20.10.11",
    "10.20.40.10",
    443,
    891234567,
    12502,
    "ALLOWED",
  ],
);

const incidentReports = [
  [
    1,
    null,
    4,
    "2026-08-18 10:14:00",
    "PHISHING_EMAIL",
    "MEDIUM",
    "User reported an email titled Vendor Payment Revision with attachment Payment_Adjustment_ORCHID47.xlsm. Email was deleted without further investigation.",
    "CLOSED",
    "User advised to delete the message.",
  ],
  [
    2,
    null,
    3,
    "2026-08-19 15:30:00",
    "PLANNED_SECURITY_TEST",
    "INFO",
    "Approved vulnerability scan from 192.0.2.44 scheduled for 20 August between 01:00 and 02:00.",
    "CLOSED",
    "Activity approved under SEC-TEST-220.",
  ],
  [
    3,
    800001,
    1,
    "2026-08-20 22:55:00",
    "EMERGENCY_MAINTENANCE",
    "LOW",
    "DBA requested emergency validation after the finance batch failed. Work window approved until midnight.",
    "CLOSED",
    "Activity matched change reference CHG-2026-0820.",
  ],
  [
    4,
    900001,
    30,
    "2026-08-20 22:48:00",
    "DATA_TRANSFER_ALERT",
    "HIGH",
    "SOC observed an unusual outbound transfer from the database network to 203.0.113.88.",
    "OPEN",
    null,
  ],
  [
    5,
    900001,
    5,
    "2026-08-21 08:12:00",
    "USER_COMPLAINT",
    "MEDIUM",
    "Finance manager reported that Nina's account showed activity while Nina stated she was already offline.",
    "OPEN",
    null,
  ],
];

const schema = `-- Synthetic training data for the SQL Audit Incident Lab.
-- All persons, addresses, events, and identifiers are fictional.
-- Import into an empty MySQL/MariaDB database selected by the instructor.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS incident_reports;
DROP TABLE IF EXISTS network_traffic;
DROP TABLE IF EXISTS database_activity;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  department VARCHAR(80) NOT NULL,
  role_name VARCHAR(80) NOT NULL,
  work_start TIME NOT NULL,
  work_end TIME NOT NULL,
  mfa_enabled BOOLEAN NOT NULL,
  account_status VARCHAR(20) NOT NULL
);

CREATE TABLE assets (
  asset_id INT PRIMARY KEY,
  owner_user_id INT NOT NULL,
  asset_tag VARCHAR(30) NOT NULL UNIQUE,
  hostname VARCHAR(80) NOT NULL,
  device_type VARCHAR(40) NOT NULL,
  registered_ip VARCHAR(45),
  asset_status VARCHAR(20) NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

CREATE TABLE login_logs (
  login_id BIGINT PRIMARY KEY,
  user_id INT NOT NULL,
  asset_id INT NULL,
  attempted_at DATETIME NOT NULL,
  source_ip VARCHAR(45) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  login_status VARCHAR(20) NOT NULL,
  failure_reason VARCHAR(80),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
);

CREATE TABLE database_activity (
  activity_id BIGINT PRIMARY KEY,
  login_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  executed_at DATETIME NOT NULL,
  database_name VARCHAR(80) NOT NULL,
  query_type VARCHAR(20) NOT NULL,
  target_table VARCHAR(80) NOT NULL,
  returned_rows INT NOT NULL,
  exported BOOLEAN NOT NULL,
  query_text TEXT NOT NULL,
  FOREIGN KEY (login_id) REFERENCES login_logs(login_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE network_traffic (
  traffic_id BIGINT PRIMARY KEY,
  asset_id INT NULL,
  user_id INT NOT NULL,
  captured_at DATETIME NOT NULL,
  source_ip VARCHAR(45) NOT NULL,
  destination_ip VARCHAR(45) NOT NULL,
  destination_port INT NOT NULL,
  bytes_sent BIGINT NOT NULL,
  bytes_received BIGINT NOT NULL,
  action VARCHAR(20) NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE incident_reports (
  report_id BIGINT PRIMARY KEY,
  related_login_id BIGINT NULL,
  reported_by_user_id INT NOT NULL,
  opened_at DATETIME NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  report_status VARCHAR(20) NOT NULL,
  resolution_notes TEXT,
  FOREIGN KEY (related_login_id) REFERENCES login_logs(login_id),
  FOREIGN KEY (reported_by_user_id) REFERENCES users(user_id)
);
`;

const output = [
  schema,
  insert(
    "users",
    [
      "user_id",
      "username",
      "full_name",
      "department",
      "role_name",
      "work_start",
      "work_end",
      "mfa_enabled",
      "account_status",
    ],
    users,
  ),
  insert(
    "assets",
    [
      "asset_id",
      "owner_user_id",
      "asset_tag",
      "hostname",
      "device_type",
      "registered_ip",
      "asset_status",
    ],
    assets,
  ),
  insert(
    "login_logs",
    [
      "login_id",
      "user_id",
      "asset_id",
      "attempted_at",
      "source_ip",
      "country_code",
      "login_status",
      "failure_reason",
    ],
    loginLogs,
  ),
  insert(
    "database_activity",
    [
      "activity_id",
      "login_id",
      "user_id",
      "executed_at",
      "database_name",
      "query_type",
      "target_table",
      "returned_rows",
      "exported",
      "query_text",
    ],
    databaseActivity,
  ),
  insert(
    "network_traffic",
    [
      "traffic_id",
      "asset_id",
      "user_id",
      "captured_at",
      "source_ip",
      "destination_ip",
      "destination_port",
      "bytes_sent",
      "bytes_received",
      "action",
    ],
    networkTraffic,
  ),
  insert(
    "incident_reports",
    [
      "report_id",
      "related_login_id",
      "reported_by_user_id",
      "opened_at",
      "report_type",
      "severity",
      "description",
      "report_status",
      "resolution_notes",
    ],
    incidentReports,
  ),
].join("\n");

mkdirSync("sql", { recursive: true });
writeFileSync("sql/audit_incident_lab.sql", output, "utf8");
console.log(
  JSON.stringify(
    {
      users: users.length,
      assets: assets.length,
      login_logs: loginLogs.length,
      database_activity: databaseActivity.length,
      network_traffic: networkTraffic.length,
      incident_reports: incidentReports.length,
    },
    null,
    2,
  ),
);
