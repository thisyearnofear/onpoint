# Monitoring Runbook

> How to operate and debug the OnPoint agent monitoring stack on Hetzner.

## Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Hetzner VPS (snel-bot)                                    │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ onpoint-api  │   │onpoint-worker│   │onpoint-signer│  │
│  │  :48751      │   │  (PM2)       │   │  :48755      │  │
│  └──────┬───────┘   └──────┬───────┘   └──────────────┘  │
│         │                  │                               │
│         │  /metrics         │ heartbeat (5 min)          │
│         ▼                  ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Prometheus (:9090)  ← scrape targets               │  │
│  │  - onpoint-agent (/api/agent/metrics)              │  │
│  │  - node-exporter (:9100, host metrics)             │  │
│  └─────────────────────────────────────────────────────┘  │
│         │                                                 │
│         ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Grafana (:3000)  ← dashboards + alerting           │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Start the monitoring stack

```bash
ssh snel-bot
cd /opt/onpoint
docker compose -f deploy/docker-compose.monitoring.yml up -d
```

### Verify everything is healthy

```bash
# Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | .labels.job, .health'

# Prometheus metrics endpoint
curl http://localhost:48751/api/agent/metrics | head -20

# Grafana
open http://localhost:3000
# Login: admin / admin (change on first login)
```

### Stop the stack

```bash
ssh snel-bot "cd /opt/onpoint && docker compose -f deploy/docker-compose.monitoring.yml down"
```

---

## Dashboards

### Agent Overview (Grafana)

**URL:** `http://localhost:3000/d/agent-overview`

Panels:

| Panel | What it shows |
|---|---|
| **Agent Status** | `agent_up` gauge — green if heartbeat is running |
| **Gas Balance** | CELO balance of agent wallet (gauge, threshold at 0.5 CELO) |
| **Action Throughput** | Rate of attempted/succeeded/failed actions per minute |
| **p99 Latency** | Per-action-type latency percentiles |
| **Escrow Balances** | Top 10 user escrow balances |
| **Proactive Tasks** | Heartbeat task counts (retries, prunes, alerts) |
| **Pending Approvals** | Count of pending approval requests |

### Prometheus Targets

| Target | Endpoint | What it exports |
|---|---|---|
| `onpoint-agent` | `http://localhost:48751/api/agent/metrics` | Agent action counters, latency histograms, escrow snapshots, gas balance, proactive task results |
| `node` | `http://localhost:9100/metrics` | Host CPU, memory, disk, network |
| `prometheus` | `http://localhost:9090/metrics` | Self-monitoring (scrape health, TSDB size) |

---

## Syncing config changes

The monitoring stack lives in `/opt/onpoint/deploy/` on the server, outside
the API release tree (which is managed by `scripts/deploy-api.sh`). For
monitoring config changes, use `scripts/sync-monitoring.sh`:

```bash
# Sync prometheus.yml, prometheus-alerts.yml, and grafana/, then
# reload Prometheus in place (no container restart).
./scripts/sync-monitoring.sh

# Preview only
./scripts/sync-monitoring.sh --dry-run

# Also restart Grafana (needed when dashboard JSON or provisioning
# files change — bind-mounted configs don't hot-reload).
./scripts/sync-monitoring.sh --restart
```

The script:

1. Rsyncs `deploy/` to the server (excludes `.env*` files).
2. Triggers `POST /-/reload` on Prometheus so config changes apply
   without a container restart (requires `--web.enable-lifecycle`,
   which is set in `docker-compose.monitoring.yml`).
3. Optionally restarts Grafana.
4. Verifies all Prometheus targets are `up` and Grafana's datasource
   and dashboard are loaded.

---

## Alert Reference

All alerts are defined in `deploy/prometheus-alerts.yml` and route by `team` label.

### Critical (Pager)

| Alert | Trigger | Immediate Action |
|---|---|---|
| **AgentDown** | `agent_up` metric absent >30s | `pm2 status onpoint-api` — restart if needed |
| **AgentGasCritical** | CELO balance < 0.01 | Send CELO to agent wallet immediately |
| **HeartbeatStopped** | All proactive task metrics absent >10min | `pm2 logs onpoint-worker --lines 50` |
| **StaleApprovalsSustained** | Stale approval alerts firing >30min | Check messaging bridge + approval route logs |

