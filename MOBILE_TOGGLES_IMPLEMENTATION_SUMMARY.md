# Mobile Chat & Content Toggles Implementation Summary

## Overview
This document summarizes the implementation of mobile-specific toggles for chat and extra page content in Owncast. These features allow administrators to independently control whether chat and custom content are visible to mobile viewers.

## Implementation Date
November 6, 2025

## Commit Information
- **Commit Hash**: `23a4b40d2`
- **Commit Message**: "feat: Add device-aware chat and content toggles"
- **Branch**: `cursor/enhance-owncast-for-private-wedding-livestreams-4c9e`
- **Repository**: `matiascaba93-design/OwncastTest`
- **Status**: ? Committed and pushed to fork

## Features Implemented

### 1. Mobile Chat Toggle
- Allows administrators to enable/disable chat functionality specifically for mobile viewers
- Desktop chat remains unaffected by this setting
- Default: **Enabled** (true)

### 2. Mobile Extra Page Content Toggle
- Allows administrators to show/hide extra page content specifically for mobile viewers
- Desktop extra content remains unaffected by this setting
- Default: **Enabled** (true)

## Files Modified (16 total)

### Backend Changes

#### Configuration Repository
1. **`persistence/configrepository/configkeys.go`**
   - Added: `mobileChatEnabledKey = "mobile_chat_enabled"`
   - Added: `mobileExtraPageContentEnabledKey = "mobile_extra_page_content_enabled"`

2. **`persistence/configrepository/configrepository.go`**
   - Added interface methods:
     - `SetMobileChatEnabled(enabled bool) error`
     - `GetMobileChatEnabled() bool`
     - `SetMobileExtraPageContentEnabled(enabled bool) error`
     - `GetMobileExtraPageContentEnabled() bool`

3. **`persistence/configrepository/sqlconfigrepository.go`**
   - Implemented `SetMobileChatEnabled()` - persists mobile chat toggle state
   - Implemented `GetMobileChatEnabled()` - returns if chat should be available to mobile viewers (default: true)
   - Implemented `SetMobileExtraPageContentEnabled()` - persists mobile extra content toggle state
   - Implemented `GetMobileExtraPageContentEnabled()` - returns if extra content should be visible to mobile viewers (default: true)

4. **`persistence/configrepository/defaults.go`**
   - Added default initialization:
     - `_ = r.SetMobileChatEnabled(true)`
     - `_ = r.SetMobileExtraPageContentEnabled(true)`

#### API Handlers
5. **`webserver/handlers/admin/config.go`**
   - Added: `SetMobileChatEnabled()` - toggles chat availability specifically for mobile viewers
   - Added: `SetMobileExtraPageContentEnabled()` - toggles extra page content visibility for mobile viewers

6. **`webserver/handlers/admin/serverConfig.go`**
   - Added to response struct:
     - `MobileChatEnabled bool`
     - `MobileExtraPageContentEnabled bool`
   - Added to response payload:
     - `MobileChatEnabled: configRepository.GetMobileChatEnabled()`
     - `MobileExtraPageContentEnabled: configRepository.GetMobileExtraPageContentEnabled()`

7. **`webserver/handlers/config.go`**
   - Added to `webConfigResponse` struct:
     - `MobileChatEnabled bool`
     - `MobileExtraPageContentEnabled bool`
   - Added to response payload for client config

8. **`webserver/router/router.go`**
   - Added routes:
     - `POST /api/admin/config/mobile/chat/enabled`
     - `POST /api/admin/config/mobile/extrapagecontent/enabled`
   - Both routes require admin authentication

### Frontend Changes

#### Admin UI
9. **`web/components/admin/EditInstanceDetails2.tsx`**
   - Added two new `ToggleSwitch` components:
     - "Chat on mobile" toggle
     - "Custom content on mobile" toggle
   - Both toggles appear in the Instance Details section

10. **`web/utils/config-constants.tsx`**
    - Added API endpoints:
      - `API_MOBILE_CHAT_ENABLED = '/mobile/chat/enabled'`
      - `API_MOBILE_EXTRA_PAGE_CONTENT_ENABLED = '/mobile/extrapagecontent/enabled'`
    - Added field props:
      - `FIELD_PROPS_MOBILE_CHAT_ENABLED`
      - `FIELD_PROPS_MOBILE_EXTRA_CONTENT_ENABLED`

#### Client UI
11. **`web/components/ui/Content/Content.tsx`**
    - Added mobile device detection logic
    - Added `mobileChatEnabled` and `mobileExtraPageContentEnabled` from client config
    - Implemented `chatDisabledForDevice` logic that respects mobile chat toggle
    - Implemented `extraPageContentForMobile` that filters content based on mobile toggle
    - Updated mobile chat button and modal visibility to respect `mobileChatAllowed`
    - Updated `MobileContent` component to receive filtered `extraPageContentForMobile`

