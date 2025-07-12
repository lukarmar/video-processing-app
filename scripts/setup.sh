#!/bin/bash

# Get the script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Function to install packages based on package manager files
install_packages() {
    local dir="$1"
    echo "Installing packages for $dir..."
    
    if [ -f "$dir/package.json" ]; then
        cd "$dir" && npm install
    elif [ -f "$dir/requirements.txt" ]; then
        cd "$dir" && pip install -r requirements.txt
    elif [ -f "$dir/Gemfile" ]; then
        cd "$dir" && bundle install
    elif [ -f "$dir/composer.json" ]; then
        cd "$dir" && composer install
    fi
    
    cd "$PROJECT_ROOT" > /dev/null
}

# Install packages in project root
install_packages "."

# Install packages in services directories
if [ -d "services" ]; then
    for service_dir in services/*/; do
        if [ -d "$service_dir" ]; then
            install_packages "$service_dir"
        fi
    done
else
    echo "Services directory not found!"
fi