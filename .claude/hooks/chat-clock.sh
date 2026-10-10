#!/usr/bin/env bash
# SessionStart hook: shows the date and time when a chat starts and hands it to Claude.
# Change CHAT_CLOCK_TZ (an IANA zone like America/New_York) to use another time zone.
zone="${CHAT_CLOCK_TZ:-America/Los_Angeles}"
source="$(cat | grep -o '"source" *: *"[a-z]*"' | grep -o '[a-z]*"$' | tr -d '"')"

# A compaction is the same chat carrying on: stay quiet.
[ "$source" = "compact" ] && exit 0

case "$source" in
  resume) opener="Welcome back" ;;
  *) opener="New chat" ;;
esac

now="$(TZ="$zone" date '+%a, %b %-d, %Y · %-I:%M %p %Z')"

printf '{"systemMessage":"📅 %s: %s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This chat started on %s (date and time). Open your first reply with one short line stating both the full date and the time, then answer as usual."}}\n' \
  "$opener" "$now" "$now"
