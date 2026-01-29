#!/bin/bash

echo "================================================================================"
echo "🧪 Testing z.ai GLM Configuration"
echo "================================================================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo ""
    echo "Please create .env file with the following variables:"
    echo ""
    echo "ZAI_API_KEY=\"93ac6b4e9c1c49b4b64fed617669e569.5nfnaoMbbNaKZ26I\""
    echo "ZAI_BASE_URL=\"https://api.z.ai/api/paas/v4/\""
    echo "ZAI_VISION_MODEL=\"glm-4.5v\""
    echo "ZAI_TEXT_MODEL=\"glm-4.6\""
    echo "API_TIMEOUT_MS=\"300000\""
    echo ""
    exit 1
fi

echo "✅ .env file found"
echo ""

# Load .env file
export $(cat .env | grep -v '^#' | xargs)

echo "📋 Checking Environment Variables:"
echo "--------------------------------------------------------------------------------"

# Function to check env var
check_env_var() {
    local var_name=$1
    local var_value="${!var_name}"

    if [ -z "$var_value" ]; then
        echo "❌ $var_name: NOT SET"
        return 1
    else
        # Mask API key for security
        if [ "$var_name" = "ZAI_API_KEY" ]; then
            local masked="${var_value:0:10}...${var_value: -4}"
            echo "✅ $var_name: $masked"
        else
            echo "✅ $var_name: $var_value"
        fi
        return 0
    fi
}

# Check required variables
all_set=true

check_env_var "ZAI_API_KEY" || all_set=false
check_env_var "ZAI_BASE_URL" || all_set=false
check_env_var "ZAI_VISION_MODEL" || all_set=false
check_env_var "ZAI_TEXT_MODEL" || all_set=false

echo ""

if [ "$all_set" = true ]; then
    echo "✅ All environment variables are configured!"
    echo ""
    echo "🔌 Testing z.ai API Connection..."
    echo "--------------------------------------------------------------------------------"

    # Test API connection with curl
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "$ZAI_BASE_URL/chat/completions" \
        -H "Authorization: Bearer $ZAI_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "'"$ZAI_TEXT_MODEL"'",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say Hello from GLM in Indonesian!"}
            ],
            "max_tokens": 50
        }' 2>&1)

    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all except last line)
    response_body=$(echo "$response" | sed '$d')

    echo "HTTP Status Code: $http_code"
    echo ""

    if [ "$http_code" = "200" ]; then
        echo "✅ API Connection Test PASSED!"
        echo ""
        echo "Response from GLM-$ZAI_TEXT_MODEL:"
        echo "--------------------------------------------------------------------------------"
        # Pretty print JSON if jq is available
        if command -v jq &> /dev/null; then
            echo "$response_body" | jq -r '.choices[0].message.content'
        else
            echo "$response_body"
        fi
        echo "--------------------------------------------------------------------------------"
        echo ""
        echo "🎉 ALL TESTS PASSED!"
        echo ""
        echo "Your z.ai GLM AI services are ready to use!"
        echo ""
        echo "Next steps:"
        echo "  1. Install dependencies: npm install"
        echo "  2. Start dev server: npm run dev"
        echo "  3. Test upload: http://localhost:3000/vehicles/upload"
        echo ""
    else
        echo "❌ API Connection Test FAILED!"
        echo ""
        echo "Response:"
        echo "$response_body"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check if ZAI_API_KEY is correct"
        echo "  2. Verify you have active z.ai subscription"
        echo "  3. Visit: https://z.ai/manage-apikey/apikey-list"
        echo ""
        exit 1
    fi
else
    echo "❌ Some environment variables are missing!"
    echo ""
    echo "Please add the missing variables to your .env file:"
    echo ""
    echo "ZAI_API_KEY=\"93ac6b4e9c1c49b4b64fed617669e569.5nfnaoMbbNaKZ26I\""
    echo "ZAI_BASE_URL=\"https://api.z.ai/api/paas/v4/\""
    echo "ZAI_VISION_MODEL=\"glm-4.5v\""
    echo "ZAI_TEXT_MODEL=\"glm-4.6\""
    echo "API_TIMEOUT_MS=\"300000\""
    echo ""
    exit 1
fi

echo "================================================================================"
