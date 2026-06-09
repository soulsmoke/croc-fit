# Makefile — croc-fit monorepo release helpers

.PHONY: release changelog tag

# Create a new release:
#   make release VERSION=1.1.0
#
# Steps:
#   1. Bumps version in croc-fit-app/package.json
#   2. Bumps version in croc-fit-api/pyproject.toml
#   3. Regenerates CHANGELOG.md with git-cliff
#   4. Creates a version commit + git tag
release:
ifndef VERSION
	$(error VERSION is required: make release VERSION=1.1.0)
endif
	@echo "Bumping app version to $(VERSION)..."
	cd croc-fit-app && npm version $(VERSION) --no-git-tag-version
	@echo "Bumping api version to $(VERSION)..."
	sed -i '' 's/^version = ".*"/version = "$(VERSION)"/' croc-fit-api/pyproject.toml
	@echo "Generating CHANGELOG..."
	git-cliff --tag v$(VERSION) -o CHANGELOG.md
	@echo "Committing and tagging..."
	git add CHANGELOG.md croc-fit-app/package.json croc-fit-api/pyproject.toml
	git commit -m "chore(release): v$(VERSION)"
	git tag -a v$(VERSION) -m "v$(VERSION)"
	@echo "Done! Push with: git push origin main --tags"

# Preview changelog for the next version (without creating a tag/commit)
#   make changelog VERSION=1.1.0
changelog:
ifndef VERSION
	$(error VERSION is required: make changelog VERSION=1.1.0)
endif
	git-cliff --tag v$(VERSION) --unreleased

# Generate full CHANGELOG.md from all tags (safe, no commit)
changelog-full:
	git-cliff -o CHANGELOG.md