### Warning (Investigate in business hours)

| Alert | Trigger | Investigation |
|---|---|---|
| **AgentGasLow** | CELO balance < 0.5 | Plan refill from platform treasury |
| **AgentGasUnknown** | Gas balance metric absent >5min | `pm2 logs onpoint-api --lines 20 | grep gas` |
| **HighSpendingLimitRejectionRate** | >20% actions rejected by limits | Review spending limit config, consider adjusting |
| **LatencySpike** | p99 latency >10s for any action | Check RPC provider status, network |
| **EscrowBalanceLow** | User escrow < 1 cUSD | Prompt user to deposit |

### Info (No action needed)

| Alert | Trigger | Meaning |
|---|---|---|
| **EscrowBalanceDepleted** | User escrow = 0 | User needs to top up before agent can act |
| **SuggestionMaxRetries** | Suggestion hit 3 retries | Auto-rejected to prevent infinite loop |

---

## Common Debugging Scenarios

### Agent heartbeat not running

```bash
# 1. Check PM2 status
ssh snel-bot "pm2 status onpoint-worker"

# 2. View recent logs
ssh snel-bot "pm2 logs onpoint-worker --lines 50"

# 3. Manually trigger a heartbeat cycle
curl -X POST http://localhost:48751/api/agent/heartbeat \
  -H "X-Service-Key: $SERVICE_API_KEY"

# 4. Check if proactive tasks ran
curl http://localhost:48751/api/agent/metrics | grep heartbeat_proactive
```

### Gas balance is low or unknown

```bash
# 1. Check current gas balance from metrics
curl http://localhost:48751/api/agent/metrics | grep agent_gas_balance

# 2. Check onchain directly
curl "https://forno.celo.org" \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x5b33E63440e95289207120B94da78CE22F9D24fB","latest"],"id":1}'

# 3. Refill (from your treasury wallet)
# Send CELO to 0x5b33E63440e95289207120B94da78CE22F9D24fB

# 4. Verify refill
curl http://localhost:48751/api/agent/heartbeat -H "X-Service-Key: $SERVICE_API_KEY" | jq '.gasBalance'
```

### Actions failing silently

```bash
# 1. Check action counters
curl http://localhost:48751/api/agent/metrics | grep agent_actions_total

# 2. Check escrow balances
curl http://localhost:48751/api/agent/metrics | grep agent_escrow_balance

# 3. Check pending suggestions
curl http://localhost:48751/api/agent/suggestion \
  -H "X-Service-Key: $SERVICE_API_KEY" | jq '.[] | select(.status=="pending")'

# 4. Check fraud freeze status
curl "http://localhost:48751/api/agent/fraud?agentId=onpoint-stylist&userId=system-worker" \
  -H "X-Service-Key: $SERVICE_API_KEY" | jq '.status'
```

### Prometheus not scraping

```bash
# 1. Verify Prometheus is running
ssh snel-bot "docker ps | grep prometheus"

# 2. Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets'

# 3. Check Prometheus logs
ssh snel-bot "docker logs onpoint-prometheus --tail 20"

# 4. Reload Prometheus config without restarting
ssh snel-bot "docker exec onpoint-prometheus kill -HUP 1"
```

### Grafana dashboards not loading

```bash
# 1. Verify Grafana is running
ssh snel-bot "docker ps | grep grafana"

# 2. Check datasource connection
# Grafana UI → Connections → Data Sources → Prometheus → Save & Test

# 3. Check Prometheus URL in datasource config
cat deploy/grafana/provisioning/datasources/prometheus.yml

# 4. View Grafana logs
ssh snel-bot "docker logs onpoint-grafana --tail 20"
```

---

## Metrics Reference

