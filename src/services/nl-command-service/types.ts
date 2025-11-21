/**
 * Natural Language Command Service - Type Definitions
 * Epic 3: Natural Language Control Center
 *
 * Defines all types, interfaces, and enums for NL command processing
 */

// ============================================================================
// Command Intent Types
// ============================================================================

/**
 * Supported command intents in the system
 */
export enum CommandIntent {
  // Vehicle Management
  UPLOAD_VEHICLE = 'upload_vehicle',
  UPDATE_VEHICLE = 'update_vehicle',
  DELETE_VEHICLE = 'delete_vehicle',
  SEARCH_VEHICLE = 'search_vehicle',
  LIST_VEHICLES = 'list_vehicles',
  VIEW_VEHICLE = 'view_vehicle',
  FILTER_VEHICLES = 'filter_vehicles',
  FIND_SIMILAR = 'find_similar',

  // Pricing Operations
  UPDATE_PRICE = 'update_price',
  BULK_UPDATE_PRICE = 'bulk_update_price',
  CHECK_PRICE = 'check_price',
  ANALYZE_PRICING = 'analyze_pricing',
  SET_DISCOUNT = 'set_discount',
  COMPARE_PRICES = 'compare_prices',

  // Category Management
  CREATE_CATEGORY = 'create_category',
  ASSIGN_CATEGORY = 'assign_category',
  LIST_CATEGORIES = 'list_categories',
  VIEW_CATEGORY = 'view_category',
  CATEGORY_STATS = 'category_stats',
  TOP_CATEGORIES = 'top_categories',
  MOVE_TO_CATEGORY = 'move_to_category',

  // Inventory Operations
  MARK_AS_SOLD = 'mark_as_sold',
  MARK_AS_BOOKED = 'mark_as_booked',
  MARK_AS_AVAILABLE = 'mark_as_available',
  SET_FEATURED = 'set_featured',

  // Bulk Operations
  BULK_UPDATE = 'bulk_update',
  BULK_DELETE = 'bulk_delete',
  BULK_CATEGORY_ASSIGN = 'bulk_category_assign',

  // Analytics & Reports
  SHOW_ANALYTICS = 'show_analytics',
  TOP_SELLING = 'top_selling',
  SALES_REPORT = 'sales_report',
  LEAD_ANALYTICS = 'lead_analytics',
  INVENTORY_INSIGHTS = 'inventory_insights',
  GENERATE_REPORT = 'generate_report',
  SHOW_PERFORMANCE = 'show_performance',

  // Lead Management
  VIEW_LEADS = 'view_leads',
  CONTACT_CUSTOMER = 'contact_customer',
  FOLLOW_UP = 'follow_up',

  // Help & Navigation
  GET_HELP = 'get_help',
  SHOW_EXAMPLES = 'show_examples',
  NAVIGATE_TO = 'navigate_to',

  // Unknown
  UNKNOWN = 'unknown'
}

/**
 * Entity types that can be extracted from commands
 */
export enum EntityType {
  VEHICLE_MAKE = 'vehicle_make',
  VEHICLE_MODEL = 'vehicle_model',
  VEHICLE_YEAR = 'vehicle_year',
  VEHICLE_ID = 'vehicle_id',
  VEHICLE_PLATE = 'vehicle_plate',
  PRICE = 'price',
  PRICE_RANGE = 'price_range',
  PRICE_ADJUSTMENT = 'price_adjustment',
  CATEGORY = 'category',
  STATUS = 'status',
  COLOR = 'color',
  TRANSMISSION = 'transmission',
  FUEL_TYPE = 'fuel_type',
  QUANTITY = 'quantity',
  DATE = 'date',
  DATE_RANGE = 'date_range',
  CUSTOMER_NAME = 'customer_name',
  CONTACT = 'contact',
  LOCATION = 'location'
}

// ============================================================================
// Command Parsing
// ============================================================================

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  /** Original user input */
  originalCommand: string;

  /** Detected intent */
  intent: CommandIntent;

  /** Confidence score (0-100) */
  confidence: number;

  /** Extracted entities */
  entities: CommandEntity[];

  /** Alternative interpretations if ambiguous */
  alternatives?: ParsedCommand[];

  /** Whether clarification is needed */
  needsClarification: boolean;

  /** Clarification questions if needed */
  clarificationQuestions?: string[];
}

