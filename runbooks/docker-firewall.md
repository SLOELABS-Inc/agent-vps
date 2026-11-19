# Docker bypasses UFW

`ufw deny 5432` does nothing for a container published with `-p 5432:5432`. Docker rewrites the destination (DNAT)
before UFW's chains see the packet, and forwarded traffic never passes INPUT at all.

Pick one:

1. **Publish on loopback** and reach it through a tunnel or reverse proxy: `-p 127.0.0.1:5432:5432`.
2. **Filter in `DOCKER-USER`**, matching the ORIGINAL destination port, with replies allowed first:
   ```bash
   iptables -I DOCKER-USER 1 -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
   iptables -I DOCKER-USER 2 -p tcp -m conntrack --ctorigdstport 5432 ! -s <trusted-ip> -j DROP
   iptables -L DOCKER-USER -n --line-numbers     # the DROP must come before any RETURN/ACCEPT that would match first
   ```
   `--dport 5432` does not work here if the container port differs: by the time the filter runs, the port has been
   rewritten. Keep the RELATED,ESTABLISHED RETURN first: a broader DROP added later would otherwise catch reply
   traffic and connections hang instead of failing.
   These are IPv4 rules. If Docker has IPv6 enabled, repeat them with `ip6tables`.
   Persist the rules with a systemd unit ordered after `docker.service`, or a reboot silently re-exposes the port.
3. **Add a cloud firewall** at your provider. It filters before the packet reaches the box, so Docker can't bypass it.

Verify from outside the box (`nc -zv <public-ip> 5432` from another machine), not from the box itself.
