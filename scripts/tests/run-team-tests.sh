#!/bin/bash

# Team Management Test Runner
# Comprehensive test execution for team management functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="src/tests"
COVERAGE_DIR="test-results/coverage"
REPORT_DIR="test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🧪 Running Team Management Test Suite${NC}"
echo "====================================="

# Create test results directory
mkdir -p "$REPORT_DIR"
mkdir -p "$COVERAGE_DIR"

# Function to run tests with coverage
run_test_suite() {
    local test_type=$1
    local config_file=$2
    local description=$3

    echo -e "\n${YELLOW}📋 Running $description...${NC}"

    if [ -f "$config_file" ]; then
        npx jest --config="$config_file" \
            --coverage \
            --coverageDirectory="$COVERAGE_DIR/$test_type" \
            --coverageReporters=text,text-lcov,html \
            --testResultsProcessor=jest-junit \
            --outputFile="$REPORT_DIR/${test_type}_junit_$TIMESTAMP.xml" \
            --verbose \
            --runInBand
    else
        echo -e "${RED}❌ Config file not found: $config_file${NC}"
        return 1
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $description completed successfully${NC}"
    else
        echo -e "${RED}❌ $description failed${NC}"
        return 1
    fi
}

# Function to run specific test categories
run_category_tests() {
    local category=$1
    local description=$2

    echo -e "\n${YELLOW}📂 Running $description...${NC}"

    npx jest "src/tests/$category/**/*.test.ts" \
        --config="jest.config.team-tests.js" \
        --verbose \
        --runInBand

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $description completed successfully${NC}"
    else
        echo -e "${RED}❌ $description failed${NC}"
        return 1
    fi
}

# Main execution
echo -e "${BLUE}🔍 Test Environment Setup${NC}"
echo "NODE_ENV: $NODE_ENV"
echo "Timestamp: $TIMESTAMP"

# Run unit tests
echo -e "\n${BLUE}🔬 Unit Tests${NC}"
run_category_tests "unit/team-management" "Team Management Unit Tests"
run_category_tests "unit/team-analytics" "Team Analytics Unit Tests"

# Run integration tests
echo -e "\n${BLUE}🔗 Integration Tests${NC}"
run_category_tests "integration/team-management" "Team Management Integration Tests"

# Run security tests
echo -e "\n${BLUE}🛡️  Security Tests${NC}"
run_category_tests "security" "Security Tests"

# Run API tests
echo -e "\n${BLUE}🌐 API Tests${NC}"
npx jest "src/app/api/team/**/*.test.ts" \
    --config="jest.config.team-tests.js" \
    --verbose \
    --runInBand

# Run component tests
echo -e "\n${BLUE}🎨 Component Tests${NC}"
npx jest "src/components/team/**/*.test.{ts,tsx}" \
    --config="jest.config.team-tests.js" \
    --verbose \
    --runInBand

# Generate comprehensive coverage report
echo -e "\n${BLUE}📊 Generating Coverage Report${NC}"
npx jest --config="jest.config.team-tests.js" \
    --coverage \
    --coverageDirectory="$COVERAGE_DIR" \
    --coverageReporters=text,text-lcov,html,clover \
    --collectCoverageOnlyFrom="src/services/team-management-service/**/* src/services/rbac-service/**/* src/services/team-analytics-service/**/* src/app/api/team/**/*" \
    --coverageThreshold='{"global":{"branches":85,"functions":90,"lines":90,"statements":90}}'

# Run performance tests if available
if [ -f "src/tests/performance/team-performance.test.ts" ]; then
    echo -e "\n${BLUE}⚡ Performance Tests${NC}"
    run_category_tests "performance" "Performance Tests"
fi

# Generate test summary
echo -e "\n${BLUE}📋 Test Summary${NC}"
echo "====================================="

# Count total tests
TOTAL_TESTS=$(npx jest --config="jest.config.team-tests.js" --listTests | wc -l)
echo "Total test files: $TOTAL_TESTS"

# Check coverage report
if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
    echo -e "\n${GREEN}📊 Coverage Summary:${NC}"
    node -e "
        const coverage = require('./$COVERAGE_DIR/coverage-summary.json');
        console.log('Lines: ' + coverage.total.lines.pct + '%');
        console.log('Functions: ' + coverage.total.functions.pct + '%');
        console.log('Branches: ' + coverage.total.branches.pct + '%');
        console.log('Statements: ' + coverage.total.statements.pct + '%');
    "
fi

# Generate HTML report if available
if [ -f "$COVERAGE_DIR/lcov-report/index.html" ]; then
    echo -e "\n${BLUE}📈 HTML Coverage Report:${NC}"
    echo "Available at: $COVERAGE_DIR/lcov-report/index.html"
fi

# Run linting on test files
echo -e "\n${BLUE}🔍 Linting Test Files${NC}"
npx eslint "src/tests/**/*.ts" --max-warnings=0 || echo -e "${YELLOW}⚠️  Linting warnings found${NC}"

# Check for test file naming conventions
echo -e "\n${BLUE}📝 Test File Validation${NC}"
INVALID_NAMES=$(find "src/tests" -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" | wc -l)
if [ "$INVALID_NAMES" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $INVALID_NAMES test files without .test.ts or .spec.ts extension${NC}"
    find "src/tests" -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts"
fi

# Generate test report timestamp
echo -e "\n${BLUE}🕐 Test completion time:${NC} $(date)"

# Success message
echo -e "\n${GREEN}🎉 Team Management Test Suite Completed!${NC}"
echo "====================================="
echo "Results available in: $REPORT_DIR"
echo "Coverage reports available in: $COVERAGE_DIR"

# Exit with appropriate code
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the logs above.${NC}"
    exit 1
fi