/**
 * Extracted entity from command
 */
export interface CommandEntity {
  /** Type of entity */
  type: EntityType;

  /** Extracted value */
  value: any;

  /** Original text that was matched */
  originalText: string;

  /** Confidence in extraction (0-100) */
  confidence: number;

  /** Start position in original text */
  startPos?: number;

  /** End position in original text */
  endPos?: number;
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Command execution request
 */
export interface CommandExecutionRequest {
  /** Parsed command to execute */
  parsedCommand: ParsedCommand;

  /** Tenant context */
  tenantId: string;

  /** User context */
  userId: string;

  /** Additional context from previous commands */
  context?: CommandContext;
}

/**
 * Command execution result
 */
export interface CommandExecutionResult {
  /** Whether execution was successful */
  success: boolean;

  /** Result data */
  data?: any;

  /** User-friendly message */
  message: string;

  /** Detailed message (for logging) */
  details?: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Error information if failed */
  error?: CommandError;

  /** Suggested next actions */
  suggestions?: string[];
}

/**
 * Command error information
 */
export interface CommandError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Recovery suggestions */
  recoverySuggestions: string[];

  /** Whether the command can be retried */
  canRetry: boolean;
}

// ============================================================================
// Command Context
// ============================================================================

/**
 * Context from previous commands and user state
 */
export interface CommandContext {
  /** Recent command history (last 5) */
  recentCommands: string[];

  /** Current filters or selections */
  activeFilters?: Record<string, any>;

  /** Last viewed vehicle */
  lastVehicleId?: string;

  /** Current page or view */
  currentView?: string;

  /** User preferences */
  userPreferences?: UserPreferences;
}

/**
 * User command preferences
 */
export interface UserPreferences {
  /** Preferred language */
  language: 'id' | 'en';

  /** Preferred command style */
  commandStyle: 'formal' | 'casual';

  /** Frequently used commands */
  frequentCommands: string[];

  /** Custom shortcuts */
  shortcuts?: Record<string, string>;
}

// ============================================================================
// Command Suggestions
// ============================================================================

/**
 * Command suggestion
 */
export interface CommandSuggestion {
  /** Suggested command text */
  command: string;

  /** Category of command */
  category: string;

  /** Description of what it does */
  description: string;

  /** Example usage */
  example?: string;

  /** Relevance score (0-100) */
  relevance: number;

  /** Whether this is a frequently used command */
  isFrequent?: boolean;
}

/**
 * Command suggestions request
 */
export interface SuggestionsRequest {
  /** Partial command input */
  partialInput?: string;

  /** User context */
  tenantId: string;
  userId: string;

  /** Current context */
  context?: CommandContext;

  /** Maximum number of suggestions */
  limit?: number;
}

// ============================================================================
// Help System
// ============================================================================

/**
 * Help request
 */
export interface HelpRequest {
  /** Specific topic or null for general help */
  topic?: string;

  /** User context */
  tenantId: string;
  userId: string;

  /** Current context */
  context?: CommandContext;
}

/**
 * Help response
 */
export interface HelpResponse {
  /** Help content */
  content: string;

  /** Related commands */
  relatedCommands: CommandSuggestion[];

  /** Examples */
  examples: HelpExample[];

  /** Categories available */
  categories?: string[];
}

/**
 * Help example
 */
export interface HelpExample {
  /** Example command */
  command: string;

  /** What it does */
  description: string;

  /** Category */
  category: string;
}

// ============================================================================
// Learning & Analytics
// ============================================================================

/**
 * Command history record
 */
export interface CommandHistoryRecord {
  /** Record ID */
  id: string;

  /** Original command */
  command: string;

  /** Parsed intent */
  intent: CommandIntent;

  /** Whether execution was successful */
  success: boolean;

  /** Execution time */
  executionTime: number;

  /** Timestamp */
  timestamp: Date;

  /** User ID */
  userId: string;

  /** Tenant ID */
  tenantId: string;
}

/**
 * User command pattern
 */
