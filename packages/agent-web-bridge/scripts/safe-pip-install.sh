#!/bin/bash
#
# Safe pip install wrapper for agent-web-bridge
# This script checks the blocklist before installing any package
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BLOCKLIST="$PROJECT_DIR/.pip-blocklist.txt"
VENV_PIP="$PROJECT_DIR/venv/bin/pip"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Safe Pip Install Wrapper"
echo "========================================"

# Check if blocklist exists
if [ ! -f "$BLOCKLIST" ]; then
    echo -e "${RED}ERROR: Blocklist not found at $BLOCKLIST${NC}"
    exit 1
fi

# Extract package names from arguments
PACKAGES=()
for arg in "$@"; do
    # Skip flags
    if [[ $arg == -* ]]; then
        continue
    fi
    # Extract package name (before any version specifier)
    pkg_name=$(echo "$arg" | sed 's/[<>=!~\[].*//')
    PACKAGES+=("$pkg_name")
done

# Check each package against blocklist
BLOCKED=()
for pkg in "${PACKAGES[@]}"; do
    pkg_lower=$(echo "$pkg" | tr '[:upper:]' '[:lower:]')
    if grep -qi "^${pkg_lower}$" "$BLOCKLIST" 2>/dev/null; then
        BLOCKED+=("$pkg")
    fi
done

# Report blocked packages
if [ ${#BLOCKED[@]} -gt 0 ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  SECURITY BLOCK!${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "The following package(s) are blocked due to security risks:"
    for blocked_pkg in "${BLOCKED[@]}"; do
        echo -e "  ${RED}✗ $blocked_pkg${NC}"
    done
    echo ""
    echo "These packages have been associated with malicious code."
    echo "Installation has been prevented for your security."
    echo ""
    echo "If you believe this is an error, review:"
    echo "  $BLOCKLIST"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ All packages passed security check${NC}"
echo ""

# Proceed with actual installation
echo "Installing packages..."
"$VENV_PIP" install --no-cache-dir "$@"
INSTALL_STATUS=$?

if [ $INSTALL_STATUS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Installation complete${NC}"
    echo ""
    echo "Running security audit..."
    "$PROJECT_DIR/venv/bin/python" "$PROJECT_DIR/security_audit.py"
    AUDIT_STATUS=$?
    
    if [ $AUDIT_STATUS -ne 0 ]; then
        echo ""
        echo -e "${RED}⚠️  SECURITY AUDIT FAILED!${NC}"
        echo "The installation may have introduced security risks."
        echo "Consider removing the venv and reinstalling."
        exit 1
    fi
else
    echo -e "${RED}✗ Installation failed${NC}"
    exit $INSTALL_STATUS
fi

exit 0
