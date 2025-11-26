#!/bin/bash

# AutoLumiku Development Script
# Runs Next.js development server with auto-cleanup

# Note: NOT using 'set -e' to allow graceful error handling

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID file location
NEXTJS_PID_FILE=".nextjs.pid"

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    print_status "Stopping all services..."

    # Kill Next.js process
    if [ -f "$NEXTJS_PID_FILE" ]; then
        NEXTJS_PID=$(cat "$NEXTJS_PID_FILE")
        if kill -0 "$NEXTJS_PID" 2>/dev/null; then
            kill "$NEXTJS_PID" 2>/dev/null || true
            print_success "Next.js server stopped"
        fi
        rm -f "$NEXTJS_PID_FILE"
    fi

    print_success "All services stopped"
    exit 0
}

# Set trap for cleanup (only on INT and TERM, not EXIT)
trap cleanup INT TERM

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

echo ""
echo "🚗 AutoLumiku Development Environment"
echo "====================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first: https://nodejs.org"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first"
    exit 1
fi

# Kill any processes on required ports
print_status "Cleaning up ports..."
NEXTJS_PORT=3000

# Kill all Next.js dev processes that might be running
print_status "Stopping any existing dev processes..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Kill processes on Next.js port
if lsof -ti:$NEXTJS_PORT > /dev/null 2>&1; then
    print_warning "Port $NEXTJS_PORT is in use, killing process..."
    lsof -ti:$NEXTJS_PORT | xargs kill -9 2>/dev/null || true
fi

sleep 1
print_success "All ports cleaned up"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    print_warning ".env.local not found"
    if [ -f ".env.example" ]; then
        print_status "Creating .env.local from .env.example..."
        cp .env.example .env.local
        print_warning "Please update .env.local with your configuration"
    else
        print_error ".env.local and .env.example not found. Please create .env.local"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Start Database Services
print_status "Starting database services..."
if command -v docker > /dev/null; then
    docker compose up -d postgres redis
    print_success "Database services started"
else
    print_warning "Docker not found. Skipping docker compose up."
fi

# Check Prisma setup
print_status "Checking database setup..."
if [ -d "prisma" ]; then
    # Generate Prisma Client
    print_status "Generating Prisma Client..."
    npx prisma generate

    # Optional: Check database connection
    print_status "Checking database connection..."
    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection OK"
    else
        print_warning "Cannot connect to database. Make sure DATABASE_URL is correct in .env.local"
    fi
fi

# Start Next.js Development Server
print_status "Starting Next.js development server..."

# Start Next.js in background, redirect output to log file
npm run dev > nextjs.log 2>&1 &
NEXTJS_PID=$!
echo $NEXTJS_PID > "$NEXTJS_PID_FILE"

print_success "Next.js started (PID: $NEXTJS_PID)"

# Give it a moment to write initial logs
sleep 2

# Wait for Next.js to be ready
print_status "Waiting for Next.js to be ready..."
READY=0
for i in {1..60}; do
    # Check if process is still running
    if ! kill -0 "$NEXTJS_PID" 2>/dev/null; then
        print_error "Next.js process died. Check nextjs.log for errors."
        tail -50 nextjs.log
        exit 1
    fi

    # Check if port is listening
    if lsof -ti:$NEXTJS_PORT > /dev/null 2>&1; then
        print_success "Next.js is listening on port $NEXTJS_PORT"
        READY=1
        break
    fi

    # Also check for "Ready" message in logs
    if grep -q "Ready in" nextjs.log 2>/dev/null; then
        print_success "Next.js is ready"
        READY=1
        break
    fi

    sleep 1
done

if [ $READY -eq 0 ]; then
    print_error "Next.js failed to become ready within 60 seconds. Check nextjs.log for errors."
    tail -50 nextjs.log
    exit 1
fi

# Display access information
echo ""
echo "=================================================================="
echo "🚗 AutoLumiku Development Environment Ready!"
echo "=================================================================="
echo ""
echo "📊 Application URLs:"
echo "   Frontend:          http://localhost:3000"
echo "   Admin Dashboard:   http://localhost:3000/admin"
echo "   Public Catalog:    http://localhost:3000/catalog/[tenant-subdomain]"
echo ""
echo "🗄️  Database:"
if grep -q "localhost" .env.local 2>/dev/null; then
    echo "   Local PostgreSQL"
else
    echo "   Remote PostgreSQL (check .env.local)"
fi
echo ""
echo "📝 Logs:"
echo "   Next.js:  tail -f nextjs.log"
echo ""
echo "🛠️  Commands:"
echo "   Stop:              Press Ctrl+C"
echo "   Restart:           Stop and run ./dev.sh again"
echo "   View logs:         tail -f nextjs.log"
echo "   Database Studio:   npx prisma studio"
echo "   Run migrations:    npx prisma migrate dev"
echo ""
echo "=================================================================="

print_success "Development environment is running!"
print_status "Press Ctrl+C to stop all services"
echo ""

# Follow logs
tail -f nextjs.log