### Exported Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `agent_up` | gauge | `job` | 1 if agent is healthy, 0 if not |
| `agent_gas_balance` | gauge | `address` | CELO balance of agent wallet |
| `agent_actions_total` | counter | `type`, `status` | Count of actions by type and outcome |
| `agent_action_latency` | histogram | `type`, `quantile` | Latency in ms per action type |
| `agent_escrow_balance` | gauge | `user_id` | cUSD balance per user escrow |
| `agent_heartbeat_proactive` | counter | `task` | Count of proactive task executions |
| `agent_spending_limit` | gauge | `agent_id`, `user_id`, `action_type` | Current spending limits |
| `agent_autonomy_threshold` | gauge | `agent_id`, `user_id` | Autonomy threshold in wei |

### Query Examples (Prometheus)

```promql
# Action success rate last 5 minutes
sum(rate(agent_actions_total{status="succeeded"}[5m]))
/
sum(rate(agent_actions_total{status="attempted"}[5m]))

# p99 mint latency
histogram_quantile(0.99, rate(agent_action_latency{type="mint"}[5m]))

# Users with escrow below 5 cUSD
agent_escrow_balance / 1e18 < 5

# Heartbeat proactive task rate
sum(rate(agent_heartbeat_proactive[5m])) by (task)
```

---

## Backup & Restore

### Prometheus data

```bash
# Backup (run from snel-bot)
docker run --rm \
  -v onpoint-prometheus-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v onpoint-prometheus-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/prometheus-backup-YYYYMMDD.tar.gz -C /data
```

### Grafana dashboards

Dashboards are provisioned via `deploy/grafana/provisioning/dashboards/`. After editing JSON dashboards, restart Grafana:

```bash
ssh snel-bot "docker restart onpoint-grafana"
```

---

## Alert Routing

Alerts carry a `team` label. Route alerts by team:

| Team | Responsibility |
|---|---|
| `platform` | Agent availability, gas, heartbeat |
| `agent` | Action latency, spending limits |
| `product` | Escrow, approvals, user-facing flows |

For production alerting, configure Alertmanager to route by team label:

```yaml
# alertmanager.yml
route:
  group_by: ['alertname']
  receiver: 'default'
  routes:
    - match:
        team: platform
      receiver: 'platform-pager'
    - match:
        team: product
      receiver: 'product-slack'
```

---

## Adding New Metrics

1. **Define the metric** in `packages/agent-core/src/metrics.ts`:

```ts
export function countAction(type: string, status: ActionStatus): void {
  if (!actionCounters[type]) actionCounters[type] = {};
  actionCounters[type][status] = (actionCounters[type][status] || 0) + 1;
}
```

2. **Call it** in the relevant service (e.g., `autonomous-executor.ts`):

```ts
import { Metrics } from "@repo/agent-core";
Metrics.countAction("mint", "succeeded");
```

3. **Export from the API** — `apps/api/routes/agent-metrics.js` reads from `Metrics.exportPrometheus()` automatically.

4. **Add to Grafana dashboard** — Edit `deploy/grafana/provisioning/dashboards/agent-overview.json`.

5. **Add alerting rule** — Add to `deploy/prometheus-alerts.yml` under the appropriate group.

---

## Troubleshooting

### "connection refused" on port 9090

Prometheus is not running. Start it:

```bash
ssh snel-bot "cd /opt/onpoint && docker compose -f deploy/docker-compose.monitoring.yml up -d prometheus"
```

### Grafana shows "No data"

1. Check Prometheus is scraping: `curl http://localhost:9090/api/v1/targets`
2. Check the API metrics endpoint: `curl http://localhost:48751/api/agent/metrics`
3. Verify datasource URL in Grafana: `http://localhost:9090` (not `http://prometheus:9090`)

### Alert fires but nothing is wrong

Check the `for` duration in the alert rule. Most alerts require the condition to persist for 2-30 minutes before firing. This prevents flapping on transient issues.

### Metrics endpoint returns 401

The `/api/agent/metrics` endpoint is public (no auth) for Prometheus scraping. If you're getting 401, check that nginx is not adding auth to that route.

---

## On-Call Contacts

| Role | Contact |
|---|---|
| Agent infrastructure | `onpoint-core` |
| Escrow / payments | `onpoint-product` |
| Escalation | `onpoint-lead` |
