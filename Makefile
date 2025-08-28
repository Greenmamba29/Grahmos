SHELL := /bin/bash
.ONESHELL:
.DEFAULT_GOAL := help

# Colors for output
Y := \033[33m
G := \033[32m
R := \033[31m
B := \033[34m
P := \033[35m
C := \033[36m
N := \033[0m

# Configuration
DOCKER_COMPOSE := docker compose -f infra/docker/docker-compose.yml
EDGE_DIR := ./edge
PWA_DIR := ./apps/pwa
API_DIR := ./apps/edge-api

# Help target
help: ## Show this help message
	@echo -e "$(C)Grahmos Edge Security & Speed Deployment Pack - V1+V2 Unified$(N)"
	@echo -e "$(C)========================================================$(N)"
	@echo ""
	@echo -e "$(G)Available targets:$(N)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(Y)%-20s$(N) %s\n", $$1, $$2}'
	@echo ""
	@echo -e "$(B)Quick Start:$(N)"
	@echo -e "  $(Y)make bootstrap$(N)  # Install dependencies"
	@echo -e "  $(Y)make build$(N)      # Build all packages"
	@echo -e "  $(Y)make certs$(N)      # Generate certificates"
	@echo -e "  $(Y)make up$(N)         # Start infrastructure"
	@echo -e "  $(Y)make dev$(N)        # Start development servers"

# Main targets
all: bootstrap build certs up ## Full setup: install deps, build, generate certs, start infra

bootstrap: ## Install all dependencies
	@echo -e "$(Y)> Installing workspace dependencies$(N)"
	pnpm install
	@echo -e "$(G)✅ Dependencies installed$(N)"

build: ## Build all packages and apps
	@echo -e "$(Y)> Building workspace packages$(N)"
	pnpm -r --filter './apps/*' --filter './packages/*' build
	@if [ -d "$(EDGE_DIR)" ]; then \
		echo -e "$(Y)> Building V1 edge components$(N)"; \
		cd $(EDGE_DIR) && npm run build 2>/dev/null || echo "V1 edge build skipped"; \
	fi
	@echo -e "$(G)✅ Build completed$(N)"

clean: ## Clean all build artifacts and dependencies
	@echo -e "$(Y)> Cleaning workspace$(N)"
	pnpm -r clean || true
	rm -rf node_modules
	rm -rf apps/*/node_modules packages/*/node_modules
	rm -rf apps/*/dist packages/*/dist
	@if [ -d "$(EDGE_DIR)" ]; then \
		cd $(EDGE_DIR) && npm run clean 2>/dev/null || true; \
	fi
	@echo -e "$(G)✅ Workspace cleaned$(N)"

# Infrastructure targets
up: ## Start all infrastructure services
	@echo -e "$(Y)> Starting infrastructure services$(N)"
	$(DOCKER_COMPOSE) up -d --build
	@sleep 5
	@echo -e "$(G)✅ Infrastructure started$(N)"
	@echo -e "$(B)Services available at:$(N)"
	@echo -e "  • Edge API: https://localhost:8443"
	@echo -e "  • Meilisearch: http://localhost:7700"
	@echo -e "  • Health: curl -k https://localhost:8443/health"

down: ## Stop all infrastructure services
	@echo -e "$(Y)> Stopping infrastructure services$(N)"
	$(DOCKER_COMPOSE) down
	@echo -e "$(G)✅ Infrastructure stopped$(N)"

restart: down up ## Restart all services

logs: ## Show infrastructure logs
	$(DOCKER_COMPOSE) logs -f

ps: ## Show running services
	$(DOCKER_COMPOSE) ps

# Development targets
dev: ## Start all development servers
	@echo -e "$(Y)> Starting development servers$(N)"
	@if command -v concurrently >/dev/null 2>&1; then \
		pnpm dev:all; \
	else \
		echo -e "$(R)concurrently not found, starting services separately$(N)"; \
		echo -e "$(B)Run 'make edge' and 'make pwa' in separate terminals$(N)"; \
	fi

edge: ## Start Edge API development server
	@echo -e "$(Y)> Starting Edge API dev server$(N)"
	pnpm --filter @apps/edge-api dev

pwa: ## Start PWA development server  
	@echo -e "$(Y)> Starting PWA dev server$(N)"
	pnpm --filter @apps/pwa dev

assistant: ## Test assistant package
	@echo -e "$(Y)> Testing assistant package$(N)"
	pnpm --filter @packages/assistant test

# Certificate management
certs: ## Generate development certificates
	@echo -e "$(Y)> Generating development certificates$(N)"
	@if [ -f "scripts/generate-certs.sh" ]; then \
		bash scripts/generate-certs.sh; \
	elif [ -f "$(EDGE_DIR)/ops/generate-certificates.sh" ]; then \
		cd $(EDGE_DIR) && bash ops/generate-certificates.sh; \
	else \
		echo -e "$(R)❌ Certificate generation script not found$(N)"; \
		exit 1; \
	fi
	@echo -e "$(G)✅ Certificates generated$(N)"

certs-renew: ## Renew certificates
	@echo -e "$(Y)> Renewing certificates$(N)"
	@if [ -f "scripts/generate-certs.sh" ]; then \
		bash scripts/generate-certs.sh --renew; \
	elif [ -f "$(EDGE_DIR)/ops/generate-certificates.sh" ]; then \
		cd $(EDGE_DIR) && bash ops/generate-certificates.sh --renew; \
	else \
		echo -e "$(R)❌ Certificate generation script not found$(N)"; \
		exit 1; \
	fi
	@echo -e "$(G)✅ Certificates renewed$(N)"

# Data management
index-warmup: ## Warm up search index
	@echo -e "$(Y)> Warming up search index$(N)"
	@if [ -f "scripts/warmup.sh" ]; then \
		bash scripts/warmup.sh; \
	else \
		echo -e "$(R)❌ Warmup script not found$(N)"; \
		exit 1; \
	fi
	@echo -e "$(G)✅ Index warmed up$(N)"

index-update: ## Update search index
	@echo -e "$(Y)> Updating search index$(N)"
	@if [ -f "scripts/update-index.sh" ]; then \
		bash scripts/update-index.sh; \
	else \
		echo -e "$(R)❌ Index update script not found$(N)"; \
		exit 1; \
	fi
	@echo -e "$(G)✅ Index updated$(N)"

# Testing targets
test: ## Run all tests
	@echo -e "$(Y)> Running all tests$(N)"
	pnpm -r test
	@echo -e "$(G)✅ All tests completed$(N)"

test-security: ## Run security tests
	@echo -e "$(Y)> Running security tests$(N)"
	@if [ -f "scripts/test-security.sh" ]; then \
		bash scripts/test-security.sh; \
	elif [ -f "$(EDGE_DIR)/test-security-lite.sh" ]; then \
		cd $(EDGE_DIR) && bash test-security-lite.sh; \
	else \
		echo -e "$(R)❌ Security test script not found$(N)"; \
		exit 1; \
	fi

test-performance: ## Run performance tests
	@echo -e "$(Y)> Running performance tests$(N)"
	@if [ -f "scripts/test-performance.sh" ]; then \
		bash scripts/test-performance.sh; \
	elif [ -f "$(EDGE_DIR)/test-performance-lite.sh" ]; then \
		cd $(EDGE_DIR) && bash test-performance-lite.sh; \
	else \
		echo -e "$(R)❌ Performance test script not found$(N)"; \
		exit 1; \
	fi

test-integration: ## Run integration tests
	@echo -e "$(Y)> Running integration tests$(N)"
	@if [ -f "scripts/test-integration.sh" ]; then \
		bash scripts/test-integration.sh; \
	elif [ -f "$(EDGE_DIR)/test-integration.sh" ]; then \
		cd $(EDGE_DIR) && bash test-integration.sh; \
	else \
		echo -e "$(R)❌ Integration test script not found$(N)"; \
		exit 1; \
	fi

# Quality targets
lint: ## Run linters
	@echo -e "$(Y)> Running linters$(N)"
	pnpm -r lint
	@echo -e "$(G)✅ Linting completed$(N)"

typecheck: ## Run TypeScript type checking
	@echo -e "$(Y)> Running TypeScript type checking$(N)"
	pnpm -r typecheck
	@echo -e "$(G)✅ Type checking completed$(N)"

format: ## Format code
	@echo -e "$(Y)> Formatting code$(N)"
	pnpm -r format || echo "Format scripts not available"
	@echo -e "$(G)✅ Code formatted$(N)"

# Health and status
health: ## Check service health
	@echo -e "$(Y)> Checking service health$(N)"
	@echo -e "$(B)Edge API Health:$(N)"
	@curl -k -s https://localhost:8443/health | jq '.' 2>/dev/null || curl -k -s https://localhost:8443/health || echo "Edge API not accessible"
	@echo ""
	@echo -e "$(B)Meilisearch Health:$(N)"
	@curl -s http://localhost:7700/health 2>/dev/null || echo "Meilisearch not accessible"
	@echo ""
	@echo -e "$(B)Container Status:$(N)"
	@$(DOCKER_COMPOSE) ps

status: health ## Alias for health

# Production deployment
deploy-prod: ## Deploy to production
	@echo -e "$(Y)> Deploying to production$(N)"
	@if [ -f "$(EDGE_DIR)/deploy-production.sh" ]; then \
		cd $(EDGE_DIR) && bash deploy-production.sh; \
	else \
		echo -e "$(R)❌ Production deployment script not found$(N)"; \
		exit 1; \
	fi

# Docker utilities
docker-build: ## Build Docker images
	@echo -e "$(Y)> Building Docker images$(N)"
	$(DOCKER_COMPOSE) build

docker-pull: ## Pull latest Docker images
	@echo -e "$(Y)> Pulling latest Docker images$(N)"
	$(DOCKER_COMPOSE) pull

docker-prune: ## Clean up Docker resources
	@echo -e "$(Y)> Cleaning up Docker resources$(N)"
	docker system prune -f
	docker volume prune -f

# Backup and restore
backup: ## Create backup
	@echo -e "$(Y)> Creating backup$(N)"
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	mkdir -p backups/$$TIMESTAMP; \
	cp -r infra/certs backups/$$TIMESTAMP/ 2>/dev/null || true; \
	cp -r infra/docker/data backups/$$TIMESTAMP/ 2>/dev/null || true; \
	cp .env backups/$$TIMESTAMP/ 2>/dev/null || true; \
	tar -czf backups/backup_$$TIMESTAMP.tar.gz backups/$$TIMESTAMP/; \
	rm -rf backups/$$TIMESTAMP/; \
	echo -e "$(G)✅ Backup created: backups/backup_$$TIMESTAMP.tar.gz$(N)"

restore: ## Restore from backup (usage: make restore BACKUP=backup_20240101_120000.tar.gz)
	@if [ -z "$(BACKUP)" ]; then \
		echo -e "$(R)❌ Usage: make restore BACKUP=backup_file.tar.gz$(N)"; \
		exit 1; \
	fi
	@echo -e "$(Y)> Restoring from $(BACKUP)$(N)"
	@tar -xzf backups/$(BACKUP) -C /tmp/
	@BACKUP_DIR=$$(basename $(BACKUP) .tar.gz); \
	cp -r /tmp/backups/$$BACKUP_DIR/* ./; \
	rm -rf /tmp/backups/$$BACKUP_DIR; \
	echo -e "$(G)✅ Restore completed from $(BACKUP)$(N)"

# Release management
release-rc: ## Create release candidate
	@echo -e "$(Y)> Creating release candidate$(N)"
	@TIMESTAMP=$$(date +%H%M); \
	git tag -a v2.0.0-rc$$TIMESTAMP -m "V1+V2 unified release candidate $$TIMESTAMP"; \
	echo -e "$(G)✅ Release candidate created: v2.0.0-rc$$TIMESTAMP$(N)"

release: ## Create production release
	@echo -e "$(Y)> Creating production release$(N)"
	git tag -a v2.0.0 -m "V1+V2 unified production release"
	@echo -e "$(G)✅ Production release created: v2.0.0$(N)"

# Environment setup
env-dev: ## Copy development environment template
	@if [ ! -f ".env" ]; then \
		echo -e "$(Y)> Creating development environment file$(N)"; \
		cp .env.example .env; \
		echo -e "$(G)✅ Environment file created. Please customize .env$(N)"; \
	else \
		echo -e "$(B)Environment file already exists$(N)"; \
	fi

env-prod: ## Setup production environment
	@echo -e "$(Y)> Setting up production environment$(N)"
	@echo -e "$(R)⚠️  This will modify your .env file$(N)"
	@read -p "Continue? (y/N): " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		sed -i.backup 's/NODE_ENV=development/NODE_ENV=production/' .env; \
		sed -i.backup 's/DEV_MODE=true/DEV_MODE=false/' .env; \
		sed -i.backup 's/ENABLE_DEBUG=true/ENABLE_DEBUG=false/' .env; \
		echo -e "$(G)✅ Production environment configured$(N)"; \
	else \
		echo -e "$(B)Operation cancelled$(N)"; \
	fi

# Documentation
docs: ## Generate documentation
	@echo -e "$(Y)> Generating documentation$(N)"
	@echo -e "$(B)Available documentation:$(N)"
	@echo -e "  • README-edge-security.md (V1 Edge Security Pack)"
	@echo -e "  • .env.example (Environment configuration)"
	@echo -e "  • This Makefile (make help)"

# Utility targets
port-check: ## Check if required ports are available
	@echo -e "$(Y)> Checking required ports$(N)"
	@for port in 8443 8080 7700 3000 5173; do \
		if lsof -i :$$port >/dev/null 2>&1; then \
			echo -e "  $(R)❌ Port $$port is in use$(N)"; \
		else \
			echo -e "  $(G)✅ Port $$port is available$(N)"; \
		fi; \
	done

deps-check: ## Check system dependencies
	@echo -e "$(Y)> Checking system dependencies$(N)"
	@for cmd in node pnpm docker docker-compose curl jq make; do \
		if command -v $$cmd >/dev/null 2>&1; then \
			echo -e "  $(G)✅ $$cmd$(N)"; \
		else \
			echo -e "  $(R)❌ $$cmd (missing)$(N)"; \
		fi; \
	done

# Development utilities
shell-edge: ## Open shell in edge API container
	$(DOCKER_COMPOSE) exec edge-api sh

shell-nginx: ## Open shell in nginx container  
	$(DOCKER_COMPOSE) exec nginx sh

tail-edge: ## Tail edge API logs
	$(DOCKER_COMPOSE) logs -f edge-api

tail-nginx: ## Tail nginx logs
	$(DOCKER_COMPOSE) logs -f nginx

# Force targets
.PHONY: help all bootstrap build clean up down restart logs ps dev edge pwa assistant \
	certs certs-renew index-warmup index-update test test-security test-performance \
	test-integration lint typecheck format health status deploy-prod docker-build \
	docker-pull docker-prune backup restore release-rc release env-dev env-prod docs \
	port-check deps-check shell-edge shell-nginx tail-edge tail-nginx
