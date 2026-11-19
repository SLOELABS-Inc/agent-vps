# 02. The monitor died with the thing it monitored

**What happened.** We ran three servers and thought that meant redundancy. All three were in one datacenter. A
provider-side network event took all of them offline for 3 hours 4 minutes: production, the agents, SSH, everything.

Nobody was alerted for the full three hours, because the uptime monitor ran on one of the three servers.

**How we knew it was the network and not us.** No host rebooted, no service stopped. Two outbound tunnels dropped 13
seconds apart and came back 2 seconds apart. Separate machines rarely fail in lockstep; a shared network does.

**What changed.** Outage alerting moved to a service at the edge, outside that datacenter, so it does not go down with it.
Three servers in one datacenter is capacity, not availability.

**Rule.** Put the thing that pages you outside the failure domain it watches.
