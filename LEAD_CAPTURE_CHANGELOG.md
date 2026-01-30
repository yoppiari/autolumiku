# Lead Capture & AI Context Enhancement Summary

## Overview
This update focuses on improving how the system understands user intent (`IntentClassifierService`) and captures high-quality lead information (`LeadService`).

## Key Changes

### 1. Enhanced Intent Classification
- **Vehicle Models**: Added extraction of specific vehicle models (e.g., "Avanza", "Pajero", "Civic") in addition to brands.
- **Attributes**: The classifier now returns extracted entities (`brand`, `model`, `price`, `aspect`) in the classification result.

### 2. Improved Lead Capture (`MessageOrchestratorService`)
- **Entity Integration**: The orchestrator now passes extracted entities to the Lead Service.
- **Interest Construction**: Automatically constructs an `interestedIn` string (e.g., "Toyota Avanza") from extracted brand and model.
- **Budget Extraction**: Automatically formats detected price mentions into a `budgetRange` (e.g., "< Rp 150 Juta").

### 3. Lead Service Logic (`LeadService`)
- **Flexible Interest Detection**: 
  - Updated `createOrUpdateFromWhatsApp` to accept `interestedIn` and `budgetRange`.
  - Relaxed the "junk detection" logic: If the user explicitly asks about a vehicle (even without a specific ID) or mentions a vehicle model, it is now counted as a valid "Interest", allowing a lead to be created (provided the name is valid).
  - Explicitly added `vehicle` and `vehicle_inquiry` intents to likely lead triggers.

## Impact
- **Smarter CRM**: Leads created from WhatsApp now automatically populate with:
  - **Vehicle Interest**: "Toyota Avanza" instead of generic messaging.
  - **Budget**: "< Rp 200 Juta" if mentioned.
- **Better Context**: The AI and Sales Staff have immediate visibility into what the customer is looking for without needing to ask repeatedly.