export interface UserCommandPattern {
  /** Pattern ID */
  id: string;

  /** Command pattern (intent + entities) */
  pattern: string;

  /** Frequency of use */
  frequency: number;

  /** Success rate (0-100) */
  successRate: number;

  /** Average execution time */
  averageExecutionTime: number;

  /** Last used */
  lastUsed: Date;
}

// ============================================================================
// Automotive Domain
// ============================================================================

/**
 * Indonesian automotive term
 */
export interface AutomotiveTerm {
  /** Indonesian term */
  indonesian: string;

  /** English equivalent */
  english: string;

  /** Alternative terms/synonyms */
  synonyms: string[];

  /** Category */
  category: 'make' | 'model' | 'feature' | 'color' | 'transmission' | 'fuel' | 'status' | 'general';

  /** Common variations */
  variations?: string[];
}

/**
 * Vehicle search criteria from NL command
 */
export interface VehicleSearchCriteria {
  /** Make */
  make?: string;

  /** Model */
  model?: string;

  /** Year range */
  yearMin?: number;
  yearMax?: number;

  /** Price range (in cents) */
  priceMin?: number;
  priceMax?: number;

  /** Transmission type */
  transmission?: 'manual' | 'automatic' | 'cvt';

  /** Fuel type */
  fuelType?: 'bensin' | 'diesel' | 'hybrid' | 'electric';

  /** Color */
  color?: string;

  /** Status */
  status?: 'AVAILABLE' | 'BOOKED' | 'SOLD';

  /** Categories */
  categories?: string[];

  /** Tags */
  tags?: string[];

  /** Featured only */
  featuredOnly?: boolean;

  /** Sort by */
  sortBy?: 'price' | 'year' | 'date' | 'popularity';

  /** Sort order */
  sortOrder?: 'asc' | 'desc';

  /** Limit results */
  limit?: number;
}

// ============================================================================
// Command Registry
// ============================================================================

/**
 * Command handler function
 */
export type CommandHandler = (
  entities: CommandEntity[],
  context: CommandExecutionRequest
) => Promise<CommandExecutionResult>;

/**
 * Command registration
 */
export interface CommandRegistration {
  /** Intent this handler handles */
  intent: CommandIntent;

  /** Handler function */
  handler: CommandHandler;

  /** Required entities */
  requiredEntities?: EntityType[];

  /** Optional entities */
  optionalEntities?: EntityType[];

  /** Description of what this command does */
  description: string;

  /** Example commands */
  examples: string[];

  /** Category for help system */
  category: string;

  /** Required permissions */
  requiredPermissions?: string[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Parse command API request
 */
export interface ParseCommandRequest {
  /** User input command */
  command: string;

  /** Tenant ID */
  tenantId: string;

  /** User ID */
  userId: string;

  /** Optional context */
  context?: CommandContext;
}

/**
 * Parse command API response
 */
export interface ParseCommandResponse {
  /** Parsed command */
  parsedCommand: ParsedCommand;

  /** Suggestions if needed */
  suggestions?: CommandSuggestion[];
}

/**
 * Execute command API request
 */
export interface ExecuteCommandRequest {
  /** Parsed command */
  parsedCommand: ParsedCommand;

  /** Tenant ID */
  tenantId: string;

  /** User ID */
  userId: string;

  /** Optional context */
  context?: CommandContext;
}

/**
 * Execute command API response
 */
export interface ExecuteCommandResponse {
  /** Execution result */
  result: CommandExecutionResult;

  /** Updated context */
  updatedContext?: CommandContext;
}

// ============================================================================
// Voice Input Types
// ============================================================================

/**
 * Voice input status
 */
export enum VoiceInputStatus {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Voice recognition result
 */
export interface VoiceRecognitionResult {
  /** Recognized text */
  transcript: string;

  /** Confidence (0-100) */
  confidence: number;

  /** Alternative transcripts */
  alternatives?: string[];

  /** Whether this is final result */
  isFinal: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Price value in rupiah (stored in cents)
 */
export type PriceValue = number;

/**
 * Date range
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Pagination
 */
export interface Pagination {
  page: number;
  limit: number;
  total?: number;
}
