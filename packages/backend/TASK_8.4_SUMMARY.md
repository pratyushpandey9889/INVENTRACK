# Task 8.4: Integrate Reorder Engine into Alert Service

## Summary

Successfully integrated the reorder engine into the alert service so that `listAlerts` enriches each alert with reorder suggestions.

## Changes Made

### 1. Updated `alert.service.ts`

#### Added Import
- Imported `calculateReorderSuggestion` from `reorderEngine.service.ts`

#### Extended `AlertWithProduct` Interface
Added new interface extending `Alert` with:
```typescript
export interface AlertWithProduct extends Alert {
  product: {
    id: string
    name: string
    sku: string | null
    currentStock: number
    lowStockThreshold: number
    unit: string
  }
  suggestedReorderQty: number
  avgDailyUsage: number | null
  daysSinceLastRestock: number | null
}
```

#### Modified `listAlerts` Function
- Changed return type from `PaginatedResponse<Alert>` to `PaginatedResponse<AlertWithProduct>`
- Updated SQL query to JOIN with products table to fetch product details
- Added enrichment logic for each alert:
  1. **Reorder Suggestion**: Calls `calculateReorderSuggestion(productId, 30, db)` to get:
     - `suggestedReorderQty`: Quantity to reorder (velocity-based or fallback)
     - `avgDailyUsage`: Average daily usage or null if not enough data
  2. **Days Since Last Restock**: Queries most recent restock movement and calculates days elapsed
     - Returns `null` if no restock exists

### 2. Created Test Files

#### `alert.service.test.ts`
- Unit tests validating interface structure
- Tests for proper field types and presence
- Tests for fallback behavior scenarios

#### `alert.service.integration.test.ts`
- Integration tests with real database queries
- Tests velocity-based calculations with sufficient data
- Tests fallback mode with insufficient data
- Tests `daysSinceLastRestock` calculation
- Tests that both sale and damage movements are counted
- Validates Requirement 4.3: `suggestedQty >= 1` always

## Requirements Validated

- **4.1**: Velocity-based reorder calculation formula
- **4.2**: Fallback mode (2× threshold) when insufficient data
- **4.3**: `suggestedQty` always >= 1
- **4.4**: Display format for velocity-based suggestions
- **4.5**: Display format for fallback suggestions

## API Impact

The `GET /api/alerts` endpoint now returns enriched `AlertWithProduct` objects with:
- All original alert fields
- Nested `product` object with product details
- `suggestedReorderQty`: Calculated reorder quantity
- `avgDailyUsage`: Average daily usage (or null)
- `daysSinceLastRestock`: Days since last restock (or null)

## Example Response

```json
{
  "data": [
    {
      "id": "alert-uuid",
      "shopId": "shop-uuid",
      "productId": "product-uuid",
      "triggeredAt": "2024-01-15T10:00:00.000Z",
      "resolvedAt": null,
      "status": "open",
      "product": {
        "id": "product-uuid",
        "name": "Widget A",
        "sku": "WGT-001",
        "currentStock": 5,
        "lowStockThreshold": 10,
        "unit": "unit"
      },
      "suggestedReorderQty": 40,
      "avgDailyUsage": 1.5,
      "daysSinceLastRestock": 7
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

## Test Results

All tests pass successfully:
- 4 unit tests in `alert.service.test.ts`
- 6 integration tests in `alert.service.integration.test.ts`
- Total: 10 tests passed

## Backward Compatibility

The changes maintain backward compatibility:
- Existing `updateAlertStatus` function unchanged
- Route handlers work seamlessly with enriched response
- No breaking changes to existing API contracts