12. **`web/components/ui/Header/Header.tsx`**
    - Added mobile device detection via Recoil
    - Added `chatDisabledForDevice` logic that respects mobile chat toggle
    - Updated chat dropdown visibility to respect mobile chat settings

#### Type Definitions
13. **`web/interfaces/client-config.model.ts`**
    - Added to `ClientConfig` interface:
      - `mobileChatEnabled: boolean`
      - `mobileExtraPageContentEnabled: boolean`
    - Added to default config: both set to `true`

14. **`web/types/config-section.ts`**
    - Added to `ConfigDetails` interface:
      - `mobileChatEnabled: boolean`
      - `mobileExtraPageContentEnabled: boolean`

15. **`web/utils/server-status-context.tsx`**
    - Added to initial server config state:
      - `mobileChatEnabled: true`
      - `mobileExtraPageContentEnabled: true`

### Documentation
16. **`docs/product-definition.md`**
    - Added feature description: "Device-aware, allowing chat and custom content to be toggled separately for mobile viewers."

## How It Works

### Backend Flow
1. Admin toggles mobile chat/content settings in admin UI
2. Frontend sends POST request to `/api/admin/config/mobile/chat/enabled` or `/api/admin/config/mobile/extrapagecontent/enabled`
3. Backend handler calls config repository to persist the boolean value
4. Config repository stores the value in the database
5. When client requests config, backend includes `mobileChatEnabled` and `mobileExtraPageContentEnabled` in response

### Frontend Flow
1. Client receives config with `mobileChatEnabled` and `mobileExtraPageContentEnabled` flags
2. Client detects if viewer is on mobile device (via `isMobileAtom` Recoil state)
3. If mobile:
   - Chat button/modal visibility respects `mobileChatEnabled` flag
   - Extra page content visibility respects `mobileExtraPageContentEnabled` flag
4. If desktop:
   - Chat and content visibility work as before (unaffected by mobile toggles)

## Testing Checklist

### Admin UI
- [ ] Navigate to Configuration ? Server ? Instance Details
- [ ] Verify "Chat on mobile" toggle appears
- [ ] Verify "Custom content on mobile" toggle appears
- [ ] Toggle both settings and verify they persist after page refresh

### Client UI (Mobile)
- [ ] Open stream on mobile device (or resize browser to mobile width)
- [ ] With mobile chat enabled: verify chat button appears
- [ ] With mobile chat disabled: verify chat button does NOT appear
- [ ] With mobile content enabled: verify extra page content is visible
- [ ] With mobile content disabled: verify extra page content is NOT visible

### Client UI (Desktop)
- [ ] Open stream on desktop
- [ ] Verify chat works regardless of mobile chat toggle setting
- [ ] Verify extra content works regardless of mobile content toggle setting

## API Endpoints

### Admin Endpoints (require authentication)
- `POST /api/admin/config/mobile/chat/enabled`
  - Body: `{"value": true}` or `{"value": false}`
  
- `POST /api/admin/config/mobile/extrapagecontent/enabled`
  - Body: `{"value": true}` or `{"value": false}`

### Client Endpoints
- `GET /api/config`
  - Response includes:
    - `mobileChatEnabled: boolean`
    - `mobileExtraPageContentEnabled: boolean`

## Database Schema
No schema changes required. The config values are stored in the existing `config` table using keys:
- `mobile_chat_enabled` (boolean)
- `mobile_extra_page_content_enabled` (boolean)

## Default Values
- `mobileChatEnabled`: `true` (enabled by default)
- `mobileExtraPageContentEnabled`: `true` (enabled by default)

## Known Issues / Future Improvements
- None currently identified

## Related Issues / Context
This implementation was part of enhancing Owncast for private wedding livestreams, where administrators may want to hide chat or custom content on mobile devices for a cleaner viewing experience.

## Next Steps for New Agent
1. Verify the commit `23a4b40d2` exists in the fork: `matiascaba93-design/OwncastTest` branch `cursor/enhance-owncast-for-private-wedding-livestreams-4c9e`
2. Test the implementation using the checklist above
3. If creating a private repo, clone the fork and push to the private repository
4. Continue development from this point

## Contact / Questions
If the new agent has questions about this implementation, they can:
- Review the commit `23a4b40d2` to see all changes
- Check the files listed above for implementation details
- Test the admin UI toggles and client behavior

---

**End of Summary**
