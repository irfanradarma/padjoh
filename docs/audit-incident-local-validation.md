# Local Validation Report: SQL Audit Incident Lab

Validation date: 12 September 2026  
Environment: local, in-memory SQL database  
Deployment status: not deployed

## Outcome

The dataset, audit program, and instructor solution form a coherent 55–65 minute classroom activity for students who have just learned `JOIN`. The core SQL work fits a 60-minute session; the final 100–150 word conclusion can be finished immediately afterward when a student needs additional syntax-debugging time.

The validation script successfully created all six tables from the generated SQL and executed checks covering:

- table and row counts;
- department and asset joins;
- failed-login aggregation;
- out-of-hours login detection;
- successful login without a registered asset;
- a three-table database activity trail;
- exported-record aggregation;
- large external network transfers;
- incident report context; and
- the easter egg across two evidence sources.

## Data volume

| Table | Rows |
|---|---:|
| `users` | 30 |
| `assets` | 31 |
| `login_logs` | 2.134 |
| `database_activity` | 6.862 |
| `network_traffic` | 11.143 |
| `incident_reports` | 5 |

The volume is large enough to discourage visual guessing but small enough for fast classroom queries.

## Desk-run of the audit

| Activity | Estimated student time |
|---|---:|
| Read scenario and inspect six tables | 4 minutes |
| Procedures 1–4: descriptive profiling and first join | 15 minutes |
| Procedures 5–7: login investigation | 15 minutes |
| Procedures 8–9: database activity and exports | 13 minutes |
| Procedure 10: network evidence | 7 minutes |
| Procedures 11–12: context and conclusion | 6 minutes |
| **Total** | **60 minutes** |

Query execution itself is effectively instantaneous. The allocated time is mainly for interpreting results and correcting query syntax.

## Difficulty assessment

- Procedures 1–3 establish normal daily and hourly behaviour through aggregation.
- Procedures 4, 6, 7, 9, 10, and 11 use two-table joins.
- Only Procedure 8 uses a three-table join.
- No window functions, CTEs, correlated subqueries, or complex date arithmetic are required.
- The final conclusion tests audit judgment rather than advanced SQL.

This is appropriate for students at introductory `JOIN` level. If the class has not learned `HAVING` or `COUNT(DISTINCT ...)`, the instructor should provide those expressions as hints.

## Evidence sufficiency

The main finding is supported by independent evidence from four sources:

1. `login_logs`: password spraying, foreign IP, successful out-of-hours session, and missing registered asset.
2. `database_activity`: sensitive Finance and HR queries followed by two exports.
3. `network_traffic`: two large outbound transfers to the same external destination.
4. `incident_reports`: earlier phishing report, SOC transfer alert, and confirmation that the account owner was offline.

The dataset also contains sufficient contradictory context to require audit judgment:

- an approved vulnerability scan produces many failed logins;
- approved DBA maintenance occurs late at night and exports more rows than the attacker;
- an internal backup transfer is much larger than the malicious transfer.

## Hidden clue

`ORCHID-47` links the earlier phishing attachment to comments recorded in two malicious database queries. This clue is optional and suitable as bonus evidence. It is not required to identify the incident.

## Validation command

```powershell
python scripts/verify-audit-incident-lab.py
```

All automated validation checks must pass before deployment.
