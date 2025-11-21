# Natural Language Command Service

Epic 3 implementation for AutoLumiku - Indonesian Natural Language Command Center.

## Overview

This service provides a complete natural language processing system for controlling the AutoLumiku platform using Indonesian commands. It supports both text and voice input, with AI-powered intent recognition and adaptive learning.

## Architecture

```
┌─────────────────┐
│  User Input     │
│ (Text / Voice)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Command Parser  │ ◄─── Indonesian Automotive Terms
│ (Rule-based)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Intent          │
│ Recognizer      │ ◄─── GLM-4.6 AI (z.ai)
│ (AI-enhanced)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Command         │
│ Executor        │ ◄─── Command Registry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Learning Engine │ ◄─── User Patterns
│ (Adaptive)      │
└─────────────────┘
```

## Components

### 1. Command Parser (`command-parser.ts`)
- **Purpose**: Parse Indonesian natural language into structured intents and entities
- **Features**:
  - Pattern matching for 20+ command intents
  - Entity extraction (vehicle make, model, price, etc.)
  - Confidence scoring
  - Ambiguity detection
- **Usage**:
  ```typescript
  import { commandParser } from '@/services/nl-command-service';

  const result = commandParser.parse('Cari mobil Toyota Avanza tahun 2020');
  // Returns ParsedCommand with intent, entities, confidence
  ```

### 2. Intent Recognizer (`intent-recognizer.ts`)
- **Purpose**: AI-powered intent recognition using GLM-4.6
- **Features**:
  - Enhances rule-based parsing with AI
  - Handles ambiguous commands
  - Provides reasoning for intent decisions
- **Usage**:
  ```typescript
  import { intentRecognizer } from '@/services/nl-command-service';

  const result = await intentRecognizer.recognizeIntent(
    'Saya ingin lihat mobil yang ada',
    CommandIntent.LIST_VEHICLES // fallback
  );
  ```

### 3. Command Executor (`command-executor.ts`)
- **Purpose**: Execute parsed commands using registered handlers
- **Features**:
  - Handler orchestration
  - Entity validation
  - Error recovery
  - Result formatting
- **Usage**:
  ```typescript
  import { commandExecutor } from '@/services/nl-command-service';

  const result = await commandExecutor.execute({
    parsedCommand,
    tenantId: 'tenant-id',
    userId: 'user-id',
    context: {},
  });
  ```

### 4. Command Registry (`command-registry.ts`)
- **Purpose**: Central registry for all command handlers
- **Features**:
  - Handler registration
  - Intent-to-handler mapping
  - Required entity validation
- **Usage**:
  ```typescript
  import { commandRegistry } from '@/services/nl-command-service';

  commandRegistry.register({
    intent: CommandIntent.SEARCH_VEHICLE,
    handler: handleSearchVehicle,
    requiredEntities: [EntityType.VEHICLE_MAKE],
    examples: ['Cari mobil Toyota', 'Tampilkan mobil Honda'],
    category: 'Vehicle Management',
  });
  ```

### 5. Help System (`help-system.ts`)
- **Purpose**: Contextual help and error recovery
- **Features**:
  - Command suggestions
  - Autocomplete
  - Error recovery suggestions
  - Relevance scoring
- **Usage**:
  ```typescript
  import { helpSystem } from '@/services/nl-command-service';

  const suggestions = await helpSystem.getSuggestions('cari mob', 5);
  ```

### 6. Learning Engine (`learning-engine.ts`)
- **Purpose**: Learn user patterns and provide personalized suggestions
- **Features**:
  - Command usage tracking
  - Pattern analysis (time of day, context)
  - Personalized suggestions
  - Predictive next command
- **Usage**:
  ```typescript
  import { learningEngine } from '@/services/nl-command-service';

  // Track command execution
  await learningEngine.trackCommandExecution(
    tenantId,
    userId,
    parsedCommand,
    success,
    executionTimeMs
  );

  // Get personalized suggestions
  const suggestions = await learningEngine.getPersonalizedSuggestions(
    tenantId,
    userId,
    10,
    { timeOfDay: new Date(), currentPage: 'inventory' }
  );
  ```

### 7. Indonesian Automotive Terms (`indonesian-automotive-terms.ts`)
- **Purpose**: Comprehensive Indonesian automotive terminology
- **Coverage**:
  - 10 major vehicle makes
  - 30+ popular models
  - Transmission types (matic, manual, CVT)
  - Fuel types (bensin, diesel, hybrid, listrik)
  - Colors with synonyms
  - Seasonal terms (Ramadhan, Lebaran, Harbolnas)

### 8. Inventory Commands (`commands/inventory-commands.ts`)
- **Purpose**: Vehicle inventory management command handlers
- **Handlers**:
  - `LIST_VEHICLES`: Show all vehicles
  - `SEARCH_VEHICLE`: Search with criteria
  - `VIEW_VEHICLE`: Show vehicle details
  - `UPDATE_PRICE`: Update vehicle pricing
  - `UPDATE_VEHICLE`: Update vehicle information
  - `MARK_AS_SOLD`: Mark vehicle as sold
  - `MARK_AS_BOOKED`: Mark vehicle as booked
  - `MARK_AS_AVAILABLE`: Mark vehicle as available

