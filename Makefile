# Uso: make models  (lee INFERHUB_API_KEY del entorno o de .env.local)
-include .env.local
export

INFERHUB_BASE_URL ?= https://api.inferhub.dev/v1

.PHONY: models
models:
	@test -n "$(INFERHUB_API_KEY)" || { echo "Falta INFERHUB_API_KEY (entorno o .env.local)"; exit 1; }
	@curl -sS -H "Authorization: Bearer $(INFERHUB_API_KEY)" $(INFERHUB_BASE_URL)/models | (jq -r '.data[].id' 2>/dev/null || cat)
