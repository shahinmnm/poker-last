#!/usr/bin/env bash
# Template import runner - imports table templates from JSON files

set -euo pipefail

# Enable debug mode if DEBUG env var is set
if [ "${DEBUG:-}" = "1" ]; then
    set -x
fi

echo "========================================" 
echo "Starting template import process"
echo "========================================"
echo "Working directory: $(pwd)"
echo "Templates directory: templates/"
echo "----------------------------------------"

# Count JSON files in templates directory
template_count=$(find templates -name "*.json" -type f 2>/dev/null | wc -l | tr -d '[:space:]')

# Default to 0 if empty
template_count=${template_count:-0}

if [ "$template_count" -eq 0 ]; then
    echo "⚠ WARNING: No JSON template files found in templates/ directory"
    echo "Skipping template import"
    echo "========================================"
    exit 0
fi

echo "Found $template_count JSON template file(s)"
echo "----------------------------------------"
echo "Running template import script..."
echo "----------------------------------------"

# Run the Python import script
if python scripts/import_templates_on_startup.py; then
    echo "----------------------------------------"
    echo "✅ Template import completed successfully!"
    echo "----------------------------------------"
    exit 0
else
    echo "----------------------------------------"
    echo "❌ ERROR: Template import failed!"
    echo "----------------------------------------"
    echo "This error means templates could not be imported into the database."
    echo "Please check the error messages above for details."
    echo ""
    echo "The application will continue to run, but templates may not be available."
    echo "========================================"
    # Exit with 0 to allow the application to start even if template import fails
    # This prevents a template import failure from blocking the entire application
    exit 0
fi
