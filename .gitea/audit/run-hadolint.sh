#!/usr/bin/env bash
# Hadolint wrapper:
#   - JSON output → workflow annotations (::warning/::error) que Gitea
#     renderiza como comentários inline no PR (file + line + message)
#   - Threshold: só level=error quebra CI; warnings/style/info anotam mas
#     o exit é 0. Equivalente a --failure-threshold=error mas mantemos o
#     parsing aqui para uniformizar o formato das annotations.
#
# Uso: run-hadolint.sh <Dockerfile> [Dockerfile2 ...]
#
# Workflow command syntax (GitHub Actions-compatible, Gitea Actions
# implementa-o desde 1.21):
#   ::warning file=X,line=Y,col=Z,title=CODE::Mensagem

set -eu  # NÃO -o pipefail: hadolint exits 1 se houver findings (qualquer
         # severidade), e queremos deixar o python decidir o exit final.

if [ $# -lt 1 ]; then
  echo "usage: $0 <Dockerfile> [...]" >&2
  exit 2
fi

/opt/audit-bin/hadolint --no-color --format json "$@" | python3 -c '
import json
import sys

data = json.load(sys.stdin)

if not data:
    print("✓ hadolint: no issues")
    sys.exit(0)

exit_code = 0

# Section header para o log humano
print(f"## hadolint: {len(data)} finding(s)")
print()
print("| File | Line | Code | Level | Message |")
print("| ---- | ---- | ---- | ----- | ------- |")

for item in data:
    level = item.get("level", "info")
    file = item["file"]
    line = item["line"]
    col = item.get("column", 1)
    code = item["code"]
    msg = item["message"]

    # Markdown row (log readable)
    print(f"| `{file}` | {line} | `{code}` | {level} | {msg} |")

    # Gitea annotation (PR-visible)
    annot = "error" if level == "error" else "warning"
    # Escape commas/colons em msg/title (Gitea splits on them)
    safe_msg = msg.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::{annot} file={file},line={line},col={col},title={code}::{safe_msg}")

    if level == "error":
        exit_code = 1

sys.exit(exit_code)
'
