"""
The portal server's watch: every 10 minutes (deploy/watch/tnportal-watch.cron),
checks what would otherwise fail in silence, and emails Arnaldo only when a
problem appears or clears (the state is kept in /opt/tnportal/watch/state.json).

  - the Supabase services and the portal: running and healthy
  - the portal and the sign-in service answering
  - free disk space (below 10 GB is a problem)
  - the nightly backup: the last good one is less than 26 hours old

Email goes through Resend with the portal's own key (RESEND_API_KEY in
/opt/tnportal/portal.env). "watch.py --test" sends one email to check the path.

Python 3.6 (the server's platform-python), standard library only.
"""
import calendar, json, os, re, shutil, subprocess, sys, time, urllib.request

TO = "arnaldo.oliveira@me.com"
FROM = "Portal server <portal@truenorthportal.online>"
STATE = "/opt/tnportal/watch/state.json"
CONTAINERS = ["supabase-db", "supabase-auth", "supabase-rest", "supabase-storage", "supabase-imgproxy",
              "supabase-meta", "supabase-studio", "supabase-envoy", "tnportal-portal"]
MIN_FREE_GB = 10
BACKUP_MAX_AGE_H = 26
BACKUP_LOG = "/opt/tnportal/logs/backup.log"


def env_value(path, key):
    for line in open(path):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip("'\"")
    return ""


def http_status(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        return urllib.request.urlopen(req, timeout=15).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def problems():
    found = {}
    out = subprocess.run(["docker", "ps", "-a", "--format", "{{.Names}}\t{{.Status}}"],
                         stdout=subprocess.PIPE, universal_newlines=True).stdout
    status = dict(line.split("\t", 1) for line in out.splitlines() if "\t" in line)
    for name in CONTAINERS:
        s = status.get(name)
        if s is None:
            found["container:" + name] = name + " does not exist"
        elif not s.startswith("Up"):
            found["container:" + name] = name + " is not running (" + s + ")"
        elif "unhealthy" in s:
            found["container:" + name] = name + " is unhealthy"

    if http_status("http://127.0.0.1:3000/login") != 200:
        found["portal"] = "The portal does not answer on 127.0.0.1:3000"
    anon = env_value("/opt/tnportal/supabase/.env", "ANON_KEY")
    if http_status("http://127.0.0.1:8000/auth/v1/health", {"apikey": anon}) != 200:
        found["auth"] = "The sign-in service does not answer"

    free_gb = shutil.disk_usage("/").free / 1024 ** 3
    if free_gb < MIN_FREE_GB:
        found["disk"] = "Only %.1f GB free on the server's disk" % free_gb

    last_ok = None
    if os.path.exists(BACKUP_LOG):
        for line in open(BACKUP_LOG):
            m = re.match(r"(\S+) ok   base ", line)
            if m:
                last_ok = m.group(1)
    if last_ok is None:
        found["backup"] = "No successful nightly backup on record"
    else:
        age_h = (time.time() - calendar.timegm(time.strptime(last_ok, "%Y-%m-%dT%H:%M:%SZ"))) / 3600
        if age_h > BACKUP_MAX_AGE_H:
            found["backup"] = "The last good nightly backup is %d hours old" % age_h
    return found


def send(subject, lines):
    key = env_value("/opt/tnportal/portal.env", "RESEND_API_KEY")
    body = "\n".join(lines) + "\n\nThe portal's server (174.136.29.221), checked every 10 minutes."
    data = json.dumps({"from": FROM, "to": [TO], "subject": subject, "text": body}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=data, method="POST",
                                 # Resend's firewall refuses Python's default client name (error 1010).
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                                          "User-Agent": "tnportal-watch/1.0"})
    urllib.request.urlopen(req, timeout=20).read()


def main():
    if "--test" in sys.argv:
        send("Portal server: the watch is on", ["This is a test. From now on you get an email when something on the portal's server needs attention, and another when it is fixed."])
        print("test email sent")
        return
    now = problems()
    try:
        before = json.load(open(STATE))
    except Exception:
        before = {}
    new = [now[k] for k in sorted(now) if k not in before]
    cleared = [before[k] for k in sorted(before) if k not in now]
    if new:
        send("Portal server: needs attention", ["Problem:"] + ["  - " + p for p in new]
             + ([""] + ["Still open:"] + ["  - " + now[k] for k in sorted(now) if k in before] if len(now) > len(new) else []))
    if cleared and not now:
        send("Portal server: all clear again", ["Fixed:"] + ["  - " + p for p in cleared])
    elif cleared:
        send("Portal server: partly fixed", ["Fixed:"] + ["  - " + p for p in cleared] + ["", "Still open:"] + ["  - " + p for p in now.values()])
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(now, open(STATE, "w"))
    print("%d problem(s): %s" % (len(now), "; ".join(now.values()) or "none"))


main()
