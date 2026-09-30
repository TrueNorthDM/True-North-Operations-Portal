"""
Close Supabase Studio on the public address (db.truenorthportal.online).

Envoy's route for "/" sends everyone to Studio behind a username and password.
This writes a copy of Supabase's lds.template.yaml where that route denies
everything, the same way the file already denies /mcp; docker-compose.tnportal.yml
mounts the copy in place of the original. Studio stays reachable on the server
itself (127.0.0.1:3010), through an SSH tunnel. Run by apply-env.sh, so an update
of Supabase's files gets the same change again.

Python 3.6 (the server's platform-python).
"""
import sys

src, out = sys.argv[1], sys.argv[2]
text = open(src).read()

anchor = "                      - match:\n                          prefix: /\n                        route:\n                          cluster: studio\n"
start = text.find(anchor)
if start < 0:
    sys.exit("close-studio: the Studio route was not found; Supabase's file has changed, check it by hand.")
end = text.find("                      - match:", start + len(anchor))
block = text[start:end if end > 0 else len(text)]

allow = "                                action: ALLOW\n                                policies:\n                                  allow_all:\n"
deny = "                                action: DENY\n                                policies:\n                                  deny_all:\n"
if allow not in block:
    sys.exit("close-studio: the Studio route has no allow_all rule to turn around; check it by hand.")
block = block.replace(allow, deny, 1)

open(out, "w").write(text[:start] + block + text[start + len(block):])
print("close-studio: Studio denied on the public address")