## API Routes

### POST /api/v1/commands/parse
Parse a natural language command into structured format.

**Request**:
```json
{
  "command": "Cari mobil Toyota Avanza harga di bawah 200 juta",
  "tenantId": "tenant-id",
  "userId": "user-id"
}
```

**Response**:
```json
{
  "success": true,
  "parsedCommand": {
    "originalCommand": "Cari mobil Toyota Avanza harga di bawah 200 juta",
    "intent": "search_vehicle",
    "confidence": 0.95,
    "entities": [
      { "type": "vehicle_make", "value": "Toyota" },
      { "type": "vehicle_model", "value": "Avanza" },
      { "type": "price_range", "value": { "max": 200000000 } }
    ],
    "needsClarification": false
  }
}
```

### POST /api/v1/commands/execute
Execute a parsed command.

**Request**:
```json
{
  "parsedCommand": { /* ParsedCommand object */ },
  "tenantId": "tenant-id",
  "userId": "user-id",
  "context": {}
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "success": true,
    "message": "Ditemukan 5 mobil",
    "data": [ /* Array of vehicles */ ],
    "suggestions": ["Lihat detail mobil", "Update harga"]
  }
}
```

### POST /api/v1/commands/suggestions
Get personalized command suggestions.

**Request**:
```json
{
  "tenantId": "tenant-id",
  "userId": "user-id",
  "limit": 10,
  "context": {
    "timeOfDay": "2025-11-20T10:00:00Z",
    "currentPage": "inventory"
  }
}
```

**Response**:
```json
{
  "success": true,
  "suggestions": [
    {
      "command": "Tampilkan semua mobil",
      "category": "Vehicle Management",
      "description": "Anda sering menggunakan perintah ini (15x)",
      "isFrequent": true
    }
  ],
  "type": "personalized"
}
```

### GET /api/v1/commands/history
Get command execution history.

**Query Params**:
- `tenantId`: Required
- `userId`: Required
- `limit`: Optional (default: 50, max: 100)
- `offset`: Optional (default: 0)
- `intent`: Optional (filter by intent)
- `successOnly`: Optional (true/false)

## UI Components

### CommandCenter
Main component that orchestrates the command center interface.

**Usage**:
```tsx
import { CommandCenter } from '@/components/command-center/CommandCenter';

<CommandCenter tenantId="tenant-id" userId="user-id" />
```

### VoiceInput
Voice recognition component using Web Speech API.

**Features**:
- Indonesian language support (id-ID)
- Real-time transcription
- Visual feedback with AudioVisualizer
- Error handling

### CommandInput
Text input component with autocomplete suggestions.

### CommandSuggestions
Shows personalized and popular command suggestions.

### CommandHistory
Displays command execution history.

### CommandResult
Shows command execution results with error recovery.

## Adding New Commands

To add a new command handler:

1. **Define the intent** in `types.ts`:
   ```typescript
   export enum CommandIntent {
     // ... existing intents
     MY_NEW_COMMAND = 'my_new_command',
   }
   ```

2. **Add patterns** in `command-parser.ts`:
   ```typescript
   if (this.matchesPattern(normalizedCommand, [
     /my.*pattern/,
     /another.*pattern/,
   ])) {
     return CommandIntent.MY_NEW_COMMAND;
   }
   ```

3. **Create handler** in `commands/` directory:
   ```typescript
   async function handleMyCommand(
     entities: CommandEntity[],
     request: CommandExecutionRequest
   ): Promise<CommandExecutionResult> {
     // Implementation
     return createSuccessResult('Success message', data);
   }
   ```

4. **Register handler**:
   ```typescript
   commandRegistry.register({
     intent: CommandIntent.MY_NEW_COMMAND,
     handler: handleMyCommand,
     requiredEntities: [/* required entities */],
     examples: ['Example command 1', 'Example command 2'],
     category: 'Category Name',
   });
   ```

## Testing

Run tests for the command service:

```bash
npm test -- nl-command-service
```

## Environment Variables

Required environment variables:

```env
# z.ai API Configuration (for GLM-4.6)
ZAI_API_KEY=your-zai-api-key
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4/

# Database
DATABASE_URL=postgresql://...

# Optional
API_TIMEOUT_MS=30000
```

## Performance

- Rule-based parsing: ~5ms average
- AI-enhanced parsing: ~300ms average (when needed)
- Command execution: Depends on handler (10ms - 1s)
- Learning engine tracking: Async, non-blocking

## Language Support

Currently supports:
- **Indonesian (id-ID)**: Primary language
- **English**: Partial support for technical terms

## Browser Compatibility

### Voice Input
- Chrome/Edge: ✅ Full support
- Safari: ✅ Full support
- Firefox: ❌ Web Speech API not supported

### Text Input
- All modern browsers: ✅ Full support

## Future Enhancements

- [ ] Multi-language support (English, Malay)
- [ ] Conversation context tracking
- [ ] Intent disambiguation UI
- [ ] Voice output (text-to-speech)
- [ ] Advanced analytics dashboard
- [ ] Custom command creation by users
- [ ] Batch command execution
- [ ] Command macros/shortcuts

## License

Proprietary - AutoLumiku Platform